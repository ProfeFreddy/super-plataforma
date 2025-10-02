// src/pages/CierreClase.jsx
import React, { useEffect, useState, useMemo, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { db } from "../firebase";
import { getDoc, doc } from "firebase/firestore";
import CronometroGlobal from "../components/CronometroGlobal";
import NubeDePalabras from "../components/NubeDePalabras";
import QRCode from "react-qr-code";
import FichaClaseSticky from "../components/FichaClaseSticky";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";
import { getClaseVigente } from "../services/PlanificadorService";

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  doc as fsDoc
} from "firebase/firestore";
import {
  updateDoc,
  increment,
  query,
  orderBy,
  where,
  getDocs,
  writeBatch,
  deleteDoc
} from "firebase/firestore";

/* ­ƒöÉ auth (igual que en Desarrollo) */
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

/* Ô¼ç´©Å NUEVO: base del proxy (m├ís robusto, igual que en Desarrollo) */
const PROXY_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PROXY_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_PROXY_URL || process.env.VITE_PROXY_BASE)) ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8080");

/* ­ƒöñ helpers de normalizaci├│n y mapeo a slugs API MINEDUC (como en Desarrollo) */
const norm = (s = "") =>
  s.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
const ASIG_SLUGS = {
  matematica: "matematica",
  matematicas: "matematica",
  lenguaje: "lenguaje",
  "lenguaje y comunicacion": "lenguaje",
  "lengua y literatura": "lenguaje",
  fisica: "fisica",
  quimica: "quimica",
  historia: "historia",
  "historia y ciencias sociales": "historia",
  ingles: "ingles",
  biologia: "biologia",
  ciencias: "ciencias",
  tecnologia: "tecnologia",
};
function asigToSlug(asig = "") {
  const k = norm(asig);
  return ASIG_SLUGS[k] || "matematica";
}
function nivelToApi(cursoStr = "", prefer = "") {
  const s = norm(cursoStr || prefer);
  if (/basico|b[a├í]sico|b[a├í]sica|basica/i.test(s)) return "basica";
  return "media";
}

/* ===== helpers de tiempo y marcas ===== */
const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00";
function getNowForSchedule() {
  return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date();
}
function colDeHoy() {
  const d = getNowForSchedule().getDay();
  return d >= 1 && d <= 5 ? d - 1 : 0;
}
function filaDesdeMarcas(marcas = []) {
  const now = getNowForSchedule();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < (marcas.length - 1); i++) {
    const start = (marcas[i][0] * 60) + marcas[i][1];
    const end   = (marcas[i+1][0] * 60) + marcas[i+1][1];
    if (mins >= start && mins < end) return i;
  }
  return 0;
}
function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object") {
    return cfg.marcas.map(x => [Number(x.h) || 0, Number(x.m) || 0]);
  }
  if (Array.isArray(cfg.marcasStr)) {
    return cfg.marcasStr.map(s => {
      const [h,m] = String(s).split(':').map(n => Number(n)||0);
      return [h,m];
    });
  }
  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) {
    const startTimes = cfg.bloquesGenerados.map(b => String(b).split(' - ')[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(' - ')[1];
    return [...startTimes, lastEnd].map(s => {
      const [h,m] = s.split(':').map(n => Number(n)||0);
      return [h,m];
    });
  }
  return [];
}

/* ===== estilos ===== */
const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  white: "#ffffff",
  textDark: "#1f2937",
  textMuted: "#475569",
  border: "#e5e7eb",
  btnText: "#2193b0",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: "2rem",
  fontFamily: "Segoe UI, sans-serif",
  color: COLORS.white,
  boxSizing: "border-box",
};

const row = (gap = "1rem") => ({
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)",
  gap,
  alignItems: "stretch",
});

const card = {
  background: COLORS.white,
  color: COLORS.textDark,
  borderRadius: 12,
  padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
  border: `1px solid ${COLORS.border}`,
  maxWidth: "100%",
  overflow: "hidden",
  contain: "content",
  minWidth: 0,
};

