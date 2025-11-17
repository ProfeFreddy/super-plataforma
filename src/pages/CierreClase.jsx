// src/pages/CierreClase.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useContext,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { db, auth } from "../firebase";
import {
  getDoc,
  doc,
  collection,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import CronometroGlobal from "../components/CronometroGlobal";
import NubeDePalabras from "../components/NubeDePalabras";
import QRCode from "react-qr-code";
import FichaClaseSticky from "../components/FichaClaseSticky";

// 🔥 NUEVO: portada del juego PRAGMA (Remy corriendo)
import portadaCarreraPragma from "../assets/pragmaprofe-carrera.png";

// ✅ Import directo, sin compat rara
import { PlanContext } from "../context/PlanContext";

import { PLAN_CAPS } from "../lib/planCaps";
import { getClaseVigente } from "../services/PlanificadorService";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

/* ============================================================
   Hook seguro de auth (reemplaza al viejo useAuthX roto)
   ============================================================ */
function useAuthSafe() {
  const [ready, setReady] = useState(false);
  const [userObj, setUserObj] = useState(auth.currentUser || null);

  useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) {
          // si no hay usuario, creamos un anónimo
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUserObj(cred.user || null);
          localStorage.setItem("uid", cred.user?.uid || "");
          setReady(true);
        } else {
          setUserObj(u);
          localStorage.setItem("uid", u.uid);
          setReady(true);
        }
      } catch (err) {
        console.error("[CierreClase] useAuthSafe error:", err);
        setUserObj(null);
        if (localStorage.getItem("uid")) {
          setReady(true);
        } else {
          setReady(true);
        }
      }
    });

    return () => {
      alive = false;
      unsub && unsub();
    };
  }, []);

  return { ready, user: userObj };
}

/* ============================================================
   Base del proxy para OA MINEDUC
   ============================================================ */
const PROXY_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PROXY_BASE) ||
  "";

/* ============================================================
   Endpoint IA Carrera
   ============================================================ */
const IA_CARRERA_ENDPOINT =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_IA_CARRERA_ENDPOINT) ||
  (typeof window !== "undefined" &&
  window.location.origin.includes("localhost:5173")
    ? "http://localhost:8080/api/ia-carrera/genera"
    : "/api/ia-carrera/genera");

/* ============================================================
   Helpers de normalización / asignatura / nivel
   ============================================================ */
const norm = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

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
  if (/basico|b[aí]sico|b[aí]sica|basica/i.test(s)) return "basica";
  return "media";
}

/* ============================================================
   Helpers de tiempo y marcas (para detectar bloque actual)
   ============================================================ */
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
  for (let i = 0; i < marcas.length - 1; i++) {
    const start = marcas[i][0] * 60 + marcas[i][1];
    const end = marcas[i + 1][0] * 60 + marcas[i + 1][1];
    if (mins >= start && mins < end) return i;
  }
  return 0;
}

function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object") {
    return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  }
  if (Array.isArray(cfg.marcasStr)) {
    return cfg.marcasStr.map((s) => {
      const [h, m] = String(s)
        .split(":")
        .map((n) => Number(n) || 0);
      return [h, m];
    });
  }
  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) {
    const startTimes = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...startTimes, lastEnd].map((s) => {
      const [h, m] = s.split(":").map((n) => Number(n) || 0);
      return [h, m];
    });
  }
  return [];
}

/* ============================================================
   Estilos / UI
   ============================================================ */
