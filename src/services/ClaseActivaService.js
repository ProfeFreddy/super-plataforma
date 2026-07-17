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
  if (Array.isArray(mark)) {
    return Number(mark[0] || 0) * 60 + Number(mark[1] || 0);
  }

  if (typeof mark === "string") {
    const [h, m] = mark.trim().split(":").map(Number);
    return Number(h || 0) * 60 + Number(m || 0);
  }

  return Number(mark?.h || 0) * 60 + Number(mark?.m || 0);
}

function parseBloque(bloque) {
  if (!bloque) return null;

  if (typeof bloque === "string") {
    const partes = bloque.split(/\s*-\s*/);
    if (partes.length < 2) return null;

    const inicio = minutesFromMark(partes[0]);
    const fin = minutesFromMark(partes[1]);

    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      return null;
    }

    return { inicio, fin, texto: bloque };
  }

  const inicioRaw =
    bloque.inicio ??
    bloque.start ??
    bloque.desde ??
    bloque.horaInicio ??
    bloque.inicioStr;

  const finRaw =
    bloque.fin ??
    bloque.end ??
    bloque.hasta ??
    bloque.horaFin ??
    bloque.finStr;

  if (inicioRaw == null || finRaw == null) return null;

  const inicio = minutesFromMark(inicioRaw);
  const fin = minutesFromMark(finRaw);

  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
    return null;
  }

  return { inicio, fin, texto: `${inicioRaw} - ${finRaw}` };
}

/**
 * Devuelve únicamente los bloques pedagógicos reales.
 * No incluye recreos ni almuerzo.
 *
 * El índice del arreglo coincide con la fila de Firestore:
 * fila 0 = Bloque 1, fila 1 = Bloque 2, etc.
 */
export function normalizeBloques(config = {}) {
  const candidatos = [
    config.bloquesGenerados,
    config.bloques,
    config.bloquesClase,
    config.tramosClase,
  ];

  for (const lista of candidatos) {
    if (!Array.isArray(lista) || !lista.length) continue;

    const bloques = lista.map(parseBloque).filter(Boolean);
    if (bloques.length) return bloques;
  }

  return [];
}

/**
 * Compatibilidad con configuraciones antiguas.
 * Para detectar la clase activa se usa primero normalizeBloques().
 */
export function normalizeMarcas(config = {}) {
  if (Array.isArray(config.marcas) && config.marcas.length) {
    return config.marcas;
  }

  if (Array.isArray(config.marcasStr) && config.marcasStr.length) {
    return config.marcasStr;
  }

  const bloques = normalizeBloques(config);
  if (bloques.length) {
    const aHora = (minutos) => {
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    return [
      ...bloques.map((b) => aHora(b.inicio)),
      aHora(bloques.at(-1).fin),
    ];
  }

  return [];
}

export function slotIdFromHorarioConfig(horarioConfig = {}, fecha = new Date()) {
  const dia = fecha.getDay();
  if (dia < 1 || dia > 5) return null;

  const actual = fecha.getHours() * 60 + fecha.getMinutes();
  const bloques = normalizeBloques(horarioConfig);

  if (bloques.length) {
    for (let fila = 0; fila < bloques.length; fila += 1) {
      const bloque = bloques[fila];

      if (actual >= bloque.inicio && actual < bloque.fin) {
        return `${fila}-${dia - 1}`;
      }
    }

    // En recreo, almuerzo o fuera de horario no hay clase activa.
    return null;
  }

  // Fallback para horarios antiguos sin bloquesGenerados.
  const marcas = normalizeMarcas(horarioConfig);
  if (marcas.length < 2) return null;

  for (let fila = 0; fila < marcas.length - 1; fila += 1) {
    const inicio = minutesFromMark(marcas[fila]);
    const fin = minutesFromMark(marcas[fila + 1]);

    if (actual >= inicio && actual < fin) {
      return `${fila}-${dia - 1}`;
    }
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
    institucion: clean(raw.institucion || raw.colegio || raw.establecimiento || extras.institucion, "Institución educativa"),
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

    // Tarjeta semanal: se conserva completa durante todo el flujo.
    objetivoSemana: clean(raw.objetivoSemana || raw.objetivoGeneral, ""),
    objetivoGeneral: clean(raw.objetivoGeneral || raw.objetivoSemana, ""),
    contenido: clean(raw.contenido || raw.contenidoBloque, ""),
    contenidoBloque: clean(raw.contenidoBloque || raw.contenido, ""),
    actividadPrincipal: clean(
      raw.actividadPrincipal || raw.actividadPrincipalGenerada,
      ""
    ),
    observaciones: clean(raw.observaciones || raw.notasDocente, ""),
    notasDocente: clean(raw.notasDocente || raw.observaciones, ""),
    evaluacion: clean(raw.evaluacion, ""),
    gincana: raw.gincana !== false,

    introduccionFormal: clean(raw.introduccionFormal, ""),
    explicacionBasica: clean(raw.explicacionBasica, ""),
    explicacionNormal: clean(raw.explicacionNormal, ""),
    explicacionAvanzada: clean(raw.explicacionAvanzada, ""),
    ejemploGuiado: clean(raw.ejemploGuiado, ""),
    recursosIA: clean(raw.recursosIA, ""),
    ticketSalida: clean(raw.ticketSalida, ""),
    gincanaPrompt: clean(raw.gincanaPrompt, ""),

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
    institucion: usuario.colegio || usuario.institucion || usuario.establecimiento,
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

  const horarioConfig = usuario.horarioConfig || {};
  const bloques = normalizeBloques(horarioConfig);
  const marcas = normalizeMarcas(horarioConfig);

  const snaps = await getDocs(collection(db, "clases_detalle", uid, "slots"));

  const hoy = fecha.getDay(); // 0 domingo, 1 lunes, ..., 6 sábado
  const ahoraMin = fecha.getHours() * 60 + fecha.getMinutes();
  const items = [];

  snaps.forEach((snap) => {
    const [filaStr, colStr] = snap.id.split("-");
    const fila = Number(filaStr);
    const col = Number(colStr);

    if (!Number.isInteger(fila) || !Number.isInteger(col)) return;
    if (col < 0 || col > 4) return;

    const diaSemana = col + 1; // 1 lunes ... 5 viernes
    let deltaDias = diaSemana - hoy;

    if (deltaDias < 0) deltaDias += 7;

    const inicioMin =
      bloques[fila]?.inicio ??
      (marcas[fila] != null ? minutesFromMark(marcas[fila]) : fila * 60);

    // Si es hoy y aún no comienza, sigue siendo una próxima clase de hoy.
    // Solo pasa a la semana siguiente cuando la hora de inicio ya pasó.
    if (deltaDias === 0 && inicioMin <= ahoraMin) {
      deltaDias = 7;
    }

    const data = normalizeClase(snap.data() || {}, {
      slotId: snap.id,
      profesor: usuario.nombre || auth.currentUser?.displayName,
      institucion:
        usuario.colegio ||
        usuario.institucion ||
        usuario.establecimiento,
    });

    if (!clean(data.curso) || !clean(data.asignatura)) return;

    items.push({
      ...data,
      deltaDias,
      inicioMin,
      diaSemana,
    });
  });

  return items
    .sort(
      (a, b) =>
        a.deltaDias - b.deltaDias ||
        a.inicioMin - b.inicioMin
    )
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
