// HorarioEditable.jsx
import React, { useEffect, useState, useMemo } from "react"; 

import { getDoc, doc, setDoc, serverTimestamp, collection, getDocs, writeBatch } from "firebase/firestore";

import { db, auth } from "../firebase";

import { api } from "../lib/api";

import { useNavigate } from "react-router-dom";

import { generarSugerenciasSemana } from "../services/PlanificadorService";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { useLocation } from "react-router-dom";

const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

const bloques = [
  "08:00 - 08:45", "08:45 - 09:30",
  "09:30 - 09:50 (Recreo)",
  "9:50 - 10:35".replace("9:50","09:50"), "10:35 - 11:20",
  "11:20 - 11:30 (Recreo)",
  "11:30 - 12:15", "12:15 - 13:00",
  "13:00 - 13:45 (Almuerzo)",
  "13:45 - 14:30", "14:30 - 15:15",
  "15:15 - 15:30 (Recreo)",
  "15:30 - 16:15", "16:15 - 17:00", "17:00 - 17:45", "17:45 - 18:30",
  // ⬇️ NUEVOS BLOQUES NOCTURNOS
  "18:30 - 19:15", "19:15 - 20:00", "20:00 - 20:45"
];

const asignaturas = [
  "Matematica", "Lenguaje", "Fisica", "Quimica", "Biologia",
  "Historia", "Ciencias", "Ingles", "Tecnologia",
  "Reunion con apoderados", "Reunion con Profe PIE", "Planificacion",
  "Hora libre", "Otro", "Orientacion", "Dimensiones Formativas",
  "Limites", "Estadistica", "Reunion Dpto"
];
const niveles = ["1 Medio", "2 Medio", "3 Medio", "4 Medio"];
const secciones = ["A", "B", "C", "D"];

const asignaturasEspeciales = [
  "Reunion con apoderados",
  "Reunion con Profe PIE",
  "Planificacion",
  "Hora libre",
  "Otro",
  "Reunion Dpto"
];

// === Helpers para tiempos ===
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// — NUEVO: normalizadores
const normalizaNivel = (s) => (s || "").toString().trim();
const normalizaAsig = (s) => (s || "").trim();
const normalizaSeccion = (s) => (s || "").trim();

// — NUEVO: ids canónicos
const toId = (s = "") =>
  s.toString().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "");
const toNivelId = (s = "") => toId(s);
const makePlanId = (asigId, nivelId, unidadId) =>
  [toId(asigId), toId(nivelId), String(unidadId || "")].filter(Boolean).join("_");

// — NUEVO: sesion anonima si falta
const ensureAuthUid = async () => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
};

// — NUEVO: marcas default
const MARCAS_DEFAULT = [
  [8, 0],[8,45],[9,30],[9,50],[10,35],[11,20],
  [11,30],[12,15],[13,45],[14,30],[15,15],[15,30],
  [16,15],[17, 0],[17,45],[18,30],
  // ⬇️ NUEVAS MARCAS NOCTURNAS
  [19,15],[20, 0],[20,45],
  // marca de cierre para fin de jornada (tope de cálculo)
  [21, 0],
];

// — NUEVO: convertir marcas a formato permitido por Firestore (evitar arrays anidados)
const marcasToFirestore = (arr) =>
  (arr || []).map(([h, m]) => ({ h, m }));

// — NUEVO: convertir marcas Firestore {h,m} o pares a [h,m]
const marcasFromFirestore = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Array.isArray(x) ? x : [Number(x?.h)||0, Number(x?.m)||0])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
};

// === NEW helpers para detectar clase en curso ===
const isBreakLabel = (label) => /Recreo|Almuerzo/i.test(label || "");
const parseRango = (label) => {
  const m = String(label || "").match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  return m ? [[+m[1], +m[2]], [+m[3], +m[4]]] : null;
};

/* — NUEVO: helper para deducir el id de asignatura (para ?asig=)
   - Convierte el nombre visible a un id canonico usado en Firestore.
*/
const nombreToAsigId = (name = "") => {
  const s = name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (s.includes("matem")) return "matematica";
  if (s.includes("lengua")) return "lenguaje";
  if (s.includes("fisic")) return "fisica";
  if (s.includes("quim")) return "quimica";
  if (s.includes("biolog")) return "biologia";
  if (s.includes("hist")) return "historia";
  if (s.includes("cienc")) return "ciencias";
  if (s.includes("ingl")) return "ingles";
  if (s.includes("tecnol")) return "tecnologia";
  if (s.includes("orient")) return "orientacion";
  if (s.includes("estad")) return "estadistica";
  if (s.includes("limite")) return "limites";
  if (s.includes("reunion dpto")) return "reuniondpto";
  if (s.includes("reunion") && s.includes("apoder")) return "reunionconapoderados";
  if (s.includes("reunion") && s.includes("pie")) return "reunionconprofepie";
  if (s.includes("planific")) return "planificacion";
  if (s.includes("hora libre")) return "horalibre";
  if (s.includes("dimensiones formativ")) return "dimensionesformativas";
  // fallback: quita espacios
  return s.replace(/\s+/g, "");
};

/* — NUEVO: deduce asignatura para navegacion y navega con ?asig= */
function useGoPlanificaciones(navigate, { seleccion, unidadesUsuario, horario }) {
  return React.useCallback(() => {
    // 1) seleccion actual en panel
    let asigId =
      seleccion?.asignaturaId ||
      // 2) primera unidad disponible
      (unidadesUsuario?.[0]?.asignaturaId) ||
      // 3) buscar primera celda con asignatura y mapear
      (() => {
        for (let i = 0; i < (horario?.length || 0); i++) {
          for (let j = 0; j < (horario[i]?.length || 0); j++) {
            const a = horario[i][j]?.asignatura;
            if (a) return nombreToAsigId(a);
          }
        }
        return null;
      })() ||
      // 4) ultimo recordado
      localStorage.getItem("selAsignatura") ||
      "";

    if (asigId) {
      localStorage.setItem("selAsignatura", asigId);
      navigate(`/planificaciones?asig=${encodeURIComponent(asigId)}`);
    } else {
      navigate("/planificaciones");
    }
  }, [navigate, seleccion, unidadesUsuario, horario]);
}

/* — NUEVO: Sincronizador de slots (clases_detalle) desde el horario */
async function readHorarioMatrixFS(uid) {
  try {
    const hRef = doc(db, "horarios", uid);
    const hSnap = await getDoc(hRef);
    if (hSnap.exists() && Array.isArray(hSnap.data()?.horario)) {
      return hSnap.data().horario;
    }
  } catch {}

  try {
    const uRef = doc(db, "usuarios", uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) return null;
    const u = uSnap.data() || {};

    if (u.horarioMatriz && typeof u.horarioMatriz === "object") {
      const keys = Object.keys(u.horarioMatriz).sort(
        (a,b)=> Number(a.replace("f","")) - Number(b.replace("f",""))
      );
      return keys.map(k => u.horarioMatriz[k]);
    }

    if (Array.isArray(u.horarioSlots)) {
      const rows = u.horarioConfig?.bloquesGenerados?.length || bloques.length;
      const cols = 5;
      const matrix = Array.from({length:rows}, () =>
        Array.from({length:cols}, () => ({
          asignatura:"", nivel:"", seccion:"", unidad:"", objetivo:"", habilidades:""
        }))
      );
      u.horarioSlots.forEach(s => {
        if (s?.fila != null && s?.col != null) {
          matrix[s.fila][s.col] = {
            asignatura: s.asignatura || "",
            nivel: s.nivel || "",
            seccion: s.seccion || "",
            unidad: s.unidad || "",
            objetivo: s.objetivo || "",
            habilidades: Array.isArray(s.habilidades) ? s.habilidades.join(", ") : (s.habilidades || ""),
          };
        }
      });
      return matrix;
    }
  } catch {}
  return null;
}