/* Ôøæ´©Å NUEVO: forzamos capa propia y antialias consistente (anti-parpadeo) */
const layerFix = {
  willChange: "transform",
  transform: "translateZ(0)",
  backfaceVisibility: "hidden",
  WebkitFontSmoothing: "antialiased",
  textRendering: "optimizeLegibility",
};

const btnWhite = {
  background: COLORS.white,
  color: COLORS.btnText,
  border: "none",
  borderRadius: 10,
  padding: ".6rem .9rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,.15)",
};

const input = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  fontSize: "0.95rem",
  outline: "none",
};

const smallMuted = { color: COLORS.textMuted, fontSize: 12 };

// Centro de Juegos
const GAMES = [
  { key: "pragma", name: "Carrera PRAGMA (en esta p├ígina)", desc: "Juego nativo de la plataforma. Publica rondas y muestra ranking.", type: "internal" },
  { key: "blooket", name: "Blooket", desc: "Lanza sets y comparte PIN con tu clase. Requiere tu cuenta.", type: "external", url: "https://dashboard.blooket.com/discover", premium: true },
  { key: "decktoys", name: "Deck.Toys", desc: "Rutas y tableros interactivos. Requiere tu cuenta.", type: "external", url: "https://deck.toys/teacher", premium: true },
  { key: "classcraft", name: "Classcraft", desc: "Gamificaci├│n del curso a largo plazo. Requiere tu cuenta.", type: "external", url: "https://game.classcraft.com", premium: true },
];

// ­ƒöÉ llave para el cron├│metro del CIERRE
const CIERRE_TIMER_KEY = "crono:cierre:v2";

// ­ƒÆÑ limpiar llaves de cronos
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

const isPlaceholder = (v) => /^\(sin/i.test(String(v || ""));

/* ========== Subcomponentes MEMOIZADOS anti-parpadeo ========== */
const HoraActualText = React.memo(function HoraActualText() {
  const [t, setT] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  // Ô¼ç´©Å Aplicamos clases anti-jitter sin eliminar nada
  return <span className="tnum clock-w">{t}</span>;
});

const DatosClaseCard = React.memo(function DatosClaseCard({
  unidad, objetivo, curso, asignatura
}) {
  return (
    <div style={{ ...card, textAlign: "center", ...layerFix }}>
      <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 6 }}>
        Unidad
      </div>
      <div style={{ marginBottom: 6, ...layerFix }}>
        <strong>{unidad || "(sin unidad)"}</strong>
      </div>
      <div style={{ marginTop: 4, color: COLORS.textDark, ...layerFix }}>
        <strong>Objetivo:</strong> {objetivo}
      </div>
      {/* Ô¼ç´©Å L├¡nea problem├ítica aislada en su propia capa */}
      <div style={{ marginTop: 10, color: COLORS.textMuted, ...layerFix }}>
        <strong>Curso:</strong> {curso} &nbsp;|&nbsp; <strong>Asignatura:</strong> {asignatura}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.unidad === next.unidad &&
  prev.objetivo === next.objetivo &&
  prev.curso === next.curso &&
  prev.asignatura === next.asignatura
);

const ProfesorCard = React.memo(function ProfesorCard({
  nombreProfesor, asignatura
}) {
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: ".6rem", ...layerFix }}>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <button style={btnWhite}>Ô£ï</button>
        <button style={btnWhite}>­ƒæÅ</button>
      </div>
      <div style={{ textAlign: "right" }}>
        {/* Ô¼ç´©Å Ambos textos con capa propia */}
        <div style={{ fontWeight: 800, ...layerFix }}>{nombreProfesor}</div>
        <div style={{ color: COLORS.textMuted, ...layerFix }}>{asignatura}</div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.nombreProfesor === next.nombreProfesor &&
  prev.asignatura === next.asignatura
);

