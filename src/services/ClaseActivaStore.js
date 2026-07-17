// src/services/ClaseActivaStore.js
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export const CLASE_ACTIVA_LOCAL_KEY = "pragma:claseActiva";

function clean(v, fallback = "") {
  const s = String(v ?? "").trim();
  if (!s || /undefined|null/i.test(s) || /^\(?sin\s/i.test(s)) return fallback;
  return s;
}

function uidActual(uid) {
  return uid || auth.currentUser?.uid || localStorage.getItem("uid") || "";
}

function refClaseActiva(uid) {
  const resolved = uidActual(uid);
  if (!resolved) throw new Error("No hay usuario autenticado.");
  return doc(db, "clase_activa", resolved);
}

function minutesFromMark(mark) {
  if (Array.isArray(mark)) {
    return Number(mark[0] || 0) * 60 + Number(mark[1] || 0);
  }

  if (typeof mark === "string") {
    const limpio = mark.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const [h, m] = limpio.split(":").map(Number);
    return Number(h || 0) * 60 + Number(m || 0);
  }

  return Number(mark?.h || 0) * 60 + Number(mark?.m || 0);
}

function parseBloque(bloque) {
  if (!bloque) return null;

  if (typeof bloque === "string") {
    const limpio = bloque.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const partes = limpio.split(/\s*-\s*/);
    if (partes.length < 2) return null;

    const inicio = minutesFromMark(partes[0]);
    const fin = minutesFromMark(partes[1]);

    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      return null;
    }

    const esPausa = /\((recreo|almuerzo)\)/i.test(bloque);
    return { inicio, fin, esPausa };
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

  const tipo = String(bloque.tipo || bloque.label || "").toLowerCase();
  const esPausa = tipo.includes("recreo") || tipo.includes("almuerzo");

  return { inicio, fin, esPausa };
}

/**
 * Obtiene solo los bloques lectivos reales.
 * horarioConfig.bloquesGenerados puede contener también recreos y almuerzo.
 */
function obtenerBloquesLectivos(horarioConfig = {}) {
  const listas = [
    horarioConfig.bloquesGenerados,
    horarioConfig.bloques,
    horarioConfig.bloquesClase,
    horarioConfig.tramosClase,
  ];

  for (const lista of listas) {
    if (!Array.isArray(lista) || !lista.length) continue;

    const bloques = lista
      .map(parseBloque)
      .filter((b) => b && !b.esPausa);

    if (bloques.length) return bloques;
  }

  // Compatibilidad con configuraciones antiguas.
  const marcas =
    Array.isArray(horarioConfig.marcasStr) && horarioConfig.marcasStr.length
      ? horarioConfig.marcasStr
      : horarioConfig.marcas;

  if (!Array.isArray(marcas) || marcas.length < 2) return [];

  const bloques = [];
  for (let i = 0; i < marcas.length - 1; i += 1) {
    const inicio = minutesFromMark(marcas[i]);
    const fin = minutesFromMark(marcas[i + 1]);
    if (Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio) {
      bloques.push({ inicio, fin, esPausa: false });
    }
  }

  return bloques;
}

function slotActualDesdeHorario(horarioConfig = {}, fecha = new Date()) {
  const dia = fecha.getDay(); // 1 lunes ... 5 viernes
  if (dia < 1 || dia > 5) return null;

  const actual = fecha.getHours() * 60 + fecha.getMinutes();
  const bloques = obtenerBloquesLectivos(horarioConfig);

  for (let fila = 0; fila < bloques.length; fila += 1) {
    const bloque = bloques[fila];
    if (actual >= bloque.inicio && actual < bloque.fin) {
      return `${fila}-${dia - 1}`;
    }
  }

  return null;
}

export function normalizarClaseActiva(raw = {}, extras = {}) {
  const objetivo = clean(
    raw.objetivoClase || raw.objetivo || raw.descripcionOA,
    ""
  );

  const habilidades = Array.isArray(raw.habilidades)
    ? raw.habilidades.filter(Boolean)
    : String(raw.habilidadesTexto || raw.habilidades || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

  return {
    ...raw,
    uidProfesor: clean(
      extras.uidProfesor || raw.uidProfesor || auth.currentUser?.uid
    ),
    slotId: clean(extras.slotId || raw.slotId || raw.slot),
    profesor: clean(
      raw.profesor || raw.nombreProfesor || extras.profesor,
      "Profesor"
    ),
    nombreProfesor: clean(
      raw.nombreProfesor || raw.profesor || extras.profesor,
      "Profesor"
    ),
    institucion: clean(
      raw.institucion ||
        raw.colegio ||
        raw.establecimiento ||
        extras.institucion,
      "Institución educativa"
    ),
    asignatura: clean(raw.asignatura),
    curso: clean(
      raw.curso || [raw.nivel, raw.seccion].filter(Boolean).join(" ")
    ),
    nivel: clean(raw.nivel),
    seccion: clean(raw.seccion),
    unidad: clean(raw.unidad || raw.unidadTitulo),
    oa: clean(raw.oa || raw.objetivoCurricular || raw.codigoOA),
    objetivo,
    objetivoClase: objetivo,
    objetivoSemana: clean(raw.objetivoSemana || raw.objetivoGeneral),
    objetivoGeneral: clean(raw.objetivoGeneral || raw.objetivoSemana),
    contenido: clean(raw.contenido || raw.contenidoBloque),
    contenidoBloque: clean(raw.contenidoBloque || raw.contenido),
    actividadPrincipal: clean(
      raw.actividadPrincipal || raw.actividadPrincipalGenerada
    ),
    observaciones: clean(raw.observaciones || raw.notasDocente),
    notasDocente: clean(raw.notasDocente || raw.observaciones),
    preguntaActivacion: clean(
      raw.preguntaActivacion || raw.preguntaClase
    ),
    habilidades,
    habilidadesTexto: habilidades.join(", "),
    recursos: Array.isArray(raw.recursos) ? raw.recursos : [],
    gincana: raw.gincana !== false,
    salaCode: clean(raw.salaCode),
    estado: clean(raw.estado, "planificada"),
  };
}

export function claseActivaEsValida(clase) {
  return Boolean(
    clase &&
      clean(clase.slotId) &&
      clean(clase.curso) &&
      clean(clase.asignatura)
  );
}

export function guardarClaseActivaLocal(clase) {
  const normalizada = normalizarClaseActiva(clase);
  sessionStorage.setItem(
    CLASE_ACTIVA_LOCAL_KEY,
    JSON.stringify(normalizada)
  );
  localStorage.setItem(
    CLASE_ACTIVA_LOCAL_KEY,
    JSON.stringify(normalizada)
  );
  return normalizada;
}

export function leerClaseActivaLocal() {
  try {
    const raw =
      sessionStorage.getItem(CLASE_ACTIVA_LOCAL_KEY) ||
      localStorage.getItem(CLASE_ACTIVA_LOCAL_KEY);

    return raw ? normalizarClaseActiva(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function leerUsuario(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() || {} : null;
}

export async function activarClasePorSlot(slotId, uid) {
  const resolvedUid = uidActual(uid);
  if (!resolvedUid) throw new Error("No hay usuario autenticado.");
  if (!slotId) throw new Error("Falta slotId.");

  const slotSnap = await getDoc(
    doc(db, "clases_detalle", resolvedUid, "slots", slotId)
  );

  if (!slotSnap.exists()) {
    throw new Error(`No existe la tarjeta ${slotId}.`);
  }

  const usuario = await leerUsuario(resolvedUid);

  const clase = normalizarClaseActiva(slotSnap.data() || {}, {
    uidProfesor: resolvedUid,
    slotId,
    profesor: usuario?.nombre || auth.currentUser?.displayName,
    institucion:
      usuario?.colegio ||
      usuario?.institucion ||
      usuario?.establecimiento,
  });

  const payload = {
    ...clase,
    uidProfesor: resolvedUid,
    slotId,
    activa: true,
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(refClaseActiva(resolvedUid), payload, { merge: false });

  return guardarClaseActivaLocal({
    ...clase,
    activa: true,
  });
}

/**
 * Detecta la clase que corresponde AHORA según el horario guardado
 * y la convierte en la única clase activa.
 *
 * No inventa datos: únicamente activa el documento ya existente en
 * clases_detalle/{uid}/slots/{slotId}.
 */
export async function activarClaseActualDesdeHorario(fecha = new Date(), uid) {
  const resolvedUid = uidActual(uid);
  if (!resolvedUid) return null;

  const usuario = await leerUsuario(resolvedUid);
  if (!usuario) return null;

  const slotId = slotActualDesdeHorario(
    usuario.horarioConfig || {},
    fecha
  );

  if (!slotId) return null;

  try {
    return await activarClasePorSlot(slotId, resolvedUid);
  } catch (error) {
    console.warn(
      "[ClaseActivaStore] No se pudo activar el slot actual:",
      slotId,
      error?.message || error
    );
    return null;
  }
}

/**
 * Inicio, Desarrollo, Cierre y Gincana llaman esta función.
 *
 * Primero verifica el horario real. Si existe una clase en este momento,
 * activa automáticamente ese slot y lo convierte en la fuente única.
 */
export async function leerClaseActiva(uid, fecha = new Date()) {
  const resolvedUid = uidActual(uid);
  if (!resolvedUid) return leerClaseActivaLocal();

  const usuario = await leerUsuario(resolvedUid);
  const slotHorario = usuario
    ? slotActualDesdeHorario(usuario.horarioConfig || {}, fecha)
    : null;

  const snap = await getDoc(refClaseActiva(resolvedUid));
  const guardada = snap.exists()
    ? normalizarClaseActiva(snap.data() || {})
    : null;

  // Si ahora hay una clase programada, ese slot tiene prioridad absoluta.
  if (slotHorario) {
    if (
      !guardada ||
      guardada.slotId !== slotHorario ||
      guardada.activa === false
    ) {
      const activada = await activarClasePorSlot(
        slotHorario,
        resolvedUid
      );
      return activada || leerClaseActivaLocal();
    }

    return guardarClaseActivaLocal(guardada);
  }

  // Fuera de un bloque lectivo no se mantiene como vigente una clase vieja.
  if (guardada?.activa === true) {
    await setDoc(
      refClaseActiva(resolvedUid),
      {
        activa: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return null;
}

export function escucharClaseActiva(callback, uid) {
  const resolvedUid = uidActual(uid);
  if (!resolvedUid) {
    callback(leerClaseActivaLocal());
    return () => {};
  }

  return onSnapshot(
    refClaseActiva(resolvedUid),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }

      const clase = normalizarClaseActiva(snap.data() || {});
      callback(clase.activa === false ? null : guardarClaseActivaLocal(clase));
    },
    (error) => {
      console.warn(
        "[ClaseActivaStore escuchar]",
        error?.code || error
      );
      callback(leerClaseActivaLocal());
    }
  );
}

export async function guardarYActivarClase(
  slotId,
  cambios = {},
  uid
) {
  const resolvedUid = uidActual(uid);
  if (!resolvedUid) throw new Error("No hay usuario autenticado.");

  await setDoc(
    doc(db, "clases_detalle", resolvedUid, "slots", slotId),
    {
      ...cambios,
      slotId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return activarClasePorSlot(slotId, resolvedUid);
}

export async function actualizarClaseActiva(cambios = {}, uid) {
  const actual = await leerClaseActiva(uid);
  if (!actual?.slotId) throw new Error("No hay clase activa.");

  const merged = normalizarClaseActiva({
    ...actual,
    ...cambios,
  });

  await setDoc(
    refClaseActiva(uid),
    {
      ...merged,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(
      db,
      "clases_detalle",
      uidActual(uid),
      "slots",
      actual.slotId
    ),
    {
      ...cambios,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return guardarClaseActivaLocal(merged);
}

export async function limpiarClaseActiva(uid) {
  const resolvedUid = uidActual(uid);

  if (resolvedUid) {
    await setDoc(
      refClaseActiva(resolvedUid),
      {
        activa: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  sessionStorage.removeItem(CLASE_ACTIVA_LOCAL_KEY);
  localStorage.removeItem(CLASE_ACTIVA_LOCAL_KEY);
}