async function syncSlotsFromHorario(uid, { overwrite=false } = {}) {
  const matrix = await readHorarioMatrixFS(uid);
  if (!matrix) return { ok:false, reason:"no-matrix" };

  for (let fila = 0; fila < matrix.length; fila++) {
    const row = matrix[fila] || [];
    for (let col = 0; col < row.length; col++) {
      const cell = row[col] || {};
      const hasData =
        (cell.asignatura && cell.asignatura.trim()) ||
        (cell.nivel && cell.nivel.trim()) ||
        (cell.seccion && cell.seccion.trim()) ||
        (cell.unidad && cell.unidad.trim()) ||
        (cell.objetivo && cell.objetivo.trim()) ||
        (cell.habilidades && String(cell.habilidades).trim());
      if (!hasData) continue;

      const slotId = `${fila}-${col}`;
      const dref = doc(db, "clases_detalle", uid, "slots", slotId);
      const snap = await getDoc(dref);
      const prev = snap.exists() ? (snap.data() || {}) : {};

      const data = overwrite
        ? {
            asignatura: cell.asignatura || "",
            nivel: cell.nivel || "",
            seccion: cell.seccion || "",
            unidad: cell.unidad || "",
            objetivo: cell.objetivo || "",
            habilidades: Array.isArray(cell.habilidades)
              ? cell.habilidades.join(", ")
              : (cell.habilidades || ""),
            updatedAt: serverTimestamp(),
          }
        : {
            asignatura: prev.asignatura || cell.asignatura || "",
            nivel: prev.nivel || cell.nivel || "",
            seccion: prev.seccion || cell.seccion || "",
            unidad: prev.unidad || cell.unidad || "",
            objetivo: prev.objetivo || cell.objetivo || "",
            habilidades: prev.habilidades || (
              Array.isArray(cell.habilidades)
                ? cell.habilidades.join(", ")
                : (cell.habilidades || "")
            ),
            updatedAt: serverTimestamp(),
          };

      await setDoc(dref, data, { merge: true });
    }
  }
  return { ok:true };
}
/*  */

