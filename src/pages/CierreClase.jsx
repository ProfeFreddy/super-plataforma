// src/pages/CierreClase.jsx  
import React, {
  useEffect,
  useState,
  useMemo,
  useContext,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { db, auth } from "../firebase";
import {
  getDoc, doc, collection, onSnapshot, serverTimestamp, setDoc,
  updateDoc, increment, query, where, getDocs, writeBatch,
} from "firebase/firestore";
import CronometroGlobal from "../components/CronometroGlobal";
import NubeDePalabras from "../components/NubeDePalabras";
import QRCode from "react-qr-code";
import FichaClaseSticky from "../components/FichaClaseSticky";

import portadaCarreraPragma from "../assets/pragmaprofe-carrera.png";
import portadaGincanaNexus from "../assets/gincana-nexus.png";

import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";
import { getClaseVigente } from "../services/PlanificadorService";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

function useAuthSafe() {
  const [ready, setReady] = useState(false);
  const [userObj, setUserObj] = useState(auth.currentUser || null);
  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) { const cred = await signInAnonymously(auth); if (!alive) return; setUserObj(cred.user || null); localStorage.setItem("uid", cred.user?.uid || ""); setReady(true); }
        else { setUserObj(u); localStorage.setItem("uid", u.uid); setReady(true); }
      } catch (err) { console.error("[CierreClase] useAuthSafe error:", err); setUserObj(null); setReady(true); }
    });
    return () => { alive = false; unsub && unsub(); };
  }, []);
  return { ready, user: userObj };
}

const PROXY_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_PROXY_BASE) || "";

const IA_CARRERA_ENDPOINT =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_IA_CARRERA_ENDPOINT) ||
  (typeof window !== "undefined" && window.location.origin.includes("localhost:5173") ? "http://localhost:8080/api/ia-carrera/genera" : "/api/ia-carrera/genera");

const norm = (s = "") => s.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

const ASIG_SLUGS = {
  matematica: "matematica", matematicas: "matematica", lenguaje: "lenguaje",
  "lenguaje y comunicacion": "lenguaje", "lengua y literatura": "lenguaje",
  fisica: "fisica", quimica: "quimica", historia: "historia",
  "historia y ciencias sociales": "historia", ingles: "ingles",
  biologia: "biologia", ciencias: "ciencias", tecnologia: "tecnologia",
};

function asigToSlug(asig = "") { return ASIG_SLUGS[norm(asig)] || "matematica"; }
function nivelToApi(cursoStr = "", prefer = "") { return /basico|b[aí]sico|b[aí]sica|basica/i.test(norm(cursoStr || prefer)) ? "basica" : "media"; }

const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00";
function getNowForSchedule() { return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date(); }
function colDeHoy() { const d = getNowForSchedule().getDay(); return d >= 1 && d <= 5 ? d - 1 : 0; }
function filaDesdeMarcas(marcas = []) {
  const now = getNowForSchedule(); const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < marcas.length - 1; i++) { const start = marcas[i][0] * 60 + marcas[i][1]; const end = marcas[i + 1][0] * 60 + marcas[i + 1][1]; if (mins >= start && mins < end) return i; }
  return 0;
}
function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object") return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  if (Array.isArray(cfg.marcasStr)) return cfg.marcasStr.map((s) => { const [h, m] = String(s).split(":").map((n) => Number(n) || 0); return [h, m]; });
  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) { const startTimes = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]); const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1]; return [...startTimes, lastEnd].map((s) => { const [h, m] = s.split(":").map((n) => Number(n) || 0); return [h, m]; }); }
  return [];
}