/* ========================= COMPONENTE ========================= */
export default function CierreClase({ duracion = 10 }) {
  const navigate = useNavigate();

  const planCtx = useContext(PlanContext) || {};
  const { user = null, plan = "FREE", caps = PLAN_CAPS.FREE, loading = false } = planCtx;

  const [horaActual, setHoraActual] = useState(""); // compat
  const [nombreProfesor, setNombreProfesor] = useState("Profesor");
  const [asignatura, setAsignatura] = useState("(sin asignatura)");
  const [curso, setCurso] = useState("(sin curso)");
  const [unidad, setUnidad] = useState("");
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [objetivo, setObjetivo] = useState("(sin objetivo)");

  useEffect(() => {}, []);

  const [claseVigente, setClaseVigente] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await getClaseVigente(new Date());
        setClaseVigente(res);
        if (res?.unidad && !unidad) setUnidad(res.unidad);
        if (res?.asignatura && asignatura === "(sin asignatura)") setAsignatura(res.asignatura);
        if (res?.objetivo && objetivo === "(sin objetivo)") setObjetivo(res.objetivo);
      } catch(e) {
        console.error("[Cierre] getClaseVigente:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ­ƒöÆ Candado visual: conserva el ├║ltimo valor no-placeholder para evitar ÔÇ£rebotesÔÇØ
  const lastGoodAsignaturaRef = useRef(null);
  useEffect(() => {
    if (asignatura && !isPlaceholder(asignatura)) {
      lastGoodAsignaturaRef.current = asignatura;
    }
  }, [asignatura]);
  const asignaturaStable = lastGoodAsignaturaRef.current || asignatura;

  // Ô¼ç´©Å NUEVO: asegurar sesi├│n an├│nima (igual que en Desarrollo)
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          const cred = await signInAnonymously(auth);
          localStorage.setItem("uid", cred.user.uid);
          setAuthed(true);
        } else {
          localStorage.setItem("uid", u.uid);
          setAuthed(true);
        }
      } catch (e) {
        console.error("[Cierre] auth error:", e);
        // si ya hay uid en LS, permitimos continuar para no romper UX
        if (localStorage.getItem("uid")) setAuthed(true);
      }
    });
    return () => unsub();
  }, []);

  // Sesi├│n juego
  const [sessionId, setSessionId] = useState("");
  const joinURL = useMemo(() => {
    const base = window.location.origin.replace(/\/$/, "");
    return sessionId ? `${base}/participa?session=${encodeURIComponent(sessionId)}` : `${base}/participa`;
  }, [sessionId]);

  // Juego: estado
  const [pregunta, setPregunta] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [panelTexto, setPanelTexto] = useState("");
  const [panelOpciones, setPanelOpciones] = useState(["", "", "", ""]);
  const [panelCorrecta, setPanelCorrecta] = useState(0);
  const [publicando, setPublicando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [ronda, setRonda] = useState(0);

  // Datos base
  useEffect(() => {
    if (!authed) return;
    const obtenerDatos = async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
        if (!uid) return;

        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        if (usnap.exists()) {
          setNombreProfesor(usnap.data()?.nombre || "Profesor");
        }

        const pref = doc(db, "profesores", uid);
        const psnap = await getDoc(pref);
        if (psnap.exists()) {
          const data = psnap.data() || {};
          const unidadInicial = data.unidadInicial || "";
          setUnidad((u) => u || unidadInicial);

          // Ô£à No degradar a "(sin asignatura)" si no hay dato
          if (data.asignatura && !isPlaceholder(data.asignatura)) {
            setAsignatura((a) => (isPlaceholder(a) ? data.asignatura : a));
          }

          setCurso((c) => (c === "(sin curso)" ? (data.curso || "(sin curso)") : c));
          if (data.objetivo) setObjetivo(data.objetivo);
          else if (data.objetivoInicial) setObjetivo(data.objetivoInicial);

          // OA din├ímico por asignatura/nivel + proxy
          if (unidadInicial && !oaMinisterio) {
            try {
              const asigSlug = asigToSlug(data.asignatura || asignatura || "Matem├ítica");
              const nivelApi = nivelToApi(data.curso || curso, claseVigente?.nivel || "");
              const proxyUrl = `${PROXY_BASE}/mineduc?asignatura=${encodeURIComponent(
                asigSlug
              )}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadInicial)}`;
              const rProxy = await axios.get(proxyUrl);
              const firstProxy = Array.isArray(rProxy.data) ? rProxy.data[0] : null;
              if (firstProxy) {
                setOaMinisterio(firstProxy);
              } else {
                throw new Error("Proxy sin resultados, intento directo");
              }
            } catch (e) {
              try {
                const asigSlug = asigToSlug(data.asignatura || asignatura || "Matem├ítica");
                const nivelApi = nivelToApi(data.curso || curso, claseVigente?.nivel || "");
                const directUrl = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(
                  asigSlug
                )}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadInicial)}`;
                const oaResponse = await axios.get(directUrl);
                setOaMinisterio(Array.isArray(oaResponse.data) ? oaResponse.data[0] : null);
              } catch (e2) {
                // ===== Copia original (NO eliminada) ÔÇö hardcode matem├ítica/media =====
                // try {
                //   const oaResponse = await axios.get(
                //     `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=matematica&nivel=media&unidad=${encodeURIComponent(unidadInicial)}`
                //   );
                //   setOaMinisterio(Array.isArray(oaResponse.data) ? oaResponse.data[0] : null);
                // } catch (e) {}
              }
            }
          }
        }

        // horarioConfig.marcas ÔåÆ clases_detalle/{slot}
        try {
          if (usnap.exists()) {
            const cfg = usnap.data()?.horarioConfig || {};
            const marcas = getMarcasFromConfig(cfg);
            if (Array.isArray(marcas) && marcas.length > 1) {
              const fila = filaDesdeMarcas(marcas);
              const col = colDeHoy();
              const slotId = `${fila}-${col}`;
              const dref = doc(db, "clases_detalle", uid, "slots", slotId);
              const dsnap = await getDoc(dref);
              if (dsnap.exists()) {
                const det = dsnap.data() || {};
                if (det.unidad && !unidad) setUnidad(det.unidad);
                if (det.objetivo && objetivo === "(sin objetivo)") setObjetivo(det.objetivo);
                if (det.asignatura && asignatura === "(sin asignatura)") setAsignatura(det.asignatura);
                if (det.curso && curso === "(sin curso)") setCurso(det.curso);
              }
            }
          }
        } catch (e) {
          console.warn("[Cierre] horarioConfig ÔåÆ clases_detalle:", e?.code || e?.message);
        }

        // slot semilla 0-0
        try {
          const slotRef = doc(db, "clases_detalle", uid, "slots", "0-0");
          const slotSnap = await getDoc(slotRef);
          if (slotSnap.exists()) {
            const s = slotSnap.data() || {};
            if (!unidad && s.unidad) setUnidad(s.unidad);
            if (objetivo === "(sin objetivo)" && s.objetivo) setObjetivo(s.objetivo);
            if (asignatura === "(sin asignatura)" && s.asignatura) setAsignatura(s.asignatura);
            if (curso === "(sin curso)" && s.curso) setCurso(s.curso);
          }
        } catch (e) {}
      } catch (err) {
        console.error("Error cargando datos de Cierre:", err);
      }
    };
    obtenerDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Fallback extra desde usuarios/{uid}
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
        if (!uid) return;
        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        if (usnap.exists()) {
          const u = usnap.data() || {};
          if (!unidad || /^\(sin/i.test(unidad)) setUnidad(u.unidadInicial || u.unidad || "");
          if (asignatura === "(sin asignatura)" && u.asignatura) setAsignatura(u.asignatura);
          if (curso === "(sin curso)" && u.curso) setCurso(u.curso);
          if (objetivo === "(sin objetivo)" && u.objetivo) setObjetivo(u.objetivo);
        }
      } catch (e) {
        console.warn("[Cierre] usuarios fallback:", e?.code || e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Suscripciones en tiempo real (una sola vez) + setters funcionales
  useEffect(() => {
    if (!authed) return;
    const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
    if (!uid) return;

    const applyClase = (d) => {
      if (!d) return;

      if (d.nombre) {
        setNombreProfesor(prev => d.nombre && d.nombre !== prev ? d.nombre : prev);
      }

      setUnidad(prev => (d.unidad && d.unidad !== prev ? d.unidad : prev));

      setAsignatura(prev =>
        d.asignatura && !isPlaceholder(d.asignatura) && d.asignatura !== prev ? d.asignatura : prev
      );

      setCurso(prev =>
        d.curso && !isPlaceholder(d.curso) && d.curso !== prev ? d.curso : prev
      );

      setObjetivo(prev =>
        d.objetivo && !isPlaceholder(d.objetivo) && d.objetivo !== prev ? d.objetivo : prev
      );
    };

    const unsubs = [];

    try {
      const r1 = fsDoc(db, "clases_detalle", uid, "meta", "actual");
      unsubs.push(onSnapshot(r1, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r2 = fsDoc(db, "clases_detalle", uid, "actual", "info");
      unsubs.push(onSnapshot(r2, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r3 = fsDoc(db, "clases_detalle", uid, "slots", "0-0");
      unsubs.push(onSnapshot(r3, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r4 = fsDoc(db, "profesores", uid);
      unsubs.push(onSnapshot(r4, (s) => {
        if (!s.exists()) return;
        applyClase({
          nombre: s.data()?.nombre,
          unidad: s.data()?.unidad || s.data()?.unidadInicial,
          objetivo: s.data()?.objetivo || s.data()?.objetivoInicial,
          asignatura: s.data()?.asignatura,
          curso: s.data()?.curso
        });
      }));
    } catch (e) {}

    return () => unsubs.forEach((u) => typeof u === "function" && u());
  }, [authed]);

  // Session para carrera
  useEffect(() => {
    if (!authed) return;
    const ensureSession = async () => {
      try {
        const sref = doc(db, "carrera", "actual", "meta", "session");
        const snap = await getDoc(sref);
        if (snap.exists() && snap.data()?.id) {
          setSessionId(String(snap.data().id));
        } else {
          const newId = Math.random().toString(36).slice(2, 8).toUpperCase();
          await setDoc(
            sref,
            { id: newId, createdAt: serverTimestamp() },
            { merge: true }
          );
          setSessionId(newId);
        }
      } catch (e) {
        console.error("No se pudo crear/leer la sesi├│n:", e);
      }
    };
    ensureSession();
  }, [authed]);

  // Pregunta activa
  useEffect(() => {
    if (!authed) return;
    const ref = doc(db, "carrera", "actual", "meta", "pregunta");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setPregunta(snap.data());
      else setPregunta(null);
    });
    return () => unsub();
  }, [authed]);

  // Participantes
  useEffect(() => {
    if (!authed) return;
    let qRef;
    if (sessionId) {
      qRef = query(
        collection(db, "carrera", "actual", "participantes"),
        where("session", "==", sessionId),
        orderBy("progreso", "desc")
      );
    } else {
      qRef = query(
        collection(db, "carrera", "actual", "participantes"),
        orderBy("progreso", "desc")
      );
    }
    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipantes(list);
    });
    return () => unsub();
  }, [sessionId, authed]);

  // Respuestas
  useEffect(() => {
    if (!authed) return;
    if (!pregunta?.activa) return;

    let qRef;
    if (sessionId) {
      qRef = query(
        collection(db, "carrera", "actual", "respuestas"),
        where("scored", "!=", true),
        where("session", "==", sessionId)
      );
    } else {
      qRef = query(
        collection(db, "carrera", "actual", "respuestas"),
        where("scored", "!=", true)
      );
    }

    const unsub = onSnapshot(qRef, async (snap) => {
      if (procesando) return;
      setProcesando(true);

      const toProcess = [];
      const startMs = pregunta?.startAt?.toMillis ? pregunta.startAt.toMillis() : null;

      snap.docChanges().forEach((chg) => {
        if (chg.type === "added" || chg.type === "modified") {
          const data = chg.doc.data();
          if (startMs && data.createdAt?.toMillis && data.createdAt.toMillis() < startMs) return;
          if (data.scored === true) return;
          toProcess.push({ id: chg.doc.id, data });
        }
      });

      for (const item of toProcess) {
        try {
          await scoreAnswer(item.id, item.data);
        } catch (e) {
          console.error("Error scoring:", e);
        }
      }
      setProcesando(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta?.activa, pregunta?.startAt, ronda, sessionId, authed]);

  const publicarPregunta = async () => {
    if (!panelTexto.trim()) return;

    const opcionesLimpias = panelOpciones.map((x) => x.trim()).filter((x) => x.length > 0);
    if (opcionesLimpias.length > 0 && (panelCorrecta < 0 || panelCorrecta >= opcionesLimpias.length)) {
      alert("Selecciona el ├¡ndice de la respuesta correcta v├ílido.");
      return;
    }

    setPublicando(true);
    try {
      await setDoc(
        doc(db, "carrera", "actual", "meta", "pregunta"),
        {
          texto: panelTexto.trim(),
          opciones: opcionesLimpias.length > 0 ? opcionesLimpias : [],
          correcta: opcionesLimpias.length > 0 ? panelCorrecta : null,
          startAt: serverTimestamp(),
          activa: true,
          session: sessionId || null,
        },
        { merge: true }
      );
      setRonda((r) => r + 1);
    } catch (e) {
      console.error(e);
      alert("No se pudo publicar la pregunta.");
    } finally {
      setPublicando(false);
    }
  };

  const cerrarRonda = async () => {
    try {
      await updateDoc(doc(db, "carrera", "actual", "meta", "pregunta"), { activa: false });
    } catch (e) {
    }
  };

  async function scoreAnswer(respId, respData) {
    const { pid, answer, latencyMs } = respData;
    if (!pid) {
      await updateDoc(doc(db, "carrera", "actual", "respuestas", respId), { scored: true, points: 0 });
      return;
    }

    let points = 0;
    if (Array.isArray(pregunta?.opciones) && pregunta.opciones.length > 0 && typeof pregunta?.correcta === "number") {
      const correcta = pregunta.opciones[pregunta.correcta];
      const esCorrecta = String(answer).trim() === String(correcta).trim();
      if (esCorrecta) {
        const latS = typeof latencyMs === "number" ? latencyMs / 1000 : 8;
        const bonus = Math.max(0, 8 - Math.floor(latS));
        points = 5 + bonus;
      } else {
        points = 0;
      }
    } else {
      const latS = typeof latencyMs === "number" ? latencyMs / 1000 : 8;
      const bonus = Math.max(0, 5 - Math.floor(latS));
      points = 2 + bonus;
    }

    try {
      await updateDoc(doc(db, "carrera", "actual", "participantes", pid), {
        puntos: increment(points),
        progreso: increment(points),
      });
    } catch (e) {
      await setDoc(
        doc(db, "carrera", "actual", "participantes", pid),
        {
          nombre: respData.nombre || "Jugador",
          avatar: "­ƒÅü",
          progreso: points,
          puntos: points,
          joinedAt: serverTimestamp(),
          session: sessionId || null,
        },
        { merge: true }
      );
    }

    await updateDoc(doc(db, "carrera", "actual", "respuestas", respId), {
      scored: true,
      points,
    });
  }

  const ranking = useMemo(() => {
    return [...participantes].sort((a, b) => (b.progreso || 0) - (a.progreso || 0));
  }, [participantes]);

  const resetCarrera = async () => {
    const ok = window.confirm("┬┐Resetear carrera? Se borrar├ín participantes y respuestas, y se reiniciar├í la pregunta.");
    if (!ok) return;

    try {
      let pQ = collection(db, "carrera", "actual", "participantes");
      let pSnap = sessionId ? await getDocs(query(pQ, where("session", "==", sessionId))) : await getDocs(pQ);
      const batch1 = writeBatch(db);
      pSnap.forEach((d) => batch1.delete(d.ref));
      await batch1.commit();

      let rQ = collection(db, "carrera", "actual", "respuestas");
      let rSnap = sessionId ? await getDocs(query(rQ, where("session", "==", sessionId))) : await getDocs(rQ);
      const batch2 = writeBatch(db);
      rSnap.forEach((d) => batch2.delete(d.ref));
      await batch2.commit();

      await setDoc(
        doc(db, "carrera", "actual", "meta", "pregunta"),
        {
          texto: "",
          opciones: [],
          correcta: null,
          activa: false,
          startAt: serverTimestamp(),
          session: sessionId || null,
        },
        { merge: true }
      );

      setPanelTexto("");
      setPanelOpciones(["", "", "", ""]);
      setPanelCorrecta(0);
      setRonda((r) => r + 1);
      alert("Carrera reseteada Ô£à");
    } catch (e) {
      alert("No se pudo resetear la carrera.");
    }
  };

  const openExternal = (baseUrl) => {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("utm_source", "pragma");
      url.searchParams.set("utm_medium", "launcher");
      url.searchParams.set("utm_campaign", "cierre");
      const sala = localStorage.getItem("salaCode") || "";
      if (sala) url.searchParams.set("code", sala);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (e) {
      window.open(baseUrl, "_blank", "noopener,noreferrer");
    }
  };
  const goToCarrera = () => {
    try {
      const el = document.getElementById("carreraPanel");
      if (el?.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {}
  };

  const cronometroPropsCierre = {
    duracion,
    storageKey: CIERRE_TIMER_KEY,
    instanceId: "cierre"
  };

  return (
    <div style={page} className="no-scroll-jump">
      {/* Banner plan/clase vigente */}
      {claseVigente && (
        <div
          style={{
            ...card,
            marginBottom: "1rem",
            background: claseVigente.fuente === "calendario" ? "rgba(124,58,237,.06)" : "rgba(2,132,199,.06)"
          }}
        >
          <div style={{fontWeight:800}}>
            {claseVigente.fuente === "calendario" ? "Plan semanal (vigente)" :
             claseVigente.fuente === "slots" ? "Horario (fallback)" : "Sin clase planificada"}
          </div>
          {claseVigente.unidad && <div><b>Unidad:</b> {claseVigente.unidad}{claseVigente.evaluacion ? " ┬À (Evaluaci├│n)" : ""}</div>}
          {claseVigente?.objetivo && <div><b>Objetivo:</b> {claseVigente.objetivo}</div>}
        </div>
      )}

      {/* Fila 1 */}
      <div style={{ ...row("1rem"), marginBottom: "1rem" }}>
        <div style={{ ...card, ...layerFix }} className="no-scroll-jump layer-accel">
          <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>Cierre</div>
          <div style={{ color: COLORS.textMuted, marginBottom: 8 }}>
            ­ƒòÆ <HoraActualText />
          </div>
          {/* Crono en su propia capa y con d├¡gitos tabulares + ancho fijo */}
          <div
            className="tnum clock-w layer-accel"
            style={{
              fontVariantNumeric: "tabular-nums lining-nums",
              fontFeatureSettings: "'tnum' 1, 'lnum' 1",
              transform: "translateZ(0)",
              willChange: "transform",
              backfaceVisibility: "hidden"
            }}
          >
            <CronometroGlobal {...cronometroPropsCierre} />
          </div>
        </div>

        <DatosClaseCard
          unidad={unidad}
          objetivo={objetivo}
          curso={curso}
          asignatura={asignaturaStable}
        />

        <ProfesorCard
          nombreProfesor={nombreProfesor}
          asignatura={asignaturaStable}
        />
      </div>

      {/* Nube de palabras */}
      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Ôÿü´©Å Nube de palabras final</h3>
        <NubeDePalabras modo="cierre" />
      </div>

      {/* QR sesi├│n */}
      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>­ƒô▓ ├Ünete a la carrera</h3>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
            <QRCode value={joinURL} size={160} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Sesi├│n: {sessionId || "ÔÇö"}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 6 }}>
              Abre <code>/participa</code> o escanea el QR. Link directo:
            </div>
            <code style={{ fontSize: 12, color: COLORS.textMuted }}>{joinURL}</code>
          </div>
        </div>
      </div>

      {/* Centro de Juegos */}
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>­ƒÄ« Centro de Juegos</h3>
        <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 8 }}>
          Los juegos externos se abren en pesta├▒a nueva y requieren tu propia cuenta.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
          {GAMES.map((g) => (
            <div key={g.key} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800 }}>
                {g.name} {g.premium ? <span style={{ fontSize: 12, color: "#9333ea" }}>┬À Premium</span> : null}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>{g.desc}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {g.type === "internal" ? (
                  <button style={btnWhite} onClick={goToCarrera}>­ƒÅü Ir a Carrera</button>
                ) : (
                  <>
                    <button style={btnWhite} onClick={() => openExternal(g.url)}>­ƒîÉ Abrir</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Juego: panel + ranking */}
      <div id="carreraPanel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>­ƒÄ« Mini panel del profesor</h3>
          <div style={{ ...smallMuted, marginBottom: 8 }}>
            Publica una pregunta (texto + 0ÔÇô4 opciones). Si agregas opciones, selecciona cu├íl es la correcta.
          </div>

          <label style={{ fontWeight: 700 }}>Pregunta</label>
          <input
            style={{ ...input, marginBottom: 8 }}
            value={panelTexto}
            onChange={(e) => setPanelTexto(e.target.value)}
            placeholder="Escribe la preguntaÔÇª"
          />

          <label style={{ fontWeight: 700 }}>Opciones (opcional)</label>
          {panelOpciones.map((op, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input
                type="radio"
                name="correcta"
                checked={panelCorrecta === i}
                onChange={() => setPanelCorrecta(i)}
                title="Marcar correcta"
              />
              <input
                style={input}
                value={op}
                onChange={(e) => {
                  const arr = [...panelOpciones];
                  arr[i] = e.target.value;
                  setPanelOpciones(arr);
                }}
                placeholder={`Opci├│n ${i + 1}`}
              />
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              style={btnWhite}
              onClick={publicarPregunta}
              disabled={publicando}
              title="Publicar pregunta"
            >
              ­ƒÜÇ Publicar ronda
            </button>
            <button
              style={btnWhite}
              onClick={cerrarRonda}
              title="Cerrar ronda"
            >
              Ôøö Cerrar ronda
            </button>
          </div>

          <div style={{ ...smallMuted, marginTop: 8 }}>
            {pregunta?.activa ? "Ronda ACTIVA" : "Ronda INACTIVA"} {pregunta?.texto ? `ÔÇó "${pregunta.texto}"` : ""}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ marginTop: 0 }}>­ƒÅü Carrera en vivo</h3>
          <div style={{ ...smallMuted, marginBottom: 8 }}>
            Avance = acierto (5 pts) + bonus por rapidez (hasta +8). Participaci├│n abierta: peque├▒o avance.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {ranking.length === 0 && (
              <div style={{ color: COLORS.textMuted }}>
                A├║n no hay participantes. Pide a tus estudiantes abrir <code>/participa</code>.
              </div>
            )}
            {ranking.map((p) => {
              const prog = Math.min(100, Math.round((p.progreso || 0)));
              return (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ textAlign: "center", fontSize: 20 }}>{p.avatar || "­ƒÅü"}</div>
                  <div style={{ background: "#eef2f7", borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                    <div
                      style={{
                        width: `${prog}%`,
                        background: `linear-gradient(90deg, ${COLORS.brandA}, ${COLORS.brandB})`,
                        color: "#fff",
                        padding: "6px 10px",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                      title={`${p.nombre} (${prog} pts)`}
                    >
                      <strong style={{ fontSize: 12 }}>{p.nombre || "Jugador"}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 800 }}>{p.progreso || 0}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fila 4 */}
      <div style={{ textAlign: "center", display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          onClick={resetCarrera}
          style={btnWhite}
          title="Borrar participantes, respuestas y reiniciar pregunta"
        >
          ­ƒº╣ Reset carrera
        </button>
        <button
          onClick={() => {
            clearAllCountdowns();
            navigate("/inicio", { replace: true, state: { resetTimers: true, from: "cierre" } });
          }}
          style={btnWhite}
        >
          Ô¼à´©Å Volver al Inicio
        </button>
      </div>
    </div>
  );
}