const COLORS = {
  brandA: "#1b75a6",
  brandB: "#60c3eb",
  white: "#ffffff",
  textDark: "#0f172a",
  textMuted: "#334155",
  border: "#e5e7eb",
  btnText: "#164e63",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(110deg, ${COLORS.brandA}, ${COLORS.brandB})`,
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
  boxShadow:
    "0 10px 24px rgba(16,24,40,.12), 0 4px 10px rgba(16,24,40,.06)",
  border: `1px solid ${COLORS.border}`,
  maxWidth: "100%",
  overflow: "hidden",
  contain: "content",
  minWidth: 0,
};

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
  boxShadow: "0 6px 14px rgba(0,0,0,.18)",
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

/* ============================================================
   SHOWTIME_PRESET para NubeDePalabras
   ============================================================ */
const SHOWTIME_PRESET = {
  id: "showtime",
  colors: ["#0f172a", "#0ea5e9", "#22c55e", "#ef4444", "#f59e0b", "#a855f7"],
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontWeight: [600, 800],
  fontSizes: [18, 72],
  padding: 1,
  spiral: "rectangular",
  shuffle: true,
  rotate: {
    mode: "steep",
    angles: [-90, -60, -30, 0, 30, 60, 90],
    probabilityTilted: 0.75,
  },
  contrastBoost: 1.25,
  rendering: { fontKerning: "none", pixelRatio: 1.0 },
};

/* ============================================================
   Centro de Juegos
   ============================================================ */
const GAMES = [
  {
    key: "juego1",
    name: "Trivia relámpago",
    desc: "Juego de preguntas y respuestas rápidas. Versión en desarrollo.",
    type: "comingSoon",
  },
  {
    key: "juego2",
    name: "Rompebloques PRAGMA",
    desc: "Rompe bloques respondiendo acertijos. Versión en desarrollo.",
    type: "comingSoon",
  },
  {
    key: "juego3",
    name: "Memoria matemática",
    desc: "Encuentra parejas de operaciones y resultados. Versión en desarrollo.",
    type: "comingSoon",
  },
  {
    key: "juego4",
    name: "Ruleta de desafíos",
    desc: "Gira la ruleta y resuelve el reto. Versión en desarrollo.",
    type: "comingSoon",
  },
  {
    key: "pragma",
    name: "Carrera PRAGMA",
    desc: "Juego nativo de la plataforma. Publica rondas, recibe respuestas y muestra el ranking en vivo.",
    type: "internal",
  },
];

/* ============================================================
   utilidades varias
   ============================================================ */

const CIERRE_TIMER_KEY = "crono:cierre:v2";

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

/* ============================================================
   Subcomponentes
   ============================================================ */
const HoraActualText = React.memo(function HoraActualText() {
  const [t, setT] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tnum clock-w">{t}</span>;
});

const DatosClaseCard = React.memo(
  function DatosClaseCard({ unidad, objetivo, curso, asignatura }) {
    return (
      <div style={{ ...card, textAlign: "center", ...layerFix }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: "1.2rem",
            marginBottom: 6,
          }}
        >
          Unidad
        </div>
        <div style={{ marginBottom: 6, ...layerFix }}>
          <strong>{unidad || "(sin unidad)"} </strong>
        </div>
        <div
          style={{
            marginTop: 4,
            color: COLORS.textDark,
            ...layerFix,
          }}
        >
          <strong>Objetivo:</strong> {objetivo}
        </div>
        <div
          style={{
            marginTop: 10,
            color: COLORS.textMuted,
            ...layerFix,
          }}
        >
          <strong>Curso:</strong> {curso} &nbsp;|&nbsp;{" "}
          <strong>Asignatura:</strong> {asignatura}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.unidad === next.unidad &&
    prev.objetivo === next.objetivo &&
    prev.curso === next.curso &&
    prev.asignatura === next.asignatura
);

const ProfesorCard = React.memo(
  function ProfesorCard({ nombreProfesor, asignatura }) {
    return (
      <div
        style={{
          ...card,
          display: "flex",
          flexDirection: "column",
          gap: ".6rem",
          ...layerFix,
        }}
      >
        <div style={{ display: "flex", gap: ".5rem" }}>
          <button style={btnWhite}>🧑‍🏫</button>
          <button style={btnWhite}>🎓</button>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, ...layerFix }}>{nombreProfesor}</div>
          <div style={{ color: COLORS.textMuted, ...layerFix }}>{asignatura}</div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.nombreProfesor === next.nombreProfesor &&
    prev.asignatura === next.asignatura
);

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function CierreClase({ duracion = 10 }) {
  const navigate = useNavigate();

  const planCtx = useContext(PlanContext) || {};
  const { plan = "FREE", caps = PLAN_CAPS.FREE } = planCtx; // caps reservado por si acaso

  const { ready: authReady, user: authUser } = useAuthSafe();

  const [nombreProfesor, setNombreProfesor] = useState("Profesor");
  const [asignatura, setAsignatura] = useState("(sin asignatura)");
  const [curso, setCurso] = useState("(sin curso)");
  const [unidad, setUnidad] = useState("");
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [objetivo, setObjetivo] = useState("(sin objetivo)");
  const [claseVigente, setClaseVigente] = useState(null);

  const lastGoodAsignaturaRef = useRef(null);
  useEffect(() => {
    if (asignatura && !isPlaceholder(asignatura)) {
      lastGoodAsignaturaRef.current = asignatura;
    }
  }, [asignatura]);
  const asignaturaStable = lastGoodAsignaturaRef.current || asignatura;

  useEffect(() => {
    (async () => {
      try {
        const res = await getClaseVigente(new Date());
        setClaseVigente(res);
        if (res?.unidad && !unidad) setUnidad(res.unidad);
        if (res?.asignatura && asignatura === "(sin asignatura)") setAsignatura(res.asignatura);
        if (res?.objetivo && objetivo === "(sin objetivo)") setObjetivo(res.objetivo);
      } catch (e) {
        console.error("[Cierre] getClaseVigente:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (!authReady) return;
    if (authUser || localStorage.getItem("uid")) {
      setAuthed(true);
    }
  }, [authReady, authUser]);

  /* ============================
     Sesión de juego / carrera
     ============================ */
  const [sessionId, setSessionId] = useState("");

  const joinURL = useMemo(() => {
    const base = window.location.origin.replace(/\/$/, "");
    return sessionId
      ? `${base}/participa?session=${encodeURIComponent(sessionId)}`
      : `${base}/participa`;
  }, [sessionId]);

  const [pregunta, setPregunta] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [panelTexto, setPanelTexto] = useState("");
  const [panelOpciones, setPanelOpciones] = useState(["", "", "", ""]);
  const [panelCorrecta, setPanelCorrecta] = useState(0);
  const [publicando, setPublicando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [ronda, setRonda] = useState(0);

  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState(null);

  /* ========================================================
     Cargar datos base del profe / clase desde Firestore
     ======================================================== */
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

          if (data.asignatura && !isPlaceholder(data.asignatura)) {
            setAsignatura((a) => (isPlaceholder(a) ? data.asignatura : a));
          }

          setCurso((c) => (c === "(sin curso)" ? data.curso || "(sin curso)" : c));

          if (data.objetivo) setObjetivo(data.objetivo);
          else if (data.objetivoInicial) setObjetivo(data.objetivoInicial);

          // OA MINEDUC vía proxy / directo
          if (unidadInicial && !oaMinisterio) {
            try {
              const asigSlug = asigToSlug(data.asignatura || asignatura || "Matemática");
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
                const asigSlug = asigToSlug(data.asignatura || asignatura || "Matemática");
                const nivelApi = nivelToApi(data.curso || curso, claseVigente?.nivel || "");
                const directUrl = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(
                  asigSlug
                )}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(
                  unidadInicial
                )}`;
                const oaResponse = await axios.get(directUrl);
                setOaMinisterio(
                  Array.isArray(oaResponse.data) ? oaResponse.data[0] : null
                );
              } catch (e2) {
                // sin OA, seguimos igual
              }
            }
          }
        }

        // horarioConfig → clases_detalle
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
                if (det.asignatura && asignatura === "(sin asignatura)")
                  setAsignatura(det.asignatura);
                if (det.curso && curso === "(sin curso)") setCurso(det.curso);
              }
            }
          }
        } catch (e) {
          console.warn("[Cierre] horarioConfig → clases_detalle:", e?.code || e?.message);
        }

        // slot 0-0 como fallback
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

  // fallback extra desde usuarios/{uid}
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

  /* ========================================================
     Subs en tiempo real
     ======================================================== */
  useEffect(() => {
    if (!authed) return;
    const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
    if (!uid) return;

    const applyClase = (d) => {
      if (!d) return;

      if (d.nombre) {
        setNombreProfesor((prev) => (d.nombre && d.nombre !== prev ? d.nombre : prev));
      }

      setUnidad((prev) => (d.unidad && d.unidad !== prev ? d.unidad : prev));

      setAsignatura((prev) =>
        d.asignatura && !isPlaceholder(d.asignatura) && d.asignatura !== prev
          ? d.asignatura
          : prev
      );

      setCurso((prev) =>
        d.curso && !isPlaceholder(d.curso) && d.curso !== prev ? d.curso : prev
      );

      setObjetivo((prev) =>
        d.objetivo && !isPlaceholder(d.objetivo) && d.objetivo !== prev
          ? d.objetivo
          : prev
      );
    };

    const unsubs = [];

    try {
      const r1 = doc(db, "clases_detalle", uid, "meta", "actual");
      unsubs.push(onSnapshot(r1, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r2 = doc(db, "clases_detalle", uid, "actual", "info");
      unsubs.push(onSnapshot(r2, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r3 = doc(db, "clases_detalle", uid, "slots", "0-0");
      unsubs.push(onSnapshot(r3, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}

    try {
      const r4 = doc(db, "profesores", uid);
      unsubs.push(
        onSnapshot(r4, (s) => {
          if (!s.exists()) return;
          applyClase({
            nombre: s.data()?.nombre,
            unidad: s.data()?.unidad || s.data()?.unidadInicial,
            objetivo: s.data()?.objetivo || s.data()?.objetivoInicial,
            asignatura: s.data()?.asignatura,
            curso: s.data()?.curso,
          });
        })
      );
    } catch (e) {}

    return () => unsubs.forEach((u) => typeof u === "function" && u());
  }, [authed]);

  // SessionId de la carrera
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
            {
              id: newId,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          setSessionId(newId);
        }
      } catch (e) {
        console.error("No se pudo crear/leer la sesión:", e);
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
        where("session", "==", sessionId)
      );
    } else {
      qRef = collection(db, "carrera", "actual", "participantes");
    }
    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipantes(list);
    });
    return () => unsub();
  }, [sessionId, authed]);

  // Scoring de respuestas en tiempo real
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

  async function scoreAnswer(respId, respData) {
    const { pid, answer, latencyMs } = respData;
    if (!pid) {
      await updateDoc(
        doc(db, "carrera", "actual", "respuestas", respId),
        { scored: true, points: 0 }
      );
      return;
    }

    let points = 0;

    if (
      Array.isArray(pregunta?.opciones) &&
      pregunta.opciones.length > 0 &&
      typeof pregunta?.correcta === "number"
    ) {
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
      await updateDoc(
        doc(db, "carrera", "actual", "participantes", pid),
        {
          puntos: increment(points),
          progreso: increment(points),
        }
      );
    } catch (e) {
      await setDoc(
        doc(db, "carrera", "actual", "participantes", pid),
        {
          nombre: respData.nombre || "Jugador",
          avatar: "🟢",
          progreso: points,
          puntos: points,
          joinedAt: serverTimestamp(),
          session: sessionId || null,
        },
        { merge: true }
      );
    }

    await updateDoc(
      doc(db, "carrera", "actual", "respuestas", respId),
      {
        scored: true,
        points,
      }
    );
  }

  const ranking = useMemo(
    () => [...participantes].sort((a, b) => (b.progreso || 0) - (a.progreso || 0)),
    [participantes]
  );

  const publicarPregunta = async () => {
    if (!panelTexto.trim()) return;

    const opcionesLimpias = panelOpciones.map((x) => x.trim()).filter((x) => x.length > 0);

    if (opcionesLimpias.length > 0 && (panelCorrecta < 0 || panelCorrecta >= opcionesLimpias.length)) {
      alert("Selecciona el índice de la respuesta correcta válido.");
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

  const generarPreguntaIA = async () => {
    try {
      setIaError(null);
      setIaLoading(true);

      const contextoBase = `Hoy trabajamos ${
        asignaturaStable || "la asignatura"
      } en el curso ${curso || ""}. Unidad: ${unidad || ""}. Objetivo: ${objetivo || ""}.`;

      const resp = await fetch(IA_CARRERA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contexto: contextoBase,
          idioma: "es",
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data || !data.pregunta) {
        throw new Error(data?.message || data?.error || "Respuesta de IA inválida.");
      }

      const opcionesIA = Array.isArray(data.opciones)
        ? data.opciones.map((s) => String(s || ""))
        : [];

      const opciones4 = [...opcionesIA, "", "", "", ""].slice(0, 4);

      setPanelTexto(data.pregunta);
      setPanelOpciones(opciones4);

      const idx =
        typeof data.correctIndex === "number" && data.correctIndex >= 0 && data.correctIndex < 4
          ? data.correctIndex
          : 0;
      setPanelCorrecta(idx);
    } catch (e) {
      console.error("ERROR IA CARRERA:", e);
      setIaError(
        e?.message || "No se pudo generar la pregunta con IA (usa fallback o escribe manual)."
      );
    } finally {
      setIaLoading(false);
    }
  };

  const cerrarRonda = async () => {
    try {
      await updateDoc(doc(db, "carrera", "actual", "meta", "pregunta"), { activa: false });
    } catch (e) {}
  };

  const resetCarrera = async () => {
    const ok = window.confirm(
      "¿Resetear carrera? Se borrarán participantes y respuestas, y se reiniciará la pregunta."
    );
    if (!ok) return;

    try {
      const uidSession = sessionId || null;

      // participantes
      let pQ = collection(db, "carrera", "actual", "participantes");
      let pSnap = uidSession
        ? await getDocs(query(pQ, where("session", "==", uidSession)))
        : await getDocs(pQ);

      const batch1 = writeBatch(db);
      pSnap.forEach((d) => batch1.delete(d.ref));
      await batch1.commit();

      // respuestas
      let rQ = collection(db, "carrera", "actual", "respuestas");
      let rSnap = uidSession
        ? await getDocs(query(rQ, where("session", "==", uidSession)))
        : await getDocs(rQ);

      const batch2 = writeBatch(db);
      rSnap.forEach((d) => batch2.delete(d.ref));
      await batch2.commit();

      // reiniciar pregunta
      await setDoc(
        doc(db, "carrera", "actual", "meta", "pregunta"),
        {
          texto: "",
          opciones: [],
          correcta: null,
          activa: false,
          startAt: serverTimestamp(),
          session: uidSession,
        },
        { merge: true }
      );

      setPanelTexto("");
      setPanelOpciones(["", "", "", ""]);
      setPanelCorrecta(0);
      setRonda((r) => r + 1);
      alert("Carrera reseteada ✅");
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
      if (el?.scrollIntoView)
        el.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    } catch (e) {}
  };

  const cronometroPropsCierre = {
    duracion,
    storageKey: CIERRE_TIMER_KEY,
    instanceId: "cierre",
  };

  function persistClaseForDesarrollo() {
    try {
      const bridge = {
        unidad: unidad || "",
        objetivo: objetivo || "",
        asignatura: asignaturaStable || "",
        curso: curso || "",
        ts: Date.now(),
        from: "cierre",
      };
      localStorage.setItem("bridge:desarrolloClase", JSON.stringify(bridge));
    } catch (_) {}
  }

  function goToDesarrollo() {
    persistClaseForDesarrollo();
    navigate("/desarrollo");
  }

  function handleEndCierre() {
    try {
      persistClaseForDesarrollo();
    } catch (_) {}
    clearAllCountdowns();
    navigate("/InicioClase", {
      replace: true,
      state: {
        resetTimers: true,
        from: "cierre",
        autoReturn: true,
      },
    });
  }

  const safeOnEndCierre =
    typeof handleEndCierre === "function" ? handleEndCierre : () => {};

  /* ========================================================
     Render
     ======================================================== */
  return (
    <div style={page} className="no-scroll-jump">
      {claseVigente && (
        <div
          style={{
            ...card,
            marginBottom: "1rem",
            background:
              claseVigente.fuente === "calendario"
                ? "rgba(124,58,237,.08)"
                : "rgba(2,132,199,.08)",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            {claseVigente.fuente === "calendario"
              ? "Plan semanal (vigente)"
              : claseVigente.fuente === "slots"
              ? "Horario (fallback)"
              : "Sin clase planificada"}
          </div>
          {claseVigente.unidad && (
            <div>
              <b>Unidad:</b> {claseVigente.unidad}
              {claseVigente.evaluacion ? " · (Evaluación)" : ""}
            </div>
          )}
          {claseVigente?.objetivo && (
            <div>
              <b>Objetivo:</b> {claseVigente.objetivo}
            </div>
          )}
        </div>
      )}

      {/* Fila 1: reloj, datos clase, profe */}
      <div
        style={{
          ...row("1rem"),
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            ...card,
            ...layerFix,
          }}
          className="no-scroll-jump layer-accel"
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "1.1rem",
              marginBottom: 6,
            }}
          >
            Cierre
          </div>
          <div
            style={{
              color: COLORS.textMuted,
              marginBottom: 8,
            }}
          >
            ⏰ <HoraActualText />
          </div>

          <div
            className="tnum clock-w layer-accel"
            style={{
              fontVariantNumeric: "tabular-nums lining-nums",
              fontFeatureSettings: "'tnum' 1, 'lnum' 1",
              transform: "translateZ(0)",
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
          >
            <CronometroGlobal {...cronometroPropsCierre} onEnd={safeOnEndCierre} />
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
      <div
        style={{
          ...card,
          textAlign: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🧠 Nube de palabras final</h3>
        <NubeDePalabras
          modo="cierre"
          preset="showtime"
          cloudPreset={SHOWTIME_PRESET}
          rotationAggressive
          contrastBoost={SHOWTIME_PRESET.contrastBoost}
          angles={SHOWTIME_PRESET.rotate?.angles}
          colors={SHOWTIME_PRESET.colors}
          fontFamily={SHOWTIME_PRESET.fontFamily}
          fontWeight={SHOWTIME_PRESET.fontWeight}
          fontSizes={SHOWTIME_PRESET.fontSizes}
          spiral={SHOWTIME_PRESET.spiral}
          shuffle={SHOWTIME_PRESET.shuffle}
          padding={SHOWTIME_PRESET.padding}
        />
      </div>

      {/* QR sesión carrera */}
      <div
        style={{
          ...card,
          textAlign: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🔗 Únete a la carrera</h3>
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <QRCode value={joinURL} size={160} />
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              Sesión: {sessionId || "—"}
            </div>
            <div
              style={{
                color: COLORS.textMuted,
                fontSize: 14,
                marginTop: 6,
              }}
            >
              Pide a tus estudiantes abrir <code>/participa</code> o escanear el QR. Link directo:
            </div>
            <code
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
              }}
            >
              {joinURL}
            </code>
          </div>
        </div>
      </div>

      {/* Centro de Juegos */}
      <div
        style={{
          ...card,
          marginBottom: "1rem",
        }}
      >
        {/* HEADER CON IMAGEN DEL JUEGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 0,
            }}
          >
            🎮 Centro de Juegos PRAGMA
          </h3>

          <img
            src={portadaCarreraPragma}
            alt="Juegos PRAGMA - Cierre de clase"
            style={{
              height: 80,
              borderRadius: 12,
              objectFit: "cover",
              boxShadow: "0 8px 20px rgba(15,23,42,.35)",
            }}
          />
        </div>

        <div
          style={{
            color: COLORS.textMuted,
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          Aquí tienes los juegos propios de la plataforma PRAGMA para cerrar la clase con un momento
          épico y participativo.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 10,
          }}
        >
          {GAMES.map((g, idx) => (
            <div
              key={g.key}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Imagen grande SOLO en la última casilla (Carrera PRAGMA) */}
              {idx === GAMES.length - 1 && (
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow:
                      "0 12px 28px rgba(15,23,42,0.28), 0 6px 14px rgba(15,23,42,0.18)",
                    marginBottom: 4,
                  }}
                >
                  <img
                    src={portadaCarreraPragma}
                    alt={g.name}
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}

              <div style={{ fontWeight: 800 }}>{g.name}</div>
              <div
                style={{
                  color: COLORS.textMuted,
                  fontSize: 14,
                }}
              >
                {g.desc}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {g.type === "internal" ? (
                  <button style={btnWhite} onClick={goToCarrera}>
                    🏁 Ir a Carrera PRAGMA
                  </button>
                ) : (
                  <>
                    <button
                      style={btnWhite}
                      onClick={() => openExternal(g.url || "https://pragmaprofe.com")}
                    >
                      🔗 Abrir
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel profesor + Ranking carrera */}
      <div
        id="carreraPanel"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>🎮 Mini panel del profesor</h3>
          <div
            style={{
              ...smallMuted,
              marginBottom: 8,
            }}
          >
            Publica una pregunta (texto + 0–4 opciones). Si agregas opciones, selecciona cuál es la
            correcta.
          </div>

          <label style={{ fontWeight: 700 }}>Pregunta</label>
          <input
            style={{ ...input, marginBottom: 8 }}
            value={panelTexto}
            onChange={(e) => setPanelTexto(e.target.value)}
            placeholder="Escribe la pregunta…"
          />

          <label style={{ fontWeight: 700 }}>Opciones (opcional)</label>
          {panelOpciones.map((op, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
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
                placeholder={`Opción ${i + 1}`}
              />
            </div>
          ))}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              style={btnWhite}
              onClick={publicarPregunta}
              disabled={publicando}
              title="Publicar pregunta"
            >
              🚀 Publicar ronda
            </button>
            <button
              style={btnWhite}
              onClick={cerrarRonda}
              title="Cerrar ronda"
            >
              ⛔ Cerrar ronda
            </button>
            <button
              style={btnWhite}
              onClick={generarPreguntaIA}
              disabled={iaLoading}
              title="Generar texto y alternativas con IA"
            >
              {iaLoading ? "⏳ Generando…" : "✨ IA Carrera"}
            </button>
          </div>

          <div
            style={{
              ...smallMuted,
              marginTop: 8,
            }}
          >
            {pregunta?.activa ? "Ronda ACTIVA" : "Ronda INACTIVA"}{" "}
            {pregunta?.texto ? `• "${pregunta.texto}"` : ""}
          </div>
          {iaError && (
            <div
              style={{
                ...smallMuted,
                marginTop: 4,
                color: "#b91c1c",
              }}
            >
              {iaError}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ marginTop: 0 }}>🏁 Carrera en vivo</h3>
          <div
            style={{
              ...smallMuted,
              marginBottom: 8,
            }}
          >
            Avance = acierto (5 pts) + bonus por rapidez (hasta +8). Participación abierta: pequeño
            avance.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {ranking.length === 0 && (
              <div
                style={{
                  color: COLORS.textMuted,
                }}
              >
                Aún no hay participantes. Pide a tus estudiantes abrir <code>/participa</code>.
              </div>
            )}

            {ranking.map((p) => {
              const prog = Math.min(100, Math.round(p.progreso || 0));
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 60px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 20,
                    }}
                  >
                    {p.avatar || "🟢"}
                  </div>
                  <div
                    style={{
                      background: "#eef2f7",
                      borderRadius: 999,
                      overflow: "hidden",
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
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
                      <strong
                        style={{
                          fontSize: 12,
                        }}
                      >
                        {p.nombre || "Jugador"}
                      </strong>
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontWeight: 800,
                    }}
                  >
                    {p.progreso || 0}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Acciones finales */}
      <div
        style={{
          textAlign: "center",
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={resetCarrera}
          style={btnWhite}
          title="Borrar participantes, respuestas y reiniciar pregunta"
        >
          🧹 Reset carrera
        </button>

        <button
          onClick={goToDesarrollo}
          style={btnWhite}
          title="Ir a Desarrollo (guarda la clase actual y navega)"
        >
          ➡️ Ir a Desarrollo
        </button>

        <button
          onClick={() => {
            clearAllCountdowns();
            navigate("/InicioClase", {
              replace: true,
              state: {
                resetTimers: true,
                from: "cierre",
              },
            });
          }}
          style={btnWhite}
        >
          ⬅️ Volver al Inicio
        </button>
      </div>
    </div>
  );
}