const COLORS = {
  brandA: "#1b75a6", brandB: "#60c3eb", white: "#ffffff",
  textDark: "#0f172a", textMuted: "#334155", border: "#e5e7eb", btnText: "#164e63",
};
const page = { minHeight: "100vh", background: `linear-gradient(110deg, ${COLORS.brandA}, ${COLORS.brandB})`, padding: "2rem", fontFamily: "Segoe UI, sans-serif", color: COLORS.white, boxSizing: "border-box" };
const row = (gap = "1rem") => ({ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)", gap, alignItems: "stretch" });
const card = { background: COLORS.white, color: COLORS.textDark, borderRadius: 12, padding: "1rem", boxShadow: "0 10px 24px rgba(16,24,40,.12), 0 4px 10px rgba(16,24,40,.06)", border: `1px solid ${COLORS.border}`, maxWidth: "100%", overflow: "hidden", contain: "content", minWidth: 0 };
const layerFix = { willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden", WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" };
const btnWhite = { background: COLORS.white, color: COLORS.btnText, border: "none", borderRadius: 10, padding: ".6rem .9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 14px rgba(0,0,0,.18)" };
const input = { width: "100%", padding: "0.65rem 0.8rem", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: "0.95rem", outline: "none" };
const smallMuted = { color: COLORS.textMuted, fontSize: 12 };

const SHOWTIME_PRESET = {
  id: "showtime", colors: ["#0f172a", "#0ea5e9", "#22c55e", "#ef4444", "#f59e0b", "#a855f7"],
  fontFamily: "Segoe UI, system-ui, sans-serif", fontWeight: [600, 800], fontSizes: [18, 72], padding: 1, spiral: "rectangular", shuffle: true,
  rotate: { mode: "steep", angles: [-90, -60, -30, 0, 30, 60, 90], probabilityTilted: 0.75 }, contrastBoost: 1.25, rendering: { fontKerning: "none", pixelRatio: 1.0 },
};

const GAMES = [
  { key: "juego1", type: "comingSoon", nameEs: "Trivia relámpago", nameEn: "Lightning trivia", descEs: "Juego de preguntas y respuestas rápidas. Versión en desarrollo.", descEn: "Fast-paced questions and answers. In development." },
  { key: "juego2", type: "comingSoon", nameEs: "Rompebloques PRAGMA", nameEn: "PRAGMA brick breaker", descEs: "Rompe bloques respondiendo acertijos. Versión en desarrollo.", descEn: "Break blocks by solving riddles. In development." },
  { key: "juego3", type: "comingSoon", nameEs: "Memoria matemática", nameEn: "Math memory", descEs: "Encuentra parejas de operaciones y resultados. Versión en desarrollo.", descEn: "Match operations with their results. In development." },
  { key: "juego4", type: "comingSoon", nameEs: "Ruleta de desafíos", nameEn: "Challenge roulette", descEs: "Gira la ruleta y resuelve el reto. Versión en desarrollo.", descEn: "Spin the wheel and solve the challenge. In development." },
  { key: "gincana", type: "external", url: "https://pragmaprofe.com/#/gincana", img: portadaGincanaNexus, nameEs: "GincanaNexus", nameEn: "GincanaNexus", descEs: "Juego multijugador 3D.", descEn: "3D multiplayer game." },
  { key: "pragma", type: "internal", img: portadaCarreraPragma, nameEs: "Carrera PRAGMA", nameEn: "PRAGMA Race", descEs: "Juego nativo de la plataforma.", descEn: "Native platform game." },
];

const CIERRE_TIMER_KEY = "crono:cierre:v2";

function clearAllCountdowns() {
  try { const toDelete = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k) continue; if (k === "inicioClase_countdown_end" || k.startsWith("ic_countdown_end:") || k.startsWith("crono:")) toDelete.push(k); } toDelete.forEach((k) => localStorage.removeItem(k)); } catch (e) {}
}

const isPlaceholder = (v) => /^\(sin/i.test(String(v || ""));

function leerClaseActualLocal() {
  try {
    return JSON.parse(localStorage.getItem("__pragmaClaseActual") || "null");
  } catch {
    return null;
  }
}

function nombreProfesorSeguro(...sources) {
  const esNombreValido = (valor) => {
    const nombre = String(valor || "").trim();
    if (!nombre) return "";
    const lower = nombre.toLowerCase();
    if (lower === "profesor" || lower === "teacher") return "";
    if (lower === "(sin profesor)" || lower === "(no teacher)") return "";
    if (lower === "(sin nombre)" || lower === "(no name)") return "";
    return nombre;
  };

  for (const source of sources) {
    const directo = typeof source === "string" ? esNombreValido(source) : "";
    if (directo) return directo;

    if (!source || typeof source !== "object") continue;

    const candidatos = [
      source.nombreProfesor,
      source.profesor,
      source.nombre,
      source.nombreCompleto,
      source.profesorNombre,
      source.teacherName,
      source.teacher,
      source?.profesor?.nombre,
      source?.usuario?.nombre,
    ];

    for (const candidato of candidatos) {
      const nombre = esNombreValido(candidato);
      if (nombre) return nombre;
    }
  }

  return "Profesor";
}

const HoraActualText = React.memo(function HoraActualText() {
  const [t, setT] = useState(new Date().toLocaleTimeString());
  useEffect(() => { const id = setInterval(() => setT(new Date().toLocaleTimeString()), 1000); return () => clearInterval(id); }, []);
  return <span className="tnum clock-w">{t}</span>;
});

const DatosClaseCard = React.memo(
  function DatosClaseCard({ unidad, objetivo, curso, asignatura, t }) {
    return (
      <div style={{ ...card, textAlign: "center", ...layerFix }}>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 6 }}>{t("Unidad", "Unit")}</div>
        <div style={{ marginBottom: 6, ...layerFix }}><strong>{unidad || t("(sin unidad)", "(no unit)")} </strong></div>
        <div style={{ marginTop: 4, color: COLORS.textDark, ...layerFix }}><strong>{t("Objetivo:", "Objective:")}</strong> {objetivo}</div>
        <div style={{ marginTop: 10, color: COLORS.textMuted, ...layerFix }}>
          <strong>{t("Curso:", "Class:")}</strong> {curso} &nbsp;|&nbsp; <strong>{t("Asignatura:", "Subject:")}</strong> {asignatura}
        </div>
      </div>
    );
  },
  (prev, next) => prev.unidad === next.unidad && prev.objetivo === next.objetivo && prev.curso === next.curso && prev.asignatura === next.asignatura
);

const ProfesorCard = React.memo(
  function ProfesorCard({ nombreProfesor, asignatura, t }) {
    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: ".6rem", ...layerFix }}>
        <div style={{ display: "flex", gap: ".5rem" }}><button style={btnWhite}>🧑‍🏫</button><button style={btnWhite}>🎓</button></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, ...layerFix }}>{nombreProfesor}</div>
          <div style={{ color: COLORS.textMuted, ...layerFix }}>{asignatura}</div>
        </div>
      </div>
    );
  },
  (prev, next) => prev.nombreProfesor === next.nombreProfesor && prev.asignatura === next.asignatura
);