/* ================================================================
  — NUEVO: SelectorPlanificacionInline (combo + buscador + chips)
================================================================ */
function SelectorPlanificacionInline({
  fila,
  columna,
  asignatura = "",
  nivel = "",
  seccion = "",
  unidadesUsuario = [],
  onSaved = () => {},
  actualizarCelda,
}) {
  const [uid, setUid] = useState(auth.currentUser?.uid || localStorage.getItem("uid") || "");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!uid) {
        const u = await ensureAuthUid();
        setUid(u);
      }
    })();
  }, [uid]);

  const slotId = `${fila}-${columna}`;
  const curso = [normalizaNivel(nivel), normalizaSeccion(seccion)].filter(Boolean).join(" ").trim();

  const norm = (s="") => s.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();
  const asigKey = norm(asignatura);

  // filtra unidades por asignatura (y por busqueda opcional)
  const lista = useMemo(() => {
    let base = unidadesUsuario;
    if (asigKey) {
      base = base.filter(u => norm(u.asignaturaNombre||u.asignaturaId||"").includes(asigKey));
    }
    if (q.trim()) {
      const b = norm(q);
      base = base.filter(u => norm(u.unidad?.nombre||"").includes(b));
    }
    // dedup por id+nombre
    const seen = new Set();
    const out = [];
    for (const u of base) {
      const key = `${u.asignaturaId||u.asignaturaNombre}__${u.nivelId}__${u.unidad?.id}__${u.unidad?.nombre}`;
      if (!seen.has(key)) { seen.add(key); out.push(u); }
    }
    return out.slice(0, 40); // tope visual
  }, [unidadesUsuario, asigKey, q]);

  const guardar = async (u) => {
    if (!uid) return setMsg("Sin UID.");
    if (!asignatura) return setMsg("Primero elige la asignatura.");
    if (!curso) return setMsg("Completa nivel y seccion para el curso.");
    const codUnidad = String(u?.unidad?.id || "").trim();
    if (!codUnidad) return setMsg("Unidad sin id/codigo.");

    // ids canónicos para el plan
    const asigId = u?.asignaturaId || nombreToAsigId(asignatura);
    const nivelId = u?.nivelId || toNivelId(nivel);
    const planId = makePlanId(asigId, nivelId, codUnidad);

    try {
      setMsg("Guardando");
      await setDoc(
        doc(db, "horarios", uid, "celdas", slotId),
        {
          asignatura: normalizaAsig(asignatura),
          curso,
          codUnidad,
          asignaturaId: asigId,
          nivelId,
          planId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // — NUEVO: materializar en clases_detalle/{uid}/slots/{slotId}
      await setDoc(
        doc(db, "clases_detalle", uid, "slots", slotId),
        {
          asignatura: normalizaAsig(asignatura),
          asignaturaId: asigId,
          nivel: normalizaNivel(nivel),
          nivelId,
          seccion: normalizaSeccion(seccion),
          unidad: u?.unidad?.nombre || "",
          unidadId: u?.unidad?.id || "",
          planId,
          objetivo: Array.isArray(u?.unidad?.objetivos) ? u.unidad.objetivos.join("  ") : "",
          habilidades: Array.isArray(u?.unidad?.habilidades) ? u.unidad.habilidades.join("  ") : "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // reflejo en la celda (nombre de la unidad + objetivo + habilidades + ids)
      if (typeof actualizarCelda === "function") {
        actualizarCelda(fila, columna, "asignaturaId", asigId);
        actualizarCelda(fila, columna, "nivelId", nivelId);
        actualizarCelda(fila, columna, "unidadId", u?.unidad?.id || "");
        actualizarCelda(fila, columna, "planId", planId);
        actualizarCelda(fila, columna, "unidad", u?.unidad?.nombre || "");
        actualizarCelda(
          fila, columna, "objetivo",
          Array.isArray(u?.unidad?.objetivos) ? u.unidad.objetivos.join("  ") : ""
        );
        actualizarCelda(
          fila, columna, "habilidades",
          Array.isArray(u?.unidad?.habilidades) ? u.unidad.habilidades.join(" ") : ""
        );
      }

      setMsg("✓ Planificacion guardada y materializada en clases_detalle.");
      onSaved({ asignatura, curso, codUnidad, planId });
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`);
    }
  };

  // UI compacta
  return (
    <div style={{ marginTop: 8, borderTop: "1px dashed #e5e7eb", paddingTop: 8 }}>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
        <b>Planificacion (combo + chips)</b> — escribe en <code>horarios/{uid||""}/celdas/{slotId}</code>
      </div>

      {/* combo: usa la asignatura/nivel/seccion de la celda; agrego buscador de unidad */}
      <input
        placeholder="Buscar unidad por nombre"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 6 }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {lista.length === 0 && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {asignatura ? "No hay resultados para esa asignatura/busqueda." : "Selecciona una asignatura arriba para ver planificaciones."}
          </span>
        )}
        {lista.map((u) => (
          <button
            key={`${u.asignaturaId}-${u.nivelId}-${u.unidad?.id}`}
            type="button"
            onClick={() => guardar(u)}
            title={`Guardar ${u.unidad?.nombre}`}
            style={{
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              borderRadius: 999,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {u.unidad?.nombre || u.unidad?.id}
          </button>
        ))}
      </div>

      {msg && <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>{msg}</div>}
    </div>
  );
}
/* ===================== FIN SELECTOR ===================== */

// ===== NUEVO: limpiar llaves de cronos/contadores antes de ir a Home (consistente con otras pantallas)
function clearAllCountdowns() {
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k === "inicioClase_countdown_end" ||
        k.startsWith("ic_countdown_end:") ||
        k.startsWith("crono:")
      ) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

// === NUEVO: Ruta dinámica para "Inicio de Clase"
const INICIO_CLASE_CANDIDATES = ["/InicioClase", "/inicioClase", "/inicioclase", "/Inicioclase"];
const getInicioClasePath = () => {
  try {
    const ls = localStorage.getItem("inicioClasePath");
    // Permite override global por window
    const win = (typeof window !== "undefined" && window.__INICIO_CLASE_PATH) || null;
    return (ls && String(ls)) || (win && String(win)) || INICIO_CLASE_CANDIDATES[0];
  } catch {
    return INICIO_CLASE_CANDIDATES[0];
  }
};

const HorarioEditable = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // ===== NUEVO: helper central para ir a InicioClase (NO Home)
  const goHomeSafe = (extraState = {}) => {
    clearAllCountdowns();
    const path = getInicioClasePath(); // ⬅️ ahora apunta a la ruta correcta de InicioClase
    navigate(path, {
      replace: true,
      state: { resetTimers: true, from: "horario", ...extraState }
    });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((e) => console.error("Anon sign-in error:", e));
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user?.uid) {
      const stored = localStorage.getItem("uid");
      if (stored !== user.uid) {
        localStorage.setItem("uid", user.uid);
        console.log("[sync] localStorage uid =>", user.uid);
      }
    }
  }, [user]);

  /* — NUEVO: autosincroniza slots al entrar (una sola vez por uid) */
  useEffect(() => {
    const run = async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (!uid) return;
      if (window.__slotsSyncedForUid === uid) return;
      try {
        await syncSlotsFromHorario(uid, { overwrite: false });
        window.__slotsSyncedForUid = uid;
        console.log("✓ slots sincronizados (on mount)");
      } catch (e) {
        console.warn("syncSlotsFromHorario (mount) error:", e);
      }
    };
    run();
  }, [user]);

  /* — NUEVO: helper de debug desde consola */
  useEffect(() => {
    window.syncSlotsNow = async (overwrite = false) => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (!uid) return alert("Sin uid");
      const r = await syncSlotsFromHorario(uid, { overwrite });
      alert("syncSlotsFromHorario: " + JSON.stringify(r));
    };
  }, []);

  const [bloquesUI, setBloquesUI] = useState(bloques);
  const [marcasUI, setMarcasUI] = useState(MARCAS_DEFAULT);

  const [horario, setHorario] = useState(
    Array(bloques.length).fill(null).map(() =>
      Array(dias.length).fill(null).map(() => ({
        asignatura: "",
        nivel: "",
        seccion: ""
      }))
    )
  );
  const [editando, setEditando] = useState(true);
  const [unidad, setUnidad] = useState("");
  const [feriados, setFeriados] = useState([]);
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [wikipediaUrl, setWikipediaUrl] = useState(null);

  // Asistente
  const [inicioJornada, setInicioJornada] = useState("08:00");
  const [duracionBloque, setDuracionBloque] = useState(45);
  // ⬇️ arranca alineado con los bloques visibles
  const [totalBloques, setTotalBloques] = useState(bloques.length);
  const [recreoManiana, setRecreoManiana] = useState({ habilitado: true, hora: "09:30", minutos: 20 });
  const [recreoTarde, setRecreoTarde] = useState({ habilitado: true, hora: "15:15", minutos: 15 });
  const [almuerzo, setAlmuerzo] = useState({ habilitado: true, hora: "13:00", minutos: 45 });

  // Panel de unidades
  const [unidadesUsuario, setUnidadesUsuario] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargandoUnidades, setCargandoUnidades] = useState(false);

  // Calendario/autoplan
  const hoyISO = () => new Date().toISOString().slice(0,10);
  const defaultFin = () => { const d = new Date(); d.setMonth(d.getMonth()+4); return d.toISOString().slice(0,10); };

  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [fechaFin, setFechaFin] = useState(defaultFin());
  const [periodicidad, setPeriodicidad] = useState("semestre");
  const [fallbackHorasUnidad, setFallbackHorasUnidad] = useState(8);
  const [horasEvaluacion, setHorasEvaluacion] = useState(1);
  const [previewSemana, setPreviewSemana] = useState(1);
  const [weeksCount, setWeeksCount] = useState(0);
  const [planSemanas, setPlanSemanas] = useState({});

  const dateFromISO = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  const mondayOfWeek = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = (day===0 ? -6 : 1) - day; dt.setDate(dt.getDate()+diff); dt.setHours(0,0,0,0); return dt; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  // — NUEVO: weekKey ISO robusto
  const weekKey = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // 1..7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const year = d.getUTCFullYear();
    return `${year}-W${String(weekNo).padStart(2, "0")}`;
  };
  const enumerateWeeks = (iniISO, finISO) => { const ini = mondayOfWeek(dateFromISO(iniISO)); const fin = mondayOfWeek(dateFromISO(finISO)); const list = []; let cur = new Date(ini); while (cur <= fin) { list.push(new Date(cur)); cur = addDays(cur, 7); } return list; };

  // Cargar unidades del usuario (catalogo + prefs)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (!uid) return;
      setCargandoUnidades(true);
      try {
        const prefSnap = await getDocs(collection(db, "usuarios", uid, "planificacion_usuario"));
        const prefs = prefSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
        const all = [];
        for (const p of prefs) {
          const [asignaturaId, nivelId] = (p.id || "").split("_");
          if (!asignaturaId || !nivelId) continue;

          let asignaturaNombre = asignaturaId;
          try {
            const asigDoc = await getDoc(doc(db, "catalogo_curricular", asignaturaId));
            if (asigDoc.exists() && asigDoc.data()?.nombre) asignaturaNombre = asigDoc.data().nombre;
          } catch {}

          let lista = [];
          try {
            const unidadesRefNew = collection(db, "catalogo_curricular", asignaturaId, "niveles", nivelId, "unidades");
            const uSnapNew = await getDocs(unidadesRefNew);
            const listNew = uSnapNew.docs.map(d => ({ id:d.id, ...(d.data()||{}) }));
            lista = [...listNew];
          } catch {}

          try {
            const legacyKey = `${asignaturaId}_${nivelId}`;
            const unidadesRefLegacy = collection(db, "catalogo_curricular", legacyKey, "unidades");
            const uSnapLegacy = await getDocs(unidadesRefLegacy);
            const listLegacy = uSnapLegacy.docs.map(d => ({ id:d.id, ...(d.data()||{}) }));

            if (listLegacy.length > 0) {
              const seen = new Map();
              const norm = (u) => String(u.nombre || u.titulo || u.id || "").trim().toLowerCase();
              [...lista, ...listLegacy].forEach(u => { const k = (u.id || "") + "@" + norm(u); if (!seen.has(k)) seen.set(k, u); });
              lista = Array.from(seen.values());
            }
          } catch {}

          const estado = p.unidades || {};
          for (const u of lista) {
            const nombreU = u.nombre || u.titulo || u.id;
            const nameKey = String(nombreU || "").toLowerCase().trim();
            const est = estado[u.id] || estado[nombreU] || estado[nameKey] || "";
            if (est === "hecha") continue;

            all.push({
              asignaturaId, asignaturaNombre, nivelId,
              unidad: {
                id: u.id,
                nombre: nombreU,
                objetivos: Array.isArray(u.objetivos) ? u.objetivos : (Array.isArray(u.OA) ? u.OA : []),
                habilidades: Array.isArray(u.habilidades) ? u.habilidades : [],
                horasSugeridas: u.horasSugeridas,
              },
              estado: est
            });
          }
        }
        all.sort((a,b) => {
          const rank = (x) => x==="priorizada" ? 0 : x==="seleccionada" ? 1 : 2;
          const r = rank(a.estado) - rank(b.estado);
          if (r !== 0) return r;
          return (a.unidad.nombre||"").localeCompare(b.unidad.nombre||"");
        });
        if (alive) setUnidadesUsuario(all);
      } finally {
        if (alive) setCargandoUnidades(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [user]);

  const unidadesAgrupadas = useMemo(() => {
    const map = new Map();
    for (const it of unidadesUsuario) {
      const key = `${it.asignaturaNombre} - ${it.nivelId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return Array.from(map.entries());
  }, [unidadesUsuario]);

  const aplicarEstructura = () => {
    let t = toMinutes(inicioJornada);
    let clasesConstruidas = 0;
    const labels = [];
    const marcas = [];

    // — NUEVO: inserta breaks de forma robusta (evita perderlos por 1-2 min)
    const maybeInsertBreak = () => {
      const tryInsert = (enabled, hhmm, minutos, label) => {
        if (!enabled) return;
        const hb = toMinutes(hhmm);
        if (t === hb) {
          const fin = t + minutos;
          labels.push(`${toHHMM(t)} - ${toHHMM(fin)} (${label})`);
          marcas.push([Math.floor(t/60), t%60]);
          t = fin;
        }
      };
      tryInsert(recreoManiana.habilitado, recreoManiana.hora, recreoManiana.minutos, "Recreo");
      tryInsert(almuerzo.habilitado,     almuerzo.hora,       almuerzo.minutos,       "Almuerzo");
      tryInsert(recreoTarde.habilitado,  recreoTarde.hora,    recreoTarde.minutos,    "Recreo");
    };

    while (clasesConstruidas < Number(totalBloques)) {
      maybeInsertBreak();
      const finClase = t + Number(duracionBloque);
      labels.push(`${toHHMM(t)} - ${toHHMM(finClase)}`);
      marcas.push([Math.floor(t/60), t%60]);
      t = finClase;
      clasesConstruidas++;
      maybeInsertBreak();
    }

    marcas.push([Math.floor(t/60), t%60]);

    setBloquesUI(labels);
    setMarcasUI(marcas);

    const nuevaMatriz = Array(labels.length).fill(null).map(() =>
      Array(dias.length).fill(null).map(() => ({
        asignatura: "",
        nivel: "",
        seccion: ""
      }))
    );
    setHorario(nuevaMatriz);
  };

  // Lecturas iniciales
  useEffect(() => {
    let alive = true;
    const obtenerDatos = async () => {
      const uid = (user?.uid) || localStorage.getItem("uid");
      if (uid) {
        const ref = doc(db, "usuarios", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          const unidadInicial = data.unidadInicial || "";
          if (alive) setUnidad(unidadInicial);

          if (!asignaturasEspeciales.includes(unidadInicial)) {
            try {
              const oaResponse = await api.get(
                `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=matematica&nivel=media&unidad=${unidadInicial}`
              );
              if (alive) setOaMinisterio(oaResponse.data[0]);

              const wikiSearch = await api.get(
                `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${unidadInicial}&format=json&origin=*`
              );
              const firstTitle = wikiSearch.data.query.search[0]?.title;
              if (firstTitle && alive) {
                setWikipediaUrl(`https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`);
              }
            } catch (err) {
              console.error("Error buscando OA o Wikipedia:", err);
            }
          }

          /* NUEVO: cargar horarioConfig + horarioMatriz existentes para prellenar la UI */
          try {
            const cfg = data.horarioConfig || {};

            // inicio / duración
            if (cfg.inicio && alive) setInicioJornada(cfg.inicio);
            if (Number.isFinite(+cfg.duracionMin) && alive) setDuracionBloque(Number(cfg.duracionMin));

            // cantidad: toma el máximo para NO recortar bloques extendidos
            const cantFS = Number(cfg.cantidad);
            if (alive) setTotalBloques(Number.isFinite(cantFS) ? Math.max(cantFS, bloques.length) : bloques.length);

            // bloquesGenerados: solo usar si NO son más cortos que los actuales
            if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length >= bloques.length) {
              if (alive) setBloquesUI(cfg.bloquesGenerados);
            } else {
              if (alive) setBloquesUI(bloques);
            }

            // marcas: deben tener length === labels + 1, si no, default
            if (Array.isArray(cfg.marcas) && cfg.marcas.length > 0) {
              const pares = marcasFromFirestore(cfg.marcas);
              const labelsCount =
                (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length >= bloques.length)
                  ? cfg.bloquesGenerados.length
                  : bloques.length;
              if (pares.length === labelsCount + 1) {
                if (alive) setMarcasUI(pares);
              } else {
                if (alive) setMarcasUI(MARCAS_DEFAULT);
              }
            }

            if (Array.isArray(cfg.breaks)) {
              const man = cfg.breaks.find(b => /Recreo/i.test(b?.label) && b?.hhmm && toMinutes(b.hhmm) < toMinutes("12:00"));
              const alm = cfg.breaks.find(b => /Almuerzo/i.test(b?.label));
              const tar = cfg.breaks.filter(b => /Recreo/i.test(b?.label)).sort((a,b)=>toMinutes(a.hhmm)-toMinutes(b.hhmm)).find(b => toMinutes(b.hhmm) >= toMinutes("12:00"));
              if (man && alive) setRecreoManiana({ habilitado: true, hora: man.hhmm, minutos: Number(man.durMin||15) });
              if (alm && alive) setAlmuerzo({ habilitado: true, hora: alm.hhmm, minutos: Number(alm.durMin||45) });
              if (tar && alive) setRecreoTarde({ habilitado: true, hora: tar.hhmm, minutos: Number(tar.durMin||15) });
            }

            // ► Regenerar matriz base según la longitud final de labels
            const labelsLen =
              (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length >= bloques.length)
                ? cfg.bloquesGenerados.length
                : bloques.length;

            if (alive) setHorario(Array(labelsLen).fill(null).map(() =>
              Array(dias.length).fill(null).map(() => ({
                asignatura: "",
                nivel: "",
                seccion: "",
              }))
            ));

            // reconstruir matriz de horario con datos existentes si hay
            if (data.horarioMatriz && typeof data.horarioMatriz === "object") {
              const cols = dias.length;
              const nueva = Array(labelsLen).fill(null).map((_, i) => {
                const filaFS = data.horarioMatriz[`f${i}`] || [];
                return Array(cols).fill(null).map((_, j) => {
                  const c = filaFS[j] || {};
                  return {
                    asignatura: c.asignatura || "",
                    nivel: c.nivel || "",
                    seccion: c.seccion || "",
                    unidad: c.unidad || "",
                    objetivo: c.objetivo || "",
                    habilidades: c.habilidades || "",
                  };
                });
              });
              if (alive) setHorario(nueva);
            }
          } catch (e) {
            console.warn("[Horario] No se pudo pre-cargar horarioConfig/horarioMatriz:", e?.message || e);
          }
          /* FIN NUEVO */
        }
      }
    };
    obtenerDatos();
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    const obtenerFeriados = async () => {
      try {
        const anio = new Date().getFullYear();
        const res = await api.get(`https://date.nager.at/api/v3/PublicHolidays/${anio}/CL`);
        setFeriados(res.data.slice(0, 5));
      } catch (error) {
        console.error("Error cargando feriados:", error);
      }
    };
    obtenerFeriados();
  }, []);

  const actualizarCelda = (fila, columna, campo, valor) => {
    const nuevoHorario = [...horario];
    const cell = { ...(nuevoHorario[fila][columna] || {}) };
    cell[campo] = valor;

    // — NUEVO: si cambia asignatura o nivel, limpiar dependientes y recalcular ids
    if (campo === "asignatura") {
      cell.asignaturaId = nombreToAsigId(valor);
      cell.unidad = "";
      cell.unidadId = "";
      cell.objetivo = "";
      cell.habilidades = "";
      cell.planId = "";
    }
    if (campo === "nivel") {
      cell.nivelId = toNivelId(valor);
      cell.unidad = "";
      cell.unidadId = "";
      cell.objetivo = "";
      cell.habilidades = "";
      cell.planId = "";
    }

    nuevoHorario[fila][columna] = cell;
    setHorario(nuevoHorario);
  };

  const ponerUnidadSeleccionada = (fila, columna) => {
    if (!seleccion) {
      alert("Elige primero una unidad en el panel de la izquierda.");
      return;
    }
    const nuevo = [...horario];
    const cell = { ...(nuevo[fila][columna] || {}) };
    cell.asignatura = seleccion.asignaturaNombre || seleccion.asignaturaId || cell.asignatura || "";
    cell.nivel = normalizaNivel(seleccion.nivelId || cell.nivel || "");
    cell.unidad = seleccion.unidad.nombre || "";
    cell.objetivo = Array.isArray(seleccion.unidad.objetivos) ? seleccion.unidad.objetivos.join(" ") : "";
    cell.habilidades = Array.isArray(seleccion.unidad.habilidades) ? seleccion.unidad.habilidades.join(" ") : "";
    cell.asignaturaId = seleccion.asignaturaId || nombreToAsigId(cell.asignatura);
    cell.nivelId = seleccion.nivelId || toNivelId(cell.nivel);
    cell.unidadId = seleccion.unidad.id || "";
    cell.planId = makePlanId(cell.asignaturaId, cell.nivelId, cell.unidadId);
    nuevo[fila][columna] = cell;
    setHorario(nuevo);
  };

  // === AUTOPLAN (igual)
  const getMatSlotsSemana = () => {
    const slots = [];
    for (let fila = 0; fila < bloquesUI.length; fila++) {
      const label = bloquesUI[fila] || "";
      const esDescanso = /Recreo|Almuerzo/i.test(label);
      if (esDescanso) continue;
      for (let col = 0; col < dias.length; col++) {
        const c = horario[fila]?.[col] || {};
        if ((c.asignatura || "").toLowerCase().includes("matem")) {
          slots.push({ fila, col });
        }
      }
    }
    return slots;
  };
  const horasToBloques = (horas) => Math.max(1, Math.ceil((horas*60) / Number(duracionBloque || 45)));

  const autoPlanificar = async () => {
    try {
      const weeks = enumerateWeeks(fechaInicio, fechaFin);
      if (!weeks.length) { alert("Rango de fechas invalido."); return; }
      setWeeksCount(weeks.length);

      const matSlots = getMatSlotsSemana();
      if (!matSlots.length) { alert("No hay bloques de Matematica en el horario semanal. Asigna primero 'Matematica'."); return; }

      const unidadesOrden = [...unidadesUsuario];
      const rank = (x) => x.estado==="priorizada" ? 0 : x.estado==="seleccionada" ? 1 : 2;
      unidadesOrden.sort((a,b)=> rank(a)-rank(b));
      if (!unidadesOrden.length) { alert("No tienes unidades seleccionadas. Ve a Planificaciones > Catalogo."); return; }

      const bloquesEval = horasToBloques(Number(horasEvaluacion || 1));
      const plan = {};
      let cursor = 0;

      const totalPos = weeks.length * matSlots.length;
      const takePos = (k) => {
        if (cursor >= totalPos) return null;
        const wIdx = Math.floor(cursor / matSlots.length);
        const sIdx = cursor % matSlots.length;
        const wk = weekKey(weeks[wIdx]);
        const slot = matSlots[sIdx];
        cursor++;
        if (!plan[wk]) plan[wk] = [];
        return { wk, slot };
      };

      for (const u of unidadesOrden) {
        const horas = Number(u.unidad.horasSugeridas || fallbackHorasUnidad);
        const bloquesUnidad = horasToBloques(horas);
        for (let i=0;i<bloquesUnidad;i++){
          const pos = takePos();
          if (!pos) break;
          const {wk, slot} = pos;
          plan[wk].push({ fila: slot.fila, col: slot.col, unidadId: u.unidad.id, unidadNombre: u.unidad.nombre, evaluacion: false });
        }
        for (let j=0;j<bloquesEval;j++){
          const pos = takePos();
          if (!pos) break;
          const {wk, slot} = pos;
          plan[wk].push({ fila: slot.fila, col: slot.col, unidadId: `eval-${u.unidad.id}-${j}`, unidadNombre: `Evaluacion - ${u.unidad.nombre}`, evaluacion: true });
        }
      }

      const uid = await ensureAuthUid();
      for (const [wk, items] of Object.entries(plan)) {
        await setDoc(
          doc(db, "usuarios", uid, "planificacion_calendario", wk),
          { items, meta: { fechaInicio, fechaFin, periodicidad, duracionBloque, updatedAt: serverTimestamp() } },
          { merge: true }
        );
      }

      setPlanSemanas(plan);
      setPreviewSemana(1);
      const wk0 = weekKey(weeks[0]);
      aplicarPreviewSemana(wk0, plan);

      alert("— Autoplanificacion generada y guardada por semanas.");
    } catch (e) {
      console.error("autoPlanificar error:", e);
      alert("No se pudo autoplanificar. Revisa la consola.");
    }
  };

  const aplicarPreviewSemana = (wkKeySel, plan) => {
    const planW = plan[wkKeySel] || [];
    const nuevo = horario.map(fila => fila.map(c => ({...c})));
    for (const item of planW) {
      const c = nuevo[item.fila]?.[item.col];
      if (!c) continue;
      c.unidad = item.unidadNombre;
      c.objetivo = c.objetivo || "";
      c.habilidades = c.habilidades || "";
    }
    setHorario(nuevo);
  };

  const cambiarSemanaPreview = (nueva) => {
    const weeks = enumerateWeeks(fechaInicio, fechaFin);
    if (!weeks.length) return;
    const idx = Math.min(Math.max(1, nueva), weeks.length);
    setPreviewSemana(idx);
    const wk = weekKey(weeks[idx-1]);
    aplicarPreviewSemana(wk, planSemanas);
  };

  // === Detectar clase en curso (para redireccion y CTA) ===
  const claseEnCurso = () => {
    const now = new Date();
    const dayIdx = now.getDay(); // 0..6 (Lunes=1)
    const col = dayIdx - 1;
    if (col < 0 || col >= dias.length) return null;

    const minsNow = now.getHours()*60 + now.getMinutes();
    const marcas = (Array.isArray(marcasUI) && marcasUI.length > 1) ? marcasUI : MARCAS_DEFAULT;

    for (let i=0; i<bloquesUI.length; i++) {
      const label = bloquesUI[i] || "";
      if (isBreakLabel(label)) continue;

      // determina inicio/fin por marcas o parseo de etiqueta (preferir marcas)
      let ini = marcas[i];
      let fin = marcas[i+1];
      if (!ini || !fin) {
        const parsed = parseRango(label);
        if (parsed) { ini = parsed[0]; fin = parsed[1]; }
      }
      if (!ini || !fin) continue;

      const startMin = ini[0]*60 + ini[1];
      const endMin   = fin[0]*60 + fin[1];

      if (minsNow >= startMin && minsNow < endMin) {
        const c = horario[i]?.[col] || {};
        if (c.asignatura) return { fila: i, col, cell: c, label };
      }
    }
    return null;
  };

  const goConfigurarObjetivos = (fila, columna) => {
  // obtenemos la celda actual
  const c = horario[fila]?.[columna] || {};

  // sacamos los ids de esa celda
  const asigId   = c.asignaturaId || nombreToAsigId(c.asignatura || "");
  const nivelId  = c.nivelId || toNivelId(c.nivel || "");
  const unidadId = c.unidadId || "";

  // generamos planId de forma segura
  const planId = c.planId || (unidadId ? makePlanId(asigId, nivelId, unidadId) : "");

  // validación mínima para avisarte si falta información clave
  if (!asigId || !nivelId || !unidadId) {
    alert("Completa Asignatura, Nivel y coloca una Unidad primero.");
    return;
  }

  // navegamos
  navigate(
    `/planificador?planId=${encodeURIComponent(planId)}&asig=${encodeURIComponent(asigId)}&nivel=${encodeURIComponent(nivelId)}&unidadId=${encodeURIComponent(unidadId)}&slot=${fila}-${columna}`
  );
};

  // Guardar horario (igual) + añade ids/planId a clases_detalle (con batch)
  const guardarHorario = async () => {
    try {
      let uid = auth.currentUser?.uid || user?.uid || localStorage.getItem("uid") || null;
      if (!uid) uid = await ensureAuthUid();
      if (localStorage.getItem("uid") !== uid) localStorage.setItem("uid", uid);

      const horarioMatriz = {};
      horario.forEach((fila, i) => {
        horarioMatriz[`f${i}`] = fila.map((c) => ({
          asignatura: normalizaAsig(c.asignatura),
          nivel: normalizaNivel(c.nivel),
          seccion: normalizaSeccion(c.seccion),
          unidad: c.unidad || "",
          objetivo: c.objetivo || "",
          habilidades: c.habilidades || "",
        }));
      });

      const horarioSlots = [];
      for (let fila = 0; fila < horario.length; fila++) {
        for (let col = 0; col < horario[fila].length; col++) {
          const c = horario[fila][col];
          horarioSlots.push({
            fila, col,
            asignatura: normalizaAsig(c.asignatura),
            nivel: normalizaNivel(c.nivel),
            seccion: normalizaSeccion(c.seccion),
          });
        }
      }

      const breaks = [];
      if (recreoManiana.habilitado) breaks.push({ hhmm: recreoManiana.hora, durMin: recreoManiana.minutos, label: "Recreo" });
      if (almuerzo.habilitado)     breaks.push({ hhmm: almuerzo.hora,       durMin: almuerzo.minutos,       label: "Almuerzo" });
      if (recreoTarde.habilitado)  breaks.push({ hhmm: recreoTarde.hora,    durMin: recreoTarde.minutos,    label: "Recreo" });

      const marcasRaw = (Array.isArray(marcasUI) && marcasUI.length > 1) ? marcasUI : MARCAS_DEFAULT;

      const ref = doc(db, "usuarios", uid);
      await setDoc(ref, {
        horarioMatriz,
        horarioSlots,
        horarioConfig: {
          inicio: inicioJornada,
          duracionMin: Number(duracionBloque),
          cantidad: Number(totalBloques),
          bloquesGenerados: bloquesUI,
          marcas: marcasToFirestore(marcasRaw),
          breaks,
          calendario: { fechaInicio, fechaFin, periodicidad },
          updatedAt: serverTimestamp(),
        },
        horario: [],
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // clases_detalle — NUEVO: writeBatch
      const batch = writeBatch(db);
      for (let fila = 0; fila < horario.length; fila++) {
        for (let col = 0; col < horario[fila].length; col++) {
          const c = horario[fila][col] || {};
          if (c.asignatura || c.unidad || c.objetivo || c.habilidades) {
            const id = `${fila}-${col}`;
            const asigId = c.asignaturaId || nombreToAsigId(c.asignatura || "");
            const nivelId = c.nivelId || toNivelId(c.nivel || "");
            const planId = c.planId || (c.unidadId ? makePlanId(asigId, nivelId, c.unidadId) : "");
            const dref = doc(db, "clases_detalle", uid, "slots", id);
            batch.set(dref, {
              unidad: c.unidad || "",
              unidadId: c.unidadId || "",
              objetivo: c.objetivo || "",
              habilidades: c.habilidades || "",
              asignatura: c.asignatura || "",
              asignaturaId: asigId || "",
              nivel: c.nivel || "",
              nivelId: nivelId || "",
              planId: planId || "",
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }
      }
      await batch.commit();
       
            try {
        await syncSlotsFromHorario(uid, { overwrite: false });
      } catch (e) {
        console.warn("syncSlotsFromHorario (post-save) error:", e);
      }

      setEditando(false);
      alert("— Horario guardado correctamente en Firestore (incluye clases_detalle).");

      // Generar sugerencias para la semana (no crítico si falla)
      try {
        const horarioNormalizado = horario.map((fila) =>
          fila.map((c) => ({
            ...c,
            asignatura: normalizaAsig(c.asignatura),
            nivel: normalizaNivel(c.nivel),
            seccion: normalizaSeccion(c.seccion),
          }))
        );
        await generarSugerenciasSemana(uid, horarioNormalizado);
      } catch (e) {
        console.error("Error generando planificaciones sugeridas:", e);
      }

      // Si hay clase en curso, volver a InicioClase; si no, a Planificaciones
      const enCurso = claseEnCurso();
      if (enCurso) {
        goHomeSafe({ reason: "post_save_try" });
      } else {
        navigate("/planificaciones");
      }

    }  catch (error) {
      console.error("Error al guardar horario:", error);
      alert(`Error al guardar el horario:
code: ${error.code || "sin-code"}
message: ${error.message || "sin-message"}`);
    }
  };

  const pruebaManual = () => { 
    goHomeSafe({ reason: "manual" });
  };

  const guardarHorarioYProbarInicio = async () => {
    try {
      let uid = auth.currentUser?.uid || user?.uid || localStorage.getItem("uid") || null;
      if (!uid) uid = await ensureAuthUid();
      if (localStorage.getItem("uid") !== uid) localStorage.setItem("uid", uid);

      const horarioMatriz = {};
      horario.forEach((fila, i) => {
        horarioMatriz[`f${i}`] = fila.map((c) => ({
          asignatura: normalizaAsig(c.asignatura),
          nivel: normalizaNivel(c.nivel),
          seccion: normalizaSeccion(c.seccion),
          unidad: c.unidad || "",
          objetivo: c.objetivo || "",
          habilidades: c.habilidades || "",
        }));
      });

      const horarioSlots = [];
      for (let fila = 0; fila < horario.length; fila++) {
        for (let col = 0; col < horario[fila].length; col++) {
          const c = horario[fila][col];
          horarioSlots.push({
            fila, col,
            asignatura: normalizaAsig(c.asignatura),
            nivel: normalizaNivel(c.nivel),
            seccion: normalizaSeccion(c.seccion),
          });
        }
      }

      const breaks = [];
      if (recreoManiana.habilitado) breaks.push({ hhmm: recreoManiana.hora, durMin: recreoManiana.minutos, label: "Recreo" });
      if (almuerzo.habilitado)     breaks.push({ hhmm: almuerzo.hora,       durMin: almuerzo.minutos,       label: "Almuerzo" });
      if (recreoTarde.habilitado)  breaks.push({ hhmm: recreoTarde.hora,    durMin: recreoTarde.minutos,    label: "Recreo" });

      const marcasRaw = (Array.isArray(marcasUI) && marcasUI.length > 1) ? marcasUI : MARCAS_DEFAULT;

      const ref = doc(db, "usuarios", uid);
      await setDoc(ref, {
        horarioMatriz,
        horarioSlots,
        horarioConfig: {
          inicio: inicioJornada,
          duracionMin: Number(duracionBloque),
          cantidad: Number(totalBloques),
          bloquesGenerados: bloquesUI,
          marcas: marcasToFirestore(marcasRaw),
          breaks,
          calendario: { fechaInicio, fechaFin, periodicidad },
          updatedAt: serverTimestamp(),
        },
        horario: [],
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // clases_detalle — NUEVO: writeBatch
      const batch = writeBatch(db);
      for (let fila = 0; fila < horario.length; fila++) {
        for (let col = 0; col < horario[fila].length; col++) {
          const c = horario[fila][col] || {};
          if (c.asignatura || c.unidad || c.objetivo || c.habilidades) {
            const id = `${fila}-${col}`;
            const asigId = c.asignaturaId || nombreToAsigId(c.asignatura || "");
            const nivelId = c.nivelId || toNivelId(c.nivel || "");
            const planId = c.planId || (c.unidadId ? makePlanId(asigId, nivelId, c.unidadId) : "");
            const dref = doc(db, "clases_detalle", uid, "slots", id);
            batch.set(dref, {
              unidad: c.unidad || "",
              unidadId: c.unidadId || "",
              objetivo: c.objetivo || "",
              habilidades: c.habilidades || "",
              asignatura: c.asignatura || "",
              asignaturaId: asigId || "",
              nivel: c.nivel || "",
              nivelId: nivelId || "",
              planId: planId || "",
              updatedAt: serverTimestamp(),
            }, { merge: true });
            batch.set(doc(db, "horarios", uid, "celdas", id), {
              asignatura: c.asignatura || "",
              asignaturaId: asigId || "",
              nivel: c.nivel || "",
              nivelId: nivelId || "",
              seccion: c.seccion || "",
              // nombres alternativos
              unidad: c.unidad || "",
              unidadNombre: c.unidad || "",
              unidadId: c.unidadId || "",
              objetivo: c.objetivo || "",
              objetivos: Array.isArray(c.objetivo) ? c.objetivo :
              (c.objetivo ? String(c.objetivo).split(/\s{2,}|\n|;|·/).filter(Boolean) : []),
              habilidades: c.habilidades || "",
              habilidadesArr: Array.isArray(c.habilidades) ? c.habilidades :
                  (c.habilidades ? String(c.habilidades).split(/\s{2,}|\n|;|·/).filter(Boolean) : []),
              planId: planId || "",
              updatedAt: serverTimestamp(),
              }, { merge: true });
          }
        }
      }
      await batch.commit();

      try {
        await syncSlotsFromHorario(uid, { overwrite: false });
      } catch (e) {
        console.warn("syncSlotsFromHorario (post-save test) error:", e);
      }

      try {
        const horarioNormalizado = horario.map((fila) =>
          fila.map((c) => ({
            ...c,
            asignatura: normalizaAsig(c.asignatura),
            nivel: normalizaNivel(c.nivel),
            seccion: normalizaSeccion(c.seccion),
          })))
        ;
        generarSugerenciasSemana(uid, horarioNormalizado).catch(console.error);
      } catch (e) {
        console.error("Error generando planificaciones:", e);
      }

      // ===== IR A INICIO DE CLASE (ruta dinámica)
      goHomeSafe({ reason: "post_save_test" });
    } catch (error) {
      console.error("Error al guardar el horario (Y PROBAR):", error);
      alert(`Error al guardar el horario:
code: ${error.code || "sin-code"}
message: ${error.message || "sin-message"}`);
    }
  };

  // Estilos
  const card = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem", boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)", marginBottom: "1rem" };
  const label = { fontWeight: 600, fontSize: ".95rem" };
  const row = { display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" };
  const input = { padding: ".5rem .75rem", borderRadius: 8, border: "1px solid #d1d5db" };
  const btn = (bg) => ({ padding: ".5rem .9rem", border: "none", borderRadius: 8, color: "#fff", background: bg, cursor: "pointer" });

  const SeleccionBadge = () =>
    seleccion ? (
      <span style={{ fontSize:12, fontWeight:800, color:"#2193b0", border:"1px solid #2193b0", borderRadius:999, padding:"2px 8px" }}>
        Seleccionada: {seleccion.unidad.nombre}
      </span>
    ) : (
      <span style={{ fontSize:12, color:"#64748b" }}>Elige una unidad para pegarla en el horario</span>
    );

  const enCurso = claseEnCurso();

  // — NUEVO: callback para ir a Planificaciones con ?asig=
  const goPlanificaciones = useGoPlanificaciones(navigate, { seleccion, unidadesUsuario, horario });

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
        <h2> Horario Semanal</h2>
        {enCurso ? (
          <button onClick={() => goHomeSafe({ reason: "clase_en_curso" })} style={btn("#ef4444")}> Ir a Inicio de Clase (en curso)</button>
        ) : (
          <button onClick={goPlanificaciones} style={btn("#2563eb")}> Ir a Planificaciones</button>
        )}
      </div>
      <p><strong>Unidad inicial registrada:</strong> {unidad || "No registrada"}</p>

      {/* Panel de Unidades */}
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <h3 style={{ margin:0 }}> Unidades disponibles</h3>
          <SeleccionBadge />
        </div>

        {cargandoUnidades && <div style={{ color:"#64748b" }}>Cargando unidades</div>}

        {!cargandoUnidades && unidadesAgrupadas.length === 0 && (
          <div style={{ color:"#64748b" }}>
            No hay unidades aun. Ve a <b>Planificaciones</b>, selecciona asignatura y marca unidades como <i>priorizadas</i> o <i>seleccionadas</i>.
            <div style={{ marginTop:8 }}>
              <button type="button" onClick={goPlanificaciones} style={btn("#2563eb")}> Ir a Planificaciones</button>
            </div>
          </div>
        )}

        <div style={{ display:"grid", gap:10 }}>
          {unidadesAgrupadas.map(([titulo, lista]) => (
            <div key={titulo} style={{ borderTop:"1px dashed #e5e7eb", paddingTop:8 }}>
              <div style={{ fontWeight:800, marginBottom:6 }}>{titulo}</div>
              <div style={{ display:"grid", gap:6, gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))" }}>
                {lista.map((u) => (
                  <button
                    key={u.unidad.id}
                    type="button"
                    onClick={() => setSeleccion(u)}
                    title="Seleccionar unidad"
                    style={{
                      textAlign:"left",
                      border: (seleccion?.unidad?.id===u.unidad.id && seleccion?.asignaturaId===u.asignaturaId) ? "2px solid #2193b0" : "1px solid #e5e7eb",
                      borderRadius:10, padding:"10px 12px", background:"#fff", cursor:"pointer"
                    }}
                  >
                    <div style={{ fontWeight:800 }}>{u.unidad.nombre}</div>
                    {u.estado && <div style={{ fontSize:12, color:"#64748b" }}>Estado: {u.estado}</div>}
                    {u.unidad.objetivos?.length > 0 && (
                      <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
                        <b>Obj:</b> {u.unidad.objetivos.join(" ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* FIN Panel Unidades */}

      {/* Calendario & Autoplanificacion */}
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: ".5rem" }}> Calendario & Autoplanificacion</h3>

        <div style={row}>
          <div>
            <div style={label}>Fecha de inicio</div>
            <input type="date" value={fechaInicio} onChange={(e)=>setFechaInicio(e.target.value)} style={input} />
          </div>
          <div>
            <div style={label}>Fecha de termino</div>
            <input type="date" value={fechaFin} onChange={(e)=>setFechaFin(e.target.value)} style={input} />
          </div>
          <div>
            <div style={label}>Periodicidad</div>
            <select value={periodicidad} onChange={(e)=>setPeriodicidad(e.target.value)} style={input}>
              <option value="anio">Anio</option>
              <option value="semestre">Semestre</option>
              <option value="trimestre">Trimestre</option>
              <option value="bimestre">Bimestre</option>
              <option value="mensual">Mensual</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
          <div>
            <div style={label}>Horas fallback por unidad</div>
            <input type="number" min={1} value={fallbackHorasUnidad} onChange={(e)=>setFallbackHorasUnidad(Number(e.target.value))} style={{...input, width:100}} />
          </div>
          <div>
            <div style={label}>Horas evaluacion por unidad</div>
            <input type="number" min={0} value={horasEvaluacion} onChange={(e)=>setHorasEvaluacion(Number(e.target.value))} style={{...input, width:100}} />
          </div>
        </div>

        <div style={{ marginTop: ".75rem", display:"flex", gap:10, alignItems:"center" }}>
          <button type="button" onClick={autoPlanificar} style={btn("#7c3aed")}> Autoplanificar unidades</button>
          {weeksCount > 0 && (
            <>
              <span style={{ color:"#475569" }}>Semanas generadas: <b>{weeksCount}</b></span>
              <span style={{ color:"#475569" }}> Semana en vista:</span>
              <input type="number" min={1} max={Math.max(1,weeksCount)} value={previewSemana} onChange={(e)=>cambiarSemanaPreview(Number(e.target.value))} style={{...input, width:80}} />
              <button type="button" onClick={()=>cambiarSemanaPreview(previewSemana-1)} style={btn("#0ea5e9")}>◀</button>
              <button type="button" onClick={()=>cambiarSemanaPreview(previewSemana+1)} style={btn("#0ea5e9")}>▶</button>
            </>
          )}
        </div>

        <div style={{ marginTop:8, color:"#64748b", fontSize:13 }}>
          La tabla de abajo muestra una <b>previsualizacion</b> de la semana en vista. Puedes ajustar manualmente celdas especificas con “Poner Unidad Seleccionada”.
        </div>
      </div>
      {/* FIN Calendario & Autoplanificacion */}

      {/* Asistente de configuracion */}
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: ".5rem" }}> Asistente de configuracion</h3>

        <div style={row}>
          <div>
            <div style={label}>Inicio de jornada</div>
            <input type="time" value={inicioJornada} onChange={(e) => setInicioJornada(e.target.value)} style={input} />
          </div>

        <div>
            <div style={label}>Duracion del bloque (min)</div>
            <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
              <input type="number" min={30} max={120} value={duracionBloque} onChange={(e) => setDuracionBloque(Number(e.target.value))} style={{ ...input, width: 90 }} />
              <button type="button" onClick={() => setDuracionBloque(45)} style={btn("#2563eb")}>45'</button>
              <button type="button" onClick={() => setDuracionBloque(50)} style={btn("#2563eb")}>50'</button>
              <button type="button" onClick={() => setDuracionBloque(55)} style={btn("#2563eb")}>55'</button>
              <button type="button" onClick={() => setDuracionBloque(90)} style={btn("#2563eb")}>90'</button>
            </div>
          </div>

          <div>
            <div style={label}>Bloques de clase (cantidad)</div>
            <input type="number" min={1} max={30} value={totalBloques} onChange={(e) => setTotalBloques(Number(e.target.value))} style={{ ...input, width: 90 }} />
          </div>
        </div>

        <hr style={{ margin: "1rem 0" }} />

        <div style={row}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <input type="checkbox" checked={recreoManiana.habilitado} onChange={(e) => setRecreoManiana({ ...recreoManiana, habilitado: e.target.checked })} />
              Recreo (manana)
            </label>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".25rem" }}>
              <input type="time" value={recreoManiana.hora} onChange={(e) => setRecreoManiana({ ...recreoManiana, hora: e.target.value })} style={input} />
              <input type="number" min={5} max={60} value={recreoManiana.minutos} onChange={(e) => setRecreoManiana({ ...recreoManiana, minutos: Number(e.target.value) })} style={{ ...input, width: 90 }} />
              <span style={{ alignSelf: "center" }}>min</span>
            </div>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <input type="checkbox" checked={almuerzo.habilitado} onChange={(e) => setAlmuerzo({ ...almuerzo, habilitado: e.target.checked })} />
              Almuerzo
            </label>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".25rem" }}>
              <input type="time" value={almuerzo.hora} onChange={(e) => setAlmuerzo({ ...almuerzo, hora: e.target.value })} style={input} />
              <input type="number" min={15} max={120} value={almuerzo.minutos} onChange={(e) => setAlmuerzo({ ...almuerzo, minutos: Number(e.target.value) })} style={{ ...input, width: 90 }} />
              <span style={{ alignSelf: "center" }}>min</span>
            </div>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <input type="checkbox" checked={recreoTarde.habilitado} onChange={(e) => setRecreoTarde({ ...recreoTarde, habilitado: e.target.checked })} />
              Recreo (tarde)
            </label>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".25rem" }}>
              <input type="time" value={recreoTarde.hora} onChange={(e) => setRecreoTarde({ ...recreoTarde, hora: e.target.value })} style={input} />
              <input type="number" min={5} max={60} value={recreoTarde.minutos} onChange={(e) => setRecreoTarde({ ...recreoTarde, minutos: Number(e.target.value) })} style={{ ...input, width: 90 }} />
              <span style={{ alignSelf: "center" }}>min</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: ".75rem" }}>
          <button type="button" onClick={aplicarEstructura} style={btn("#059669")}>Aplicar estructura</button>
        </div>
      </div>
      {/* FIN Asistente */}

      {oaMinisterio && (
        <div style={{ background: "#f0f0f0", padding: "1rem", margin: "1rem 0" }}>
          <h4>OA del Ministerio:</h4>
          <p><strong>{oaMinisterio.codigo}</strong>: {oaMinisterio.descripcion}</p>
        </div>
      )}

      {wikipediaUrl && (
        <div style={{ marginBottom: "1rem" }}>
          <h4>Contenido Wikipedia:</h4>
          <iframe
            src={wikipediaUrl}
            width="100%"
            height="400"
            title="Contenido Wikipedia"
            style={{ border: "1px solid #ccc", borderRadius: "8px" }}
            sandbox="allow-same-origin allow-scripts allow-popups"
            referrerPolicy="no-referrer"
          ></iframe>
        </div>
      )}

      <h4>Proximos Feriados Oficiales en Chile:</h4>
      <ul>
        {feriados.map((f, idx) => (<li key={idx}>{f.date}: {f.localName}</li>))}
      </ul>

      <table border="1" cellPadding="5" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", wordBreak: "break-word" }}>
        <thead>
          <tr>
            <th>Bloque</th>
            {dias.map((dia, i) => (<th key={i}>{dia}</th>))}
          </tr>
        </thead>
        <tbody>
          {bloquesUI.map((bloque, fila) => (
            <tr key={fila}>
              <td>{bloque}</td>
              {dias.map((_, columna) => {
                const esDescanso = bloque.includes("Recreo") || bloque.includes("Almuerzo");
                const cell = horario[fila]?.[columna] || {};
                const isNow = !!(enCurso && enCurso.fila === fila && enCurso.col === columna);
                return (
                  <td key={columna} style={isNow ? { outline: "2px solid #16a34a", outlineOffset: 2, borderRadius: 6 } : undefined}>
                    {esDescanso ? (
                      <strong>{bloque}</strong>
                    ) : editando ? (
                      <div>
                        <select value={cell.asignatura || ""} onChange={(e) => actualizarCelda(fila, columna, "asignatura", e.target.value)}>
                          <option value="">Asignatura</option>
                          {asignaturas.map((a) => (<option key={a} value={a}>{a}</option>))}
                        </select>
                        <select value={cell.nivel || ""} onChange={(e) => actualizarCelda(fila, columna, "nivel", e.target.value)}>
                          <option value="">Nivel</option>
                          {niveles.map((n) => (<option key={n} value={n}>{n}</option>))}
                        </select>
                        <select value={cell.seccion || ""} onChange={(e) => actualizarCelda(fila, columna, "seccion", e.target.value)}>
                          <option value="">Seccion</option>
                          {secciones.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>

                        <div style={{ marginTop: 6, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                          <button
                            type="button"
                            onClick={() => ponerUnidadSeleccionada(fila, columna)}
                            disabled={!seleccion}
                            style={{ padding: ".25rem .5rem", borderRadius: 6, border: "1px solid #e5e7eb", background:"#fff", cursor: seleccion ? "pointer" : "not-allowed" }}
                            title={seleccion ? "Colocar la unidad seleccionada en esta celda" : "Elige primero una unidad en el panel superior"}
                          >
                            Poner Unidad Seleccionada
                          </button>

                          <button
                            type="button"
                            onClick={() => goConfigurarObjetivos(fila, columna)}
                            style={{ padding: ".25rem .5rem", borderRadius: 6, border: "1px solid #e5e7eb", background:"#fff", cursor:"pointer" }}
                            title="Definir orden y duración de objetivos de esta unidad"
                          >
                            Configurar objetivos
                          </button>

                          {cell.unidad && (
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                              <b>Unidad:</b> {cell.unidad}
                            </div>
                          )}
                        </div>

                        {/* — NUEVO: Selector planificaciones (combo + chips) */}
                        <SelectorPlanificacionInline
                          fila={fila}
                          columna={columna}
                          asignatura={cell.asignatura}
                          nivel={cell.nivel}
                          seccion={cell.seccion}
                          unidadesUsuario={unidadesUsuario}
                          actualizarCelda={actualizarCelda}
                          onSaved={() => {}}
                        />
                      </div>
                    ) : (
                      <div style={{ backgroundColor: asignaturasEspeciales.includes(cell.asignatura) ? "#fff3cd" : "transparent", padding: "0.5rem", borderRadius: "5px" }}>
                        <div><strong>{cell.asignatura}</strong></div>
                        <div>{cell.nivel} {cell.seccion}</div>
                        {cell.unidad && <div style={{ fontSize:12, color:"#64748b" }}><b>Unidad:</b> {cell.unidad}</div>}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {editando && (
        <div style={{ marginTop: "1rem" }}>
          <button
            onClick={guardarHorario}
            disabled={!auth.currentUser}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "5px", marginRight: "1rem", opacity: !auth.currentUser ? .6 : 1 }}
          >
            {auth.currentUser ? "Guardar Horario" : "Conectando..."}
          </button>
          <button onClick={pruebaManual} style={{ padding: "0.5rem 1rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px" }}>
            Probar InicioClase
          </button>
          <button onClick={guardarHorarioYProbarInicio} style={{ padding: "0.5rem 1rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "5px", marginLeft: "1rem" }}>
            Guardar y Probar InicioClase
          </button>
        </div>
      )}
    </div>
  );
};

export default HorarioEditable;
