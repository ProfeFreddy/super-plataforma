import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export const CLASE_ACTIVA_KEY = "pragma:claseActiva";
export const DEMO_KEY = "pragma:soloDemo";

export function clean(v, fallback = "") {
  const s = String(v ?? "").trim();
  if (!s || /^\(?sin\s/i.test(s) || /undefined|null/i.test(s)) return fallback;
  return s;
}

export function getYearWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function minutesFromMark(mark) {
  if (Array.isArray(mark)) return Number(mark[0] || 0) * 60 + Number(mark[1] || 0);
  if (typeof mark === "string") {
    const [h, m] = mark.split(":").map(Number);
    return Number(h || 0) * 60 + Number(m || 0);
  }
  return Number(mark?.h || 0) * 60 + Number(mark?.m || 0);
}

export function normalizeMarcas(config = {}) {
  if (Array.isArray(config.marcas) && config.marcas.length) return config.marcas;
  if (Array.isArray(config.marcasStr) && config.marcasStr.length) return config.marcasStr;
  if (Array.isArray(config.bloquesGenerados) && config.bloquesGenerados.length) {
    const inicios = config.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const ultimoFin = String(config.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...inicios, ultimoFin];
  }
  return [];
}

export function slotIdFromHorarioConfig(horarioConfig = {}, fecha = new Date()) {
  const dia = fecha.getDay();
  if (dia < 1 || dia > 5) return null;

  const marcas = normalizeMarcas(horarioConfig);
  if (marcas.length < 2) return null;

  const actual = fecha.getHours() * 60 + fecha.getMinutes();
  for (let i = 0; i < marcas.length - 1; i += 1) {
    const inicio = minutesFromMark(marcas[i]);
    const fin = minutesFromMark(marcas[i + 1]);
    if (actual >= inicio && actual < fin) return `${i}-${dia - 1}`;
  }
  return null;
}

export function normalizeClase(raw = {}, extras = {}) {
  const objetivo = clean(raw.objetivoClase || raw.objetivo || raw.descripcionOA, "");
  const habilidades = Array.isArray(raw.habilidades)
    ? raw.habilidades.filter(Boolean).join(", ")
    : clean(raw.habilidades || raw.habilidadesTexto, "");

  return {
    slotId: clean(extras.slotId || raw.slotId || raw.slot, ""),
    profesor: clean(raw.profesor || raw.nombreProfesor || extras.profesor, "Profesor"),
    nombreProfesor: clean(raw.nombreProfesor || raw.profesor || extras.profesor, "Profesor"),
    institucion: clean(raw.institucion || raw.colegio || extras.institucion, "Institución educativa"),
    asignatura: clean(raw.asignatura, ""),
    curso: clean(raw.curso, ""),
    nivel: clean(raw.nivel, ""),
    seccion: clean(raw.seccion, ""),
    unidad: clean(raw.unidad, ""),
    oa: clean(raw.oa || raw.objetivoCurricular || raw.codigoOA || raw.codUnidad, ""),
    objetivo,
    objetivoClase: objetivo,
    habilidades,
    preguntaActivacion: clean(raw.preguntaActivacion || raw.preguntaClase, ""),
    recursos: Array.isArray(raw.recursos) ? raw.recursos : [],
    actividad: raw.actividad || null,
    cierre: raw.cierre || null,
    visualizador: raw.visualizador || null,
    salaCode: clean(raw.salaCode || extras.salaCode, ""),
    soloDemo: Boolean(raw.soloDemo || extras.soloDemo),
    estado: clean(raw.estado, "planificada"),
  };
}

export function claseEsValida(clase) {
  return Boolean(
    clase &&
      clean(clase.slotId) &&
      clean(clase.curso) &&
      clean(clase.asignatura) &&
      clean(clase.unidad) &&
      clean(clase.objetivoClase || clase.objetivo)
  );
}

function currentUid() {
  return auth.currentUser?.uid || null;
}

async function getUsuario(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() || {} : null;
}

export async function obtenerClaseActiva(fecha = new Date()) {
  const uid = currentUid();
  if (!uid || auth.currentUser?.isAnonymous) return null;

  const usuario = await getUsuario(uid);
  if (!usuario) return null;

  const slotId = slotIdFromHorarioConfig(usuario.horarioConfig || {}, fecha);
  if (!slotId) return null;

  const slotSnap = await getDoc(doc(db, "clases_detalle", uid, "slots", slotId));
  if (!slotSnap.exists()) return null;

  const clase = normalizeClase(slotSnap.data() || {}, {
    slotId,
    profesor: usuario.nombre || auth.currentUser?.displayName,
    institucion: usuario.colegio || usuario.institucion,
  });

  if (!claseEsValida(clase)) return null;
  return clase;
}

export async function guardarSesionClase(clase) {
  const uid = currentUid();
  if (!uid || !claseEsValida(clase)) throw new Error("Clase inválida");

  const salaCode = clean(clase.salaCode) || String(Math.floor(10000 + Math.random() * 90000));
  const payload = normalizeClase({ ...clase, salaCode });
  const sessionId = `${getYearWeek()}_${payload.slotId}`;

  await setDoc(
    doc(db, "sesiones_clase", uid, "sesiones", sessionId),
    {
      ...payload,
      sessionId,
      activa: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "salas", salaCode),
    {
      activa: true,
      uidProfesor: uid,
      slotId: payload.slotId,
      sessionId,
      curso: payload.curso,
      asignatura: payload.asignatura,
      unidad: payload.unidad,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const result = { ...payload, salaCode, sessionId };
  sessionStorage.setItem(CLASE_ACTIVA_KEY, JSON.stringify(result));
  return result;
}

export function leerSesionClase() {
  try {
    const raw = sessionStorage.getItem(CLASE_ACTIVA_KEY);
    return raw ? normalizeClase(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function limpiarSesionClase() {
  try {
    sessionStorage.removeItem(CLASE_ACTIVA_KEY);
    sessionStorage.removeItem(DEMO_KEY);
  } catch {}
}

export function crearClaseDemo() {
  const demo = normalizeClase(
    {
      slotId: "DEMO",
      profesor: auth.currentUser?.displayName || "Profesor demo",
      institucion: "Institución demostrativa",
      asignatura: "Matemática",
      curso: "2° Medio B",
      unidad: "Funciones cuadráticas",
      oa: "OA4",
      objetivoClase: "Reconocer cómo el valor de a modifica la apertura de la parábola.",
      habilidades: "Representar, Analizar, Argumentar",
      preguntaActivacion: "¿Dónde observas curvas parabólicas en la vida cotidiana?",
      salaCode: `D${String(Math.floor(1000 + Math.random() * 9000))}`,
      soloDemo: true,
      estado: "demo",
    },
    { soloDemo: true }
  );
  sessionStorage.setItem(DEMO_KEY, "1");
  sessionStorage.setItem(CLASE_ACTIVA_KEY, JSON.stringify(demo));
  return demo;
}

export async function obtenerProximasClases(limit = 4, fecha = new Date()) {
  const uid = currentUid();
  if (!uid || auth.currentUser?.isAnonymous) return [];

  const usuario = await getUsuario(uid);
  if (!usuario) return [];

  const marcas = normalizeMarcas(usuario.horarioConfig || {});
  const snaps = await getDocs(collection(db, "clases_detalle", uid, "slots"));
  const ahoraDia = fecha.getDay();
  const ahoraMin = fecha.getHours() * 60 + fecha.getMinutes();
  const items = [];

  snaps.forEach((snap) => {
    const [filaStr, colStr] = snap.id.split("-");
    const fila = Number(filaStr);
    const col = Number(colStr);
    if (!Number.isInteger(fila) || !Number.isInteger(col)) return;

    const dia = col + 1;
    let deltaDias = dia - ahoraDia;
    if (deltaDias < 0) deltaDias += 7;
    const inicioMin = marcas[fila] != null ? minutesFromMark(marcas[fila]) : fila * 60;
    if (deltaDias === 0 && inicioMin <= ahoraMin) deltaDias += 7;

    const data = normalizeClase(snap.data() || {}, {
      slotId: snap.id,
      profesor: usuario.nombre || auth.currentUser?.displayName,
      institucion: usuario.colegio || usuario.institucion,
    });

    if (!clean(data.curso) || !clean(data.asignatura)) return;
    items.push({ ...data, deltaDias, inicioMin });
  });

  return items
    .sort((a, b) => a.deltaDias - b.deltaDias || a.inicioMin - b.inicioMin)
    .slice(0, limit);
}

export function construirUrlParticipacion(clase) {
  return `${window.location.origin}/#/sala/${encodeURIComponent(clase.salaCode)}`;
}

export function construirUrlGincana(clase) {
  const params = new URLSearchParams({
    curso: clean(clase.curso),
    asignatura: clean(clase.asignatura),
    unidad: clean(clase.unidad),
    oa: clean(clase.oa),
    sala: clean(clase.salaCode),
    slot: clean(clase.slotId),
    demo: clase.soloDemo ? "1" : "0",
  });
  return `https://juego.pragmaprofe.com/#/gincana?${params.toString()}`;
}