export default function CierreClase({ duracion = 10 }) {
  const navigate = useNavigate();
  const location = useLocation();

  const planCtx = useContext(PlanContext) || {};
  const { plan = "FREE", caps = PLAN_CAPS.FREE } = planCtx;

  const specialClassState = location.state?.specialClass || location.state?.claseEspecial || location.state?.specialMode || null;
  const isSpecialClass = Boolean(specialClassState) || planCtx?.claseEspecial === true || planCtx?.modo === "especial";
  const idioma = location.state?.idioma || specialClassState?.idioma || planCtx?.idioma || "es";
  const isEnglish = idioma === "en";
  const t = (es, en) => (isEnglish ? en : es);

  const { ready: authReady, user: authUser } = useAuthSafe();

  const [nombreProfesor, setNombreProfesor] = useState(specialClassState?.nombreProfesor || specialClassState?.teacherName || (isEnglish ? "Teacher" : "Profesor"));
  const [asignatura, setAsignatura] = useState(specialClassState?.asignatura || specialClassState?.subject || (isEnglish ? "(no subject)" : "(sin asignatura)"));
  const [curso, setCurso] = useState(specialClassState?.curso || specialClassState?.course || (isEnglish ? "(no class)" : "(sin curso)"));
  const [unidad, setUnidad] = useState(specialClassState?.unidad || specialClassState?.unit || specialClassState?.unitTitle || "");
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [objetivo, setObjetivo] = useState(specialClassState?.objetivo || specialClassState?.objective || (isEnglish ? "(no objective)" : "(sin objetivo)"));
  const [claseVigente, setClaseVigente] = useState(null);

  const lastGoodAsignaturaRef = useRef(null);
  useEffect(() => { if (asignatura && !isPlaceholder(asignatura)) lastGoodAsignaturaRef.current = asignatura; }, [asignatura]);
  const asignaturaStable = lastGoodAsignaturaRef.current || asignatura;

  // ✅ Priorizar datos del state de navegación (vienen de Desarrollo/InicioClase)
  useEffect(() => {
    const stateClase = location?.state?.clase || location?.state?.specialData || null;
    if (stateClase) {
      if (stateClase.unidad) setUnidad(stateClase.unidad);
      if (stateClase.objetivo && !isPlaceholder(stateClase.objetivo)) setObjetivo(stateClase.objetivo);
      if (stateClase.asignatura && !isPlaceholder(stateClase.asignatura)) setAsignatura(stateClase.asignatura);
      if (stateClase.curso && !isPlaceholder(stateClase.curso)) setCurso(stateClase.curso);
      const nombreDesdeState = nombreProfesorSeguro(location?.state, stateClase, leerClaseActualLocal());
      if (nombreDesdeState !== "Profesor") setNombreProfesor(nombreDesdeState);
    }
  }, [location.state]);

  useEffect(() => {
    (async () => {
      try {
        if (!isSpecialClass) {
          const res = await getClaseVigente(new Date()); setClaseVigente(res);
          if (res?.unidad && !unidad) setUnidad(res.unidad);
          if (res?.asignatura && asignatura === (isEnglish ? "(no subject)" : "(sin asignatura)")) setAsignatura(res.asignatura);
          if (res?.objetivo && objetivo === (isEnglish ? "(no objective)" : "(sin objetivo)")) setObjetivo(res.objetivo);
        } else {
          setClaseVigente((prev) => prev || { fuente: "especial", unidad, objetivo, asignatura: asignaturaStable, curso });
        }
      } catch (e) { console.error("[Cierre] getClaseVigente:", e); }
    })();
  }, []); // eslint-disable-line

  const [authed, setAuthed] = useState(false);
  useEffect(() => { if (!authReady) return; if (authUser || localStorage.getItem("uid")) setAuthed(true); }, [authReady, authUser]);

  const [sessionId, setSessionId] = useState("");

  const joinURL = useMemo(() => {
    const base = window.location.origin.replace(/\/$/, "");
    const urlBase = `${base}/participa`;
    if (!sessionId) return urlBase;
    const u = new URL(urlBase);
    u.searchParams.set("session", sessionId);
    if (isSpecialClass) u.searchParams.set("mode", "special");
    if (isEnglish) u.searchParams.set("lang", "en");
    return u.toString();
  }, [sessionId, isSpecialClass, isEnglish]);

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

  useEffect(() => {
  try {
    const raw = localStorage.getItem("__pragmaClaseActual");
    if (!raw) return;

    const c = JSON.parse(raw);

    setUnidad(c.unidad || "");
    setObjetivo(c.objetivoClase || c.objetivo || "");
    setAsignatura(c.asignatura || "(sin asignatura)");
    setCurso(c.curso || "(sin curso)");
    const nombreDesdeFlujo = nombreProfesorSeguro(location?.state, location?.state?.clase, c);
    if (nombreDesdeFlujo !== "Profesor") setNombreProfesor(nombreDesdeFlujo);
  } catch (e) {
    console.warn("[Cierre] No se pudo leer __pragmaClaseActual", e);
  }
}, []);

  useEffect(() => {
    if (!authed) return;
    const obtenerDatos = async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid; if (!uid) return;

        const uref = doc(db, "usuarios", uid); const usnap = await getDoc(uref);
        if (usnap.exists()) { if (!nombreProfesor || nombreProfesor === "Profesor" || nombreProfesor === "Teacher") setNombreProfesor(usnap.data()?.nombre || (isEnglish ? "Teacher" : "Profesor")); }

        const pref = doc(db, "profesores", uid); const psnap = await getDoc(pref);
        if (psnap.exists()) {
          const data = psnap.data() || {};
          const unidadInicial = data.unidadInicial || "";
          if (!unidad) setUnidad(unidadInicial);
          if (data.asignatura && !isPlaceholder(data.asignatura) && asignatura === (isEnglish ? "(no subject)" : "(sin asignatura)")) setAsignatura(data.asignatura);
          if (curso === (isEnglish ? "(no class)" : "(sin curso)")) setCurso(data.curso || (isEnglish ? "(no class)" : "(sin curso)"));
          if (objetivo === (isEnglish ? "(no objective)" : "(sin objetivo)")) { if (data.objetivo) setObjetivo(data.objetivo); else if (data.objetivoInicial) setObjetivo(data.objetivoInicial); }
        }

        // ✅ Usar slot dinámico desde localStorage en lugar de "0-0" hardcodeado
        try {
          if (!isSpecialClass && usnap.exists()) {
            const cfg = usnap.data()?.horarioConfig || {};
            const marcas = getMarcasFromConfig(cfg);
            if (Array.isArray(marcas) && marcas.length > 1) {
              const fila = filaDesdeMarcas(marcas); const col = colDeHoy();
              const slotId = `${fila}-${col}`;
              const dref = doc(db, "clases_detalle", uid, "slots", slotId);
              const dsnap = await getDoc(dref);
              if (dsnap.exists()) {
                const det = dsnap.data() || {};
                if (!unidad && det.unidad) setUnidad(det.unidad);
                if (objetivo === (isEnglish ? "(no objective)" : "(sin objetivo)") && det.objetivo) setObjetivo(det.objetivo);
                if (asignatura === (isEnglish ? "(no subject)" : "(sin asignatura)") && det.asignatura) setAsignatura(det.asignatura);
                if (curso === (isEnglish ? "(no class)" : "(sin curso)") && det.curso) setCurso(det.curso);
              }
            }
          }
        } catch (e) { console.warn("[Cierre] horarioConfig:", e?.code || e?.message); }

        // ✅ Fallback: slot desde localStorage (el último slot activo)
        try {
          if (!isSpecialClass) {
            const lastSlot = localStorage.getItem("__lastSlotId") || location?.state?.slotId || "0-0";
            const slotRef = doc(db, "clases_detalle", uid, "slots", lastSlot);
            const slotSnap = await getDoc(slotRef);
            if (slotSnap.exists()) {
              const s = slotSnap.data() || {};
              if (!unidad && s.unidad) setUnidad(s.unidad);
              if (objetivo === (isEnglish ? "(no objective)" : "(sin objetivo)") && s.objetivo) setObjetivo(s.objetivo);
              if (asignatura === (isEnglish ? "(no subject)" : "(sin asignatura)") && s.asignatura) setAsignatura(s.asignatura);
              if (curso === (isEnglish ? "(no class)" : "(sin curso)") && s.curso) setCurso(s.curso);
            }
          }
        } catch (e) {}
      } catch (err) { console.error("Error cargando datos de Cierre:", err); }
    };
    obtenerDatos();
  }, [authed]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid; if (!uid) return;
        const uref = doc(db, "usuarios", uid); const usnap = await getDoc(uref);
        if (usnap.exists()) {
          const u = usnap.data() || {};
          if ((!unidad || /^\(sin/i.test(unidad)) && !isSpecialClass) setUnidad(u.unidadInicial || u.unidad || "");
          if (asignatura === (isEnglish ? "(no subject)" : "(sin asignatura)") && u.asignatura && !isSpecialClass) setAsignatura(u.asignatura);
          if (curso === (isEnglish ? "(no class)" : "(sin curso)") && u.curso && !isSpecialClass) setCurso(u.curso);
          if (objetivo === (isEnglish ? "(no objective)" : "(sin objetivo)") && u.objetivo) setObjetivo(u.objetivo);
        }
      } catch (e) { console.warn("[Cierre] usuarios fallback:", e?.code || e?.message); }
    })();
  }, [authed]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return; if (isSpecialClass) return;
    const uid = localStorage.getItem("uid") || auth.currentUser?.uid; if (!uid) return;
    const applyClase = (d) => {
      if (!d) return;
      if (d.nombre) setNombreProfesor((prev) => (d.nombre && d.nombre !== prev ? d.nombre : prev));
      setUnidad((prev) => (d.unidad && d.unidad !== prev ? d.unidad : prev));
      setAsignatura((prev) => d.asignatura && !isPlaceholder(d.asignatura) && d.asignatura !== prev ? d.asignatura : prev);
      setCurso((prev) => d.curso && !isPlaceholder(d.curso) && d.curso !== prev ? d.curso : prev);
      setObjetivo((prev) => d.objetivo && !isPlaceholder(d.objetivo) && d.objetivo !== prev ? d.objetivo : prev);
    };
    const unsubs = [];
    try { const r1 = doc(db, "clases_detalle", uid, "meta", "actual"); unsubs.push(onSnapshot(r1, (s) => s.exists() && applyClase(s.data()))); } catch (e) {}
    try { const r2 = doc(db, "clases_detalle", uid, "actual", "info"); unsubs.push(onSnapshot(r2, (s) => s.exists() && applyClase(s.data()))); } catch (e) {}
    try {
      // ✅ Slot dinámico en lugar de hardcodeado "0-0"
      const lastSlot = localStorage.getItem("__lastSlotId") || location?.state?.slotId || "0-0";
      const r3 = doc(db, "clases_detalle", uid, "slots", lastSlot);
      unsubs.push(onSnapshot(r3, (s) => s.exists() && applyClase(s.data())));
    } catch (e) {}
    try {
      const r4 = doc(db, "profesores", uid);
      unsubs.push(onSnapshot(r4, (s) => { if (!s.exists()) return; applyClase({ nombre: s.data()?.nombre, unidad: s.data()?.unidad || s.data()?.unidadInicial, objetivo: s.data()?.objetivo || s.data()?.objetivoInicial, asignatura: s.data()?.asignatura, curso: s.data()?.curso }); }));
    } catch (e) {}
    return () => unsubs.forEach((u) => typeof u === "function" && u());
  }, [authed, isSpecialClass]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return;
    const ensureSession = async () => {
      try {
        const sref = doc(db, "carrera", isSpecialClass ? "especial" : "actual", "meta", "session");
        const snap = await getDoc(sref);
        if (snap.exists() && snap.data()?.id) { setSessionId(String(snap.data().id)); }
        else { const newId = Math.random().toString(36).slice(2, 8).toUpperCase(); await setDoc(sref, { id: newId, createdAt: serverTimestamp(), mode: isSpecialClass ? "special" : "standard", lang: idioma }, { merge: true }); setSessionId(newId); }
      } catch (e) { console.error("No se pudo crear/leer la sesión:", e); }
    };
    ensureSession();
  }, [authed, isSpecialClass, idioma]);

  const carreraRoot = isSpecialClass ? "especial" : "actual";

  useEffect(() => {
    if (!authed) return;
    const ref = doc(db, "carrera", carreraRoot, "meta", "pregunta");
    const unsub = onSnapshot(ref, (snap) => { if (snap.exists()) setPregunta(snap.data()); else setPregunta(null); });
    return () => unsub();
  }, [authed, carreraRoot]);

  useEffect(() => {
    if (!authed) return;
    let qRef = sessionId ? query(collection(db, "carrera", carreraRoot, "participantes"), where("session", "==", sessionId)) : collection(db, "carrera", carreraRoot, "participantes");
    const unsub = onSnapshot(qRef, (snap) => { setParticipantes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
    return () => unsub();
  }, [sessionId, authed, carreraRoot]);

  useEffect(() => {
    if (!authed) return; if (!pregunta?.activa) return;
    let qRef = sessionId ? query(collection(db, "carrera", carreraRoot, "respuestas"), where("scored", "!=", true), where("session", "==", sessionId)) : query(collection(db, "carrera", carreraRoot, "respuestas"), where("scored", "!=", true));
    const unsub = onSnapshot(qRef, async (snap) => {
      if (procesando) return; setProcesando(true);
      const toProcess = []; const startMs = pregunta?.startAt?.toMillis ? pregunta.startAt.toMillis() : null;
      snap.docChanges().forEach((chg) => { if (chg.type === "added" || chg.type === "modified") { const data = chg.doc.data(); if (startMs && data.createdAt?.toMillis && data.createdAt.toMillis() < startMs) return; if (data.scored === true) return; toProcess.push({ id: chg.doc.id, data }); } });
      for (const item of toProcess) { try { await scoreAnswer(item.id, item.data); } catch (e) { console.error("Error scoring:", e); } }
      setProcesando(false);
    });
    return () => unsub();
  }, [pregunta?.activa, pregunta?.startAt, ronda, sessionId, authed, carreraRoot]); // eslint-disable-line

  async function scoreAnswer(respId, respData) {
    const { pid, answer, latencyMs } = respData; if (!pid) { await updateDoc(doc(db, "carrera", carreraRoot, "respuestas", respId), { scored: true, points: 0 }); return; }
    let points = 0;
    if (Array.isArray(pregunta?.opciones) && pregunta.opciones.length > 0 && typeof pregunta?.correcta === "number") { const correcta = pregunta.opciones[pregunta.correcta]; const esCorrecta = String(answer).trim() === String(correcta).trim(); if (esCorrecta) { const latS = typeof latencyMs === "number" ? latencyMs / 1000 : 8; points = 5 + Math.max(0, 8 - Math.floor(latS)); } }
    else { const latS = typeof latencyMs === "number" ? latencyMs / 1000 : 8; points = 2 + Math.max(0, 5 - Math.floor(latS)); }
    try { await updateDoc(doc(db, "carrera", carreraRoot, "participantes", pid), { puntos: increment(points), progreso: increment(points) }); }
    catch (e) { await setDoc(doc(db, "carrera", carreraRoot, "participantes", pid), { nombre: respData.nombre || (isEnglish ? "Player" : "Jugador"), avatar: "🟢", progreso: points, puntos: points, joinedAt: serverTimestamp(), session: sessionId || null }, { merge: true }); }
    await updateDoc(doc(db, "carrera", carreraRoot, "respuestas", respId), { scored: true, points });
  }

  const ranking = useMemo(() => [...participantes].sort((a, b) => (b.progreso || 0) - (a.progreso || 0)), [participantes]);

  const publicarPregunta = async () => {
    if (!panelTexto.trim()) return;
    const opcionesLimpias = panelOpciones.map((x) => x.trim()).filter((x) => x.length > 0);
    if (opcionesLimpias.length > 0 && (panelCorrecta < 0 || panelCorrecta >= opcionesLimpias.length)) { alert(t("Selecciona el índice de la respuesta correcta válido.", "Select a valid index for the correct answer.")); return; }
    setPublicando(true);
    try { await setDoc(doc(db, "carrera", carreraRoot, "meta", "pregunta"), { texto: panelTexto.trim(), opciones: opcionesLimpias.length > 0 ? opcionesLimpias : [], correcta: opcionesLimpias.length > 0 ? panelCorrecta : null, startAt: serverTimestamp(), activa: true, session: sessionId || null, mode: isSpecialClass ? "special" : "standard", lang: idioma }, { merge: true }); setRonda((r) => r + 1); }
    catch (e) { console.error(e); alert(t("No se pudo publicar la pregunta.", "The question could not be published.")); }
    finally { setPublicando(false); }
  };

  const generarPreguntaIA = async () => {
    try {
      setIaError(null); setIaLoading(true);
      const contextoBase = t(`Hoy trabajamos ${asignaturaStable || "la asignatura"} en el curso ${curso || ""}. Unidad: ${unidad || ""}. Objetivo: ${objetivo || ""}.`, `Today we worked on ${asignaturaStable || "the subject"} in class ${curso || ""}. Unit: ${unidad || ""}. Objective: ${objetivo || ""}.`);
      const resp = await fetch(IA_CARRERA_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto: contextoBase, idioma: isEnglish ? "en" : "es" }) });
      const data = await resp.json();
      if (!resp.ok || !data || !data.pregunta) throw new Error(data?.message || data?.error || "Respuesta de IA inválida.");
      const opcionesIA = Array.isArray(data.opciones) ? data.opciones.map((s) => String(s || "")) : [];
      const opciones4 = [...opcionesIA, "", "", "", ""].slice(0, 4);
      setPanelTexto(data.pregunta); setPanelOpciones(opciones4);
      const idx = typeof data.correctIndex === "number" && data.correctIndex >= 0 && data.correctIndex < 4 ? data.correctIndex : 0;
      setPanelCorrecta(idx);
    } catch (e) { console.error("ERROR IA CARRERA:", e); setIaError(isEnglish ? e?.message || "Could not generate the question." : e?.message || "No se pudo generar la pregunta con IA."); }
    finally { setIaLoading(false); }
  };

  const cerrarRonda = async () => { try { await updateDoc(doc(db, "carrera", carreraRoot, "meta", "pregunta"), { activa: false }); } catch (e) {} };

  const resetCarrera = async () => {
    const ok = window.confirm(t("¿Resetear carrera?", "Reset race?")); if (!ok) return;
    try {
      const uidSession = sessionId || null;
      let pQ = collection(db, "carrera", carreraRoot, "participantes");
      let pSnap = uidSession ? await getDocs(query(pQ, where("session", "==", uidSession))) : await getDocs(pQ);
      const batch1 = writeBatch(db); pSnap.forEach((d) => batch1.delete(d.ref)); await batch1.commit();
      let rQ = collection(db, "carrera", carreraRoot, "respuestas");
      let rSnap = uidSession ? await getDocs(query(rQ, where("session", "==", uidSession))) : await getDocs(rQ);
      const batch2 = writeBatch(db); rSnap.forEach((d) => batch2.delete(d.ref)); await batch2.commit();
      await setDoc(doc(db, "carrera", carreraRoot, "meta", "pregunta"), { texto: "", opciones: [], correcta: null, activa: false, startAt: serverTimestamp(), session: uidSession, mode: isSpecialClass ? "special" : "standard", lang: idioma }, { merge: true });
      setPanelTexto(""); setPanelOpciones(["", "", "", ""]); setPanelCorrecta(0); setRonda((r) => r + 1);
      alert(t("Carrera reseteada ✅", "Race has been reset ✅"));
    } catch (e) { alert(t("No se pudo resetear la carrera.", "The race could not be reset.")); }
  };

  const openExternal = (baseUrl) => {
    try {
      const url = new URL(baseUrl); url.searchParams.set("utm_source", "pragma"); url.searchParams.set("utm_medium", "launcher"); url.searchParams.set("utm_campaign", "cierre");
      const sala = localStorage.getItem("salaCode") || ""; if (sala) url.searchParams.set("code", sala);
      if (isSpecialClass) url.searchParams.set("mode", "special"); if (isEnglish) url.searchParams.set("lang", "en");
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (e) { window.open(baseUrl, "_blank", "noopener,noreferrer"); }
  };

  const goToCarrera = () => { try { const el = document.getElementById("carreraPanel"); if (el?.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} };

  const cronometroPropsCierre = { duracion, storageKey: CIERRE_TIMER_KEY + (isSpecialClass ? ":special" : ""), instanceId: isSpecialClass ? "cierre-especial" : "cierre" };

  function persistClaseForDesarrollo() {
    try { localStorage.setItem("bridge:desarrolloClase", JSON.stringify({ unidad: unidad || "", objetivo: objetivo || "", asignatura: asignaturaStable || "", curso: curso || "", ts: Date.now(), from: "cierre", specialClass: isSpecialClass || undefined, idioma })); } catch (_) {}
  }

  function goToDesarrollo() {
    persistClaseForDesarrollo();
    navigate("/desarrollo", { state: { from: "cierre", specialClass: isSpecialClass || undefined, claseEspecial: isSpecialClass || undefined, idioma, clase: { unidad, objetivo, asignatura: asignaturaStable, curso }, specialData: { unidad, objetivo, asignatura: asignaturaStable, curso, nombreProfesor } } });
  }

  function handleEndCierre() {
    try { persistClaseForDesarrollo(); } catch (_) {}
    clearAllCountdowns();
    navigate("/InicioClase", { replace: true, state: { resetTimers: true, from: "cierre", autoReturn: true, specialClass: isSpecialClass || undefined, claseEspecial: isSpecialClass || undefined, idioma, specialData: { unidad, objetivo, asignatura: asignaturaStable, curso, nombreProfesor } } });
  }

  const safeOnEndCierre = typeof handleEndCierre === "function" ? handleEndCierre : () => {};

  return (
    <div style={page} className="no-scroll-jump">
      {claseVigente && (
        <div style={{ ...card, marginBottom: "1rem", background: claseVigente.fuente === "calendario" ? "rgba(124,58,237,.08)" : claseVigente.fuente === "slots" ? "rgba(2,132,199,.08)" : "rgba(22,163,74,.12)" }}>
          <div style={{ fontWeight: 800 }}>{claseVigente.fuente === "calendario" ? t("Plan semanal (vigente)", "Weekly plan (active)") : claseVigente.fuente === "slots" ? t("Horario (fallback)", "Schedule (fallback)") : t("Clase especial", "Special class")}</div>
          {claseVigente.unidad && <div><b>{t("Unidad:", "Unit:")}</b> {claseVigente.unidad}{claseVigente.evaluacion ? t(" · (Evaluación)", " · (Assessment)") : ""}</div>}
          {claseVigente?.objetivo && <div><b>{t("Objetivo:", "Objective:")}</b> {claseVigente.objetivo}</div>}
        </div>
      )}

      <div style={{ ...row("1rem"), marginBottom: "1rem" }}>
        <div style={{ ...card, ...layerFix }} className="no-scroll-jump layer-accel">
          <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>{isSpecialClass ? t("Cierre · Clase especial", "Closing · Special class") : t("Cierre", "Closing")}</div>
          <div style={{ color: COLORS.textMuted, marginBottom: 8 }}>⏰ <HoraActualText /></div>
          <div className="tnum clock-w layer-accel" style={{ fontVariantNumeric: "tabular-nums lining-nums", fontFeatureSettings: "'tnum' 1, 'lnum' 1", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden" }}>
            <CronometroGlobal {...cronometroPropsCierre} onEnd={safeOnEndCierre} />
          </div>
        </div>
        <DatosClaseCard unidad={unidad} objetivo={objetivo} curso={curso} asignatura={asignaturaStable} t={t} />
        <ProfesorCard nombreProfesor={nombreProfesor} asignatura={asignaturaStable} t={t} />
      </div>

      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>{t("🧠 Nube de palabras final", "🧠 Final word cloud")}</h3>
        <NubeDePalabras
          modo="cierre" preset="showtime" cloudPreset={SHOWTIME_PRESET} rotationAggressive
          contrastBoost={SHOWTIME_PRESET.contrastBoost} angles={SHOWTIME_PRESET.rotate?.angles}
          colors={SHOWTIME_PRESET.colors} fontFamily={SHOWTIME_PRESET.fontFamily}
          fontWeight={SHOWTIME_PRESET.fontWeight} fontSizes={SHOWTIME_PRESET.fontSizes}
          spiral={SHOWTIME_PRESET.spiral} shuffle={SHOWTIME_PRESET.shuffle} padding={SHOWTIME_PRESET.padding}
        />
      </div>

      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>{t("🔗 Únete a la carrera", "🔗 Join the race")}</h3>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: `1px solid ${COLORS.border}` }}><QRCode value={joinURL} size={160} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{t("Sesión:", "Session:")} {sessionId || "—"}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 6 }}>{t("Pide a tus estudiantes abrir", "Ask your students to open")} <code>/participa</code></div>
            <code style={{ fontSize: 12, color: COLORS.textMuted }}>{joinURL}</code>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t("🎮 Centro de Juegos PRAGMA", "🎮 PRAGMA Games Hub")}</h3>
          <img src={portadaCarreraPragma} alt={isEnglish ? "PRAGMA games" : "Juegos PRAGMA"} style={{ height: 80, borderRadius: 12, objectFit: "cover", boxShadow: "0 8px 20px rgba(15,23,42,.35)" }} />
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 8 }}>{isSpecialClass ? t("Juegos PRAGMA para cerrar tu clase especial.", "PRAGMA games to finish your special class.") : t("Juegos propios de la plataforma PRAGMA para cerrar la clase.", "PRAGMA's own games to close the class.")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
          {GAMES.map((g) => {
            const gameName = isEnglish ? g.nameEn : g.nameEs; const gameDesc = isEnglish ? g.descEn : g.descEs;
            return (
              <div key={g.key} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {g.img && <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 28px rgba(15,23,42,0.28)", marginBottom: 4 }}><img src={g.img} alt={gameName} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} /></div>}
                <div style={{ fontWeight: 800 }}>{gameName}</div>
                <div style={{ color: COLORS.textMuted, fontSize: 14 }}>{gameDesc}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  {g.type === "internal" ? <button style={btnWhite} onClick={goToCarrera}>{t("🏁 Ir a Carrera PRAGMA", "🏁 Go to PRAGMA Race")}</button> : <button style={btnWhite} onClick={() => openExternal(g.url || "https://pragmaprofe.com")}>{t("🔗 Abrir", "🔗 Open")}</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="carreraPanel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{t("🎮 Mini panel del profesor", "🎮 Teacher mini panel")}</h3>
          <div style={{ ...smallMuted, marginBottom: 8 }}>{t("Publica una pregunta (texto + 0–4 opciones).", "Publish a question (text + 0–4 options).")}</div>
          <label style={{ fontWeight: 700 }}>{t("Pregunta", "Question")}</label>
          <input style={{ ...input, marginBottom: 8 }} value={panelTexto} onChange={(e) => setPanelTexto(e.target.value)} placeholder={isEnglish ? "Write the question…" : "Escribe la pregunta…"} />
          <label style={{ fontWeight: 700 }}>{t("Opciones (opcional)", "Options (optional)")}</label>
          {panelOpciones.map((op, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" name="correcta" checked={panelCorrecta === i} onChange={() => setPanelCorrecta(i)} title={t("Marcar correcta", "Mark as correct")} />
              <input style={input} value={op} onChange={(e) => { const arr = [...panelOpciones]; arr[i] = e.target.value; setPanelOpciones(arr); }} placeholder={isEnglish ? `Option ${i + 1}` : `Opción ${i + 1}`} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button style={btnWhite} onClick={publicarPregunta} disabled={publicando}>{t("🚀 Publicar ronda", "🚀 Publish round")}</button>
            <button style={btnWhite} onClick={cerrarRonda}>⛔ {t("Cerrar ronda", "Close round")}</button>
            <button style={btnWhite} onClick={generarPreguntaIA} disabled={iaLoading}>{iaLoading ? "⏳" + t(" Generando…", " Generating…") : "✨ IA Carrera"}</button>
          </div>
          <div style={{ ...smallMuted, marginTop: 8 }}>{pregunta?.activa ? t("Ronda ACTIVA", "ACTIVE round") : t("Ronda INACTIVA", "INACTIVE round")}{pregunta?.texto ? ` • "${pregunta.texto}"` : ""}</div>
          {iaError && <div style={{ ...smallMuted, marginTop: 4, color: "#b91c1c" }}>{iaError}</div>}
        </div>

        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{t("🏁 Carrera en vivo", "🏁 Live race")}</h3>
          <div style={{ ...smallMuted, marginBottom: 8 }}>{t("Avance = acierto (5 pts) + bonus por rapidez.", "Progress = correct answer (5 pts) + speed bonus.")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {ranking.length === 0 && <div style={{ color: COLORS.textMuted }}>{t("Aún no hay participantes.", "There are no participants yet.")}</div>}
            {ranking.map((p) => {
              const prog = Math.min(100, Math.round(p.progreso || 0));
              return (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ textAlign: "center", fontSize: 20 }}>{p.avatar || "🟢"}</div>
                  <div style={{ background: "#eef2f7", borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                    <div style={{ width: `${prog}%`, background: `linear-gradient(90deg, ${COLORS.brandA}, ${COLORS.brandB})`, color: "#fff", padding: "6px 10px", whiteSpace: "nowrap", textOverflow: "ellipsis" }} title={`${p.nombre || (isEnglish ? "Player" : "Jugador")} (${prog} pts)`}>
                      <strong style={{ fontSize: 12 }}>{p.nombre || (isEnglish ? "Player" : "Jugador")}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 800 }}>{p.progreso || 0}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={resetCarrera} style={btnWhite}>🧹 {t("Reset carrera", "Reset race")}</button>
        <button onClick={goToDesarrollo} style={btnWhite}>➡️ {t("Ir a Desarrollo", "Go to Development")}</button>
        <button onClick={() => { clearAllCountdowns(); navigate("/InicioClase", { replace: true, state: { resetTimers: true, from: "cierre", specialClass: isSpecialClass || undefined, claseEspecial: isSpecialClass || undefined, idioma, clase: { unidad, objetivo, asignatura: asignaturaStable, curso }, specialData: { unidad, objetivo, asignatura: asignaturaStable, curso, nombreProfesor } } }); }} style={btnWhite}>
          ⬅️ {t("Volver al Inicio", "Back to Start")}
        </button>
      </div>
    </div>
  );
}