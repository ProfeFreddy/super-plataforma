// src/pages/InicioClase.jsx  
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "react-qr-code";
import WordCloud from "react-d3-cloud";
import { db, auth } from "../firebase";
import {
  collection, doc, getDoc, onSnapshot, query, orderBy, setDoc, serverTimestamp,
} from "firebase/firestore";

import { getClaseVigente, getYearWeek } from "../services/PlanificadorService";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";
import { nivelDesdeCurso } from "../lib/niveles";
import { getPrimerOA } from "../services/curriculoService";
import CronometroGlobal from "../components/CronometroGlobal";
import NubeDePalabras from "../components/NubeDePalabras";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { SHOWTIME_PRESET } from "../lib/cloudPresets";
import EpicStarters from "../components/EpicStarters";
import { usePeriodoEval } from "../hooks/usePeriodoEval";
import BannerTrial from "../components/BannerTrial"; // ✅ AGREGADO
import {
  leerProfesorFallback,
  leerClaseFallback
} from "../lib/pragmaFallback";
function clearAllCountdowns() {
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "inicioClase_countdown_end" || k.startsWith("ic_countdown_end:") || k.startsWith("crono:"))
        toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch (e) { console.warn("[clearAllCountdowns]", e); }
}

const SPECIAL_CLASS_META_KEY = "pragma:specialClassMeta";

const LABELS = {
  es: {
    inicio: "Inicio", desarrollo: "Desarrollo de la clase", profesor: "Profesor",
    habilidades: "Habilidades", objetivo: "Objetivo", unidad: "Unidad",
    nube: "Nube de palabras", escanea: "Escanea para participar",
    asistencia: "Asistencia", presentes: "Presentes",
    ultimosEnvios: "Últimos envíos", sinRespuestas: "Aún no hay respuestas",
    nadieEscanea: "Aún nadie ha escaneado",
    espacioFuturo: "Espacio reservado para funciones futuras",
    pagoRecibidoTitulo: "✅ ¡Pago recibido!", pagoRecibidoTexto: "Tu plan quedó activo.",
    cargandoCurriculo: "Cargando currículo MINEDUC…",
    sinCurriculo: "No se encontró información curricular para esta unidad.",
    objAprendizaje: "Objetivos de Aprendizaje", habilidadesTitulo: "Habilidades",
    sinObj: "(Sin objetivos cargados)", sinHab: "(Sin habilidades cargadas)",
    especialTitulo: "Clase especial",
    especialTexto: "Estás en modo de clase especial.",
    nubeSinPalabras: "Aún no hay palabras. Pide a tus estudiantes que escaneen el QR y envíen una palabra.",
    nubeDesactivada: "(Nube desactivada con ?nocloud=1 para pruebas)",
    botonReiniciarNube: "Reiniciar nube", botonReiniciandoNube: "Reiniciando...",
    errorReiniciarNube: "No se pudo reiniciar la nube. Intenta nuevamente.",
    objetivoNubeTitulo: "Objetivo sugerido desde la nube de palabras",
    objetivoNubeDesc: "Usa las palabras más frecuentes que están enviando tus estudiantes para construir una idea de enlace entre lo vivido y lo que viene, sin modificar el objetivo general de la unidad.",
    objetivoNubeBtn: "✨ Generar idea de enlace con la nube",
    objetivoNubeGuardando: "Guardando ficha…", objetivoNubeIdea: "Idea de enlace sugerida:",
    objetivoNubeNota: "(Puedes editar este texto desde aquí o en las pantallas de Desarrollo/Cierre).",
    objetivoNubeSinPalabras: "Aún no hay suficientes palabras en la nube para sugerir una idea de enlace.",
    objetivoNubeError: "No se pudo generar la idea de enlace desde la nube de palabras.",
    irDesarrollo: "Ir a Desarrollo", volverInicio: "Volver al Inicio",
    editarHorario: "Editar horario", planSemanal: "Plan semanal (vigente)",
    horarioFallback: "Horario (fallback)", sinPlan: "Sin clase planificada",
    unidadLabel: "Unidad:", objetivoLabel: "Objetivo:", habilidadesLabel: "Habilidades:",
    cursoLabel: "Curso:", seccionLabel: "Sección:",
    sinSugerencias: "No hay sugerencias registradas.",
    verPrograma: "Ver Programa de Estudio", nadiePalabras: "Aún no hay palabras.",
  },
  en: {
    inicio: "Start", desarrollo: "Lesson flow", profesor: "Teacher",
    habilidades: "Skills", objetivo: "Objective", unidad: "Unit",
    nube: "Word cloud", escanea: "Scan to join",
    asistencia: "Attendance", presentes: "Students present",
    ultimosEnvios: "Latest submissions", sinRespuestas: "No responses yet",
    nadieEscanea: "No one has scanned yet",
    espacioFuturo: "Reserved space for future features",
    pagoRecibidoTitulo: "✅ Payment received!", pagoRecibidoTexto: "Your plan is now active.",
    cargandoCurriculo: "Loading MINEDUC curriculum…",
    sinCurriculo: "No curriculum information found for this unit.",
    objAprendizaje: "Learning objectives", habilidadesTitulo: "Skills",
    sinObj: "(No objectives loaded)", sinHab: "(No skills loaded)",
    especialTitulo: "Special class",
    especialTexto: "You are in special class mode.",
    nubeSinPalabras: "No words yet. Ask your students to scan the QR and send one word.",
    nubeDesactivada: "(Word cloud disabled with ?nocloud=1 for testing)",
    botonReiniciarNube: "Reset word cloud", botonReiniciandoNube: "Resetting...",
    errorReiniciarNube: "Could not reset the word cloud. Please try again.",
    objetivoNubeTitulo: "Linking idea suggested from the word cloud",
    objetivoNubeDesc: "Use the most frequent words your students send to build a linking idea.",
    objetivoNubeBtn: "✨ Generate linking idea from cloud",
    objetivoNubeGuardando: "Saving class record…", objetivoNubeIdea: "Suggested linking idea:",
    objetivoNubeNota: "(You can edit this text here or later in Development/Closing screens).",
    objetivoNubeSinPalabras: "There are not enough words in the cloud yet.",
    objetivoNubeError: "We couldn't generate a linking idea from the word cloud.",
    irDesarrollo: "Go to Development", volverInicio: "Back to Home",
    editarHorario: "Edit schedule", planSemanal: "Weekly plan (active)",
    horarioFallback: "Schedule (fallback)", sinPlan: "No planned class",
    unidadLabel: "Unit:", objetivoLabel: "Objective:", habilidadesLabel: "Skills:",
    cursoLabel: "Class:", seccionLabel: "Section:",
    sinSugerencias: "No suggestions registered.",
    verPrograma: "View Study Program", nadiePalabras: "No words yet.",
  },
};

const INICIO_CLASE_CANDIDATES = ["/InicioClase","/inicioClase","/inicioclase","/Inicioclase","/inicio"];

function getInicioClasePath() {
  try {
    const ls = localStorage.getItem("inicioClasePath");
    const win = (typeof window !== "undefined" && window.__INICIO_CLASE_PATH) || null;
    return (ls && String(ls)) || (win && String(win)) || INICIO_CLASE_CANDIDATES[0];
  } catch { return INICIO_CLASE_CANDIDATES[0]; }
}

function makeUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const hostOverride = localStorage.getItem("hostOverride");
  const base = hostOverride && /^https?:\/\/.*/.test(hostOverride) ? hostOverride.replace(/\/+$/, "") : window.location.origin;
  const useHash = typeof window !== "undefined" && (window.location.hash?.startsWith("#/") || window.location.href.includes("/#/"));
  return useHash ? `${base}/#${p}` : `${base}${p}`;
}

function getSalaCodeSafe() { try { return localStorage.getItem("salaCode") || ""; } catch { return ""; } }

function getHashQuery() {
  try {
    const hash = window.location.hash || "";
    const qStr = hash.includes("?") ? hash.split("?")[1] : "";
    return new URLSearchParams(qStr || window.location.search || "");
  } catch { return new URLSearchParams(); }
}

function useAuthReadyLight() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) { const cred = await signInAnonymously(auth); if (!alive) return; setUser(cred.user ?? null); }
        else setUser(u);
      } catch { setUser(null); }
      finally { if (alive) setReady(true); }
    });
    return () => { alive = false; unsub && unsub(); };
  }, []);
  return { ready, user, isAnon: !!user?.isAnonymous };
}

function makeCountKey(slotId = "0-0") {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek();
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
}

const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00";
function getNowForSchedule() { return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date(); }

const PLAN_DEFAULTS = { user: null, plan: "FREE", caps: PLAN_CAPS.FREE, loading: false };

const COLORS = {
  brandA: "#2193b0", brandB: "#6dd5ed", white: "#ffffff",
  textDark: "#1f2937", textMuted: "#475569", border: "#e5e7eb", btnText: "#2193b0",
};
const page = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: "2rem", fontFamily: "Segoe UI, sans-serif",
  color: COLORS.white, boxSizing: "border-box",
};
const row = (gap = "1rem") => ({ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap, alignItems: "stretch" });
const card = {
  background: COLORS.white, color: COLORS.textDark, borderRadius: 12, padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
  border: `1px solid ${COLORS.border}`, maxWidth: "100%", overflow: "hidden",
};
const btnWhite = {
  background: COLORS.white, color: COLORS.btnText, border: "none", borderRadius: 10,
  padding: ".6rem .9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,.15)",
};
const btnTiny = { ...btnWhite, padding: ".35rem .6rem", fontWeight: 600, boxShadow: "none", border: `1px solid ${COLORS.border}` };

const COUNT_KEY = "inicioClase_countdown_end";
const getRemaining = (endMs) => {
  const diff = Math.max(0, endMs - Date.now());
  return { m: Math.floor(diff / 60000), s: Math.floor((diff % 60000) / 1000), finished: diff === 0 };
};
const formatMMSS = (m, s) => `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

function nowFromQuery() {
  const q = getHashQuery();
  const at = q.get("at");
  if (!at) return new Date();
  const [hh, mm] = at.split(":").map(Number);
  const d = new Date(); d.setHours(hh); d.setMinutes(mm); d.setSeconds(0); d.setMilliseconds(0);
  return d;
}

function dowFromQuery() {
  const q = getHashQuery();
  const v = Number(q.get("dow"));
  return v >= 1 && v <= 5 ? v : null;
}

function slotFromQuery() {
  try {
    const q = getHashQuery();
    const s = q.get("slot");
    if (!s) return null;
    const [f, c] = s.split("-").map((n) => Number(n));
    if (Number.isInteger(f) && Number.isInteger(c)) return `${f}-${c}`;
  } catch {}
  return null;
}

const colDeHoy = () => {
  const qDow = dowFromQuery();
  const d = qDow != null ? qDow : FORCE_TEST_TIME ? getNowForSchedule().getDay() : new Date().getDay();
  return d >= 1 && d <= 5 ? d - 1 : 0;
};

const filaDesdeMarcas = (marcas = []) => {
  const now = FORCE_TEST_TIME ? getNowForSchedule() : nowFromQuery();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < marcas.length - 1; i++) {
    const start = marcas[i][0] * 60 + marcas[i][1];
    const end = marcas[i + 1][0] * 60 + marcas[i + 1][1];
    if (mins >= start && mins < end) return i;
  }
  return 0;
};

function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object")
    return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  if (Array.isArray(cfg.marcasStr))
    return cfg.marcasStr.map((s) => { const [h, m] = String(s).split(":").map((n) => Number(n) || 0); return [h, m]; });
  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) {
    const startTimes = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...startTimes, lastEnd].map((s) => { const [h, m] = s.split(":").map((n) => Number(n) || 0); return [h, m]; });
  }
  return [];
}

const randCode = () => String(Math.floor(10000 + Math.random() * 90000));

function supportsSvgTextBBox() {
  try {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("width","0"); svg.setAttribute("height","0");
    const t = document.createElementNS(NS, "text"); t.textContent = "m"; svg.appendChild(t);
    document.body.appendChild(svg); const bbox = t.getBBox(); document.body.removeChild(svg);
    return Number.isFinite(bbox?.width) && bbox.width > 0;
  } catch { return false; }
}
const isProblematicUA = () => /OPR|Opera Mini|Opera/i.test(navigator.userAgent);

class CloudBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { try { localStorage.setItem("cloudMode","html"); } catch {} return { hasError: true }; }
  componentDidCatch(err) { console.error("[WordCloud SVG] error:", err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

class GlobalBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err) { return { hasError: true, err }; }
  componentDidCatch(err, info) { console.error("[InicioClase] render error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#f8fafc", fontFamily:"Segoe UI, sans-serif" }}>
          <div style={{ maxWidth:720, background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px" }}>
            <h3 style={{ margin:"0 0 8px" }}>Ocurrió un error al renderizar esta pantalla</h3>
            <code style={{ display:"block", background:"#0f172a", color:"#e2e8f0", padding:"10px", borderRadius:8 }}>
              {window.location.origin}/#/InicioClase?safe=1&bypass=1
            </code>
            <div style={{ marginTop:12, color:"#475569" }}>{String(this.state.err?.message || this.state.err) || "(no message)"}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function HtmlCloud({ data, palette, fontSize }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", padding:"6px 2px" }}>
      {data.map((w, i) => (
        <span key={w.key || `${w.text}_${i}`}
          style={{ fontWeight:800, fontSize:fontSize(w), lineHeight:1.05, color:palette[i % palette.length], whiteSpace:"nowrap", userSelect:"none" }}
          title={`${w.text} ×${w.value}`}>{w.text}</span>
      ))}
    </div>
  );
}

function CanvasCloud({ data, palette, width, height, fontSize }) {
  const ref = useRef(null);
  const authed = !!(auth.currentUser?.uid || localStorage.getItem("uid"));
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.floor(width * dpr); cvs.height = Math.floor(height * dpr);
    cvs.style.width = `${width}px`; cvs.style.height = `${height}px`;
    const ctx = cvs.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const words = [...data].sort((a, b) => fontSize(b) - fontSize(a));
    const centerX = width / 2, centerY = height / 2, placed = [], padding = 4, b = 6, step = 0.35;
    const collides = (r1, r2) => !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
    words.forEach((w, idx) => {
      const size = Math.max(12, Math.floor(fontSize(w))), text = String(w.text || ""), color = palette[idx % palette.length];
      let t = 0, found = false, px = centerX, py = centerY, rect;
      for (let tries = 0; tries < 2000; tries++) {
        const r = b * t; px = centerX + r * Math.cos(t); py = centerY + r * Math.sin(t);
        ctx.font = `bold ${size}px Segoe UI, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
        const metrics = ctx.measureText(text), tw = metrics.width, th = size * 0.9;
        rect = { x: px - tw/2 - padding, y: py - th/2 - padding, w: tw + 2*padding, h: th + 2*padding };
        if (placed.every((p) => !collides(p, rect))) { found = true; break; } t += step;
      }
      ctx.fillStyle = color; ctx.globalAlpha = 0.95; ctx.fillText(text, px, py); ctx.globalAlpha = 1;
      if (found) placed.push(rect);
    });
  }, [data, palette, width, height, fontSize, authed]);
  return <canvas ref={ref} style={{ display:"block", width, height }} />;
}

function ICDebugBadge({ show, data }) {
  if (!show) return null;
  const safeVal = (val) => { if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val); if (val === null || val === undefined) return ""; try { return JSON.stringify(val); } catch { return "[obj]"; } };
  const rowItem = (k, v) => (
    <div key={k} style={{ display:"flex", flexDirection:"column", gap:2, borderBottom:"1px solid rgba(255,255,255,.12)", paddingBottom:4 }}>
      <span style={{ opacity:0.75 }}>{k}</span>
      <pre style={{ margin:0, fontSize:11, background:"#064e3b", color:"#d1fae5", padding:"2px 4px", borderRadius:4, maxWidth:"100%", overflowX:"auto" }}>{safeVal(v)}</pre>
    </div>
  );
  return (
    <div style={{ position:"fixed", left:12, bottom:12, zIndex:9999, background:"#052e16", color:"#d1fae5", padding:"10px 12px", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.35)", width:260, maxHeight:240, overflowY:"auto", fontFamily:"Segoe UI, system-ui, sans-serif", fontSize:12 }}>
      <div style={{ fontWeight:800, marginBottom:6 }}>InicioClase — debug</div>
      <div style={{ display:"grid", gap:6 }}>{Object.entries(data).map(([k, v]) => rowItem(k, v))}</div>
    </div>
  );
}

function buildCloud(items = []) {
  const map = new Map();
  for (const r of items) {
    const k = String(r?.text || r?.texto || "").trim(); if (!k) continue;
    const key = k.toLowerCase(), v = Number(r?.value ?? r?.count ?? 1);
    map.set(key, (map.get(key) || 0) + (isFinite(v) ? v : 1));
  }
  return Array.from(map, ([text, value]) => ({ text, value })).sort((a, b) => b.value - a.value).slice(0, 120);
}

function InicioClaseInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = useMemo(() => getHashQuery(), [location.search, location.hash]);

  const state = location.state || {};
  const specialClassState = state.specialClass || state.claseEspecial || state.specialMode || state.specialData || null;
  const idiomaState = state.idioma || specialClassState?.idioma || null;
  const isEspecial = search.get("especial") === "1" || Boolean(specialClassState);
  const baseLang = idiomaState || search.get("lang") || "es";
  const lang = baseLang.toLowerCase().startsWith("en") ? "en" : "es";
  const tituloEspecial = search.get("t") || specialClassState?.unidad || specialClassState?.unit || specialClassState?.unitTitle || "";
  const objetivoEspecial = search.get("o") || specialClassState?.objetivo || specialClassState?.objective || "";
  const notasEspeciales = search.get("notes") || specialClassState?.notas || specialClassState?.notes || "";

  const labels = LABELS[lang] || LABELS.es;
  const t = (es, en) => (lang === "en" ? en : es);

  const { ready: authReady } = useAuthReadyLight();
  const { user: userPlan = PLAN_DEFAULTS.user, plan = PLAN_DEFAULTS.plan, caps = PLAN_DEFAULTS.caps, loading = PLAN_DEFAULTS.loading } = useContext(PlanContext) || PLAN_DEFAULTS;

  const [currentSlotId, setCurrentSlotId] = useState("0-0");
  const [authed, setAuthed] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const [nombre, setNombre] = useState("Profesor");
  const DEFAULT_SLOGAN = lang === "en" ? "From one teacher to another" : "De un profe para los profes";
  const [slogan, setSlogan] = useState(DEFAULT_SLOGAN);
  const [asignaturaProfe, setAsignaturaProfe] = useState("");
  const [horaActual, setHoraActual] = useState("");
  const [claseActual, setClaseActual] = useState(null);
  const [fallbackClase, setFallbackClase] = useState(null);
  const [fallbackProfesor, setFallbackProfesor] = useState(null);
  const [planSug, setPlanSug] = useState(null);
  const [preguntaClase, setPreguntaClase] = useState(lang === "en" ? "Which word best represents the last class?" : "¿Qué palabra representa mejor la última clase?");
  const [ultimos, setUltimos] = useState([]);
  const [presentes, setPresentes] = useState([]);
  const [claseVigente, setClaseVigente] = useState(null);
  const [salaCode, setSalaCode] = useState(getSalaCodeSafe());
  const [participaURL, setParticipaURL] = useState("");
  const [palabrasAgg, setPalabrasAgg] = useState([]);
  const [cloudMode, setCloudMode] = useState("auto");
  const [curriculo, setCurriculo] = useState(null);
  const [cargandoCurriculo, setCargandoCurriculo] = useState(true);
  const ALLOW_ANON = true;
  const [chronoDone, setChronoDone] = useState(false);
  const [objetivoIA, setObjetivoIA] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [paidOk, setPaidOk] = useState(false);

  const DISABLE_CLOUD = search.get("nocloud") === "1";
  const DEBUG_ON = search.get("debug") === "1";
  const BYPASS_NAV = search.get("bypass") === "1";

  const { evaluaciones: evalsProximas } = usePeriodoEval({
    nivel: claseActual?.nivel || "",
    seccion: claseActual?.seccion || "",
    asignatura: claseActual?.asignatura || asignaturaProfe || "",
  });

  useEffect(() => {
    try { const qs = getHashQuery(); if (qs.get("paid") === "1") { setPaidOk(true); navigate(location.pathname, { replace: true }); } } catch {}
  }, [location, navigate]);

  useEffect(() => {
    setHoraActual(new Date().toLocaleTimeString());
    const id = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { const s = slotFromQuery() || localStorage.getItem("__lastSlotId"); if (s) setCurrentSlotId(s); }, []);

  useEffect(() => {
    let didTryAnon = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setAuthed(true); setIsAnon(!!u.isAnonymous);
        const stored = localStorage.getItem("uid"); if (stored !== u.uid) localStorage.setItem("uid", u.uid); return;
      }
      if (ALLOW_ANON && !didTryAnon) {
        didTryAnon = true;
        try { const cred = await signInAnonymously(auth); if (cred?.user?.uid) { localStorage.setItem("uid", cred.user.uid); setAuthed(true); setIsAnon(true); } }
        catch (e) { console.error("Anon sign-in:", e); }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const st = location?.state || null; if (!st) return;
    try {
      const prof = st.profesor || {};
      if (prof?.nombre) setNombre(prof.nombre);
      if (prof?.slogan) setSlogan(String(prof.slogan).trim() || DEFAULT_SLOGAN);
      const specialData = st.specialData || st.specialClass || st.claseEspecial || null;
      if (specialData) {
        if (specialData.nombreProfesor || specialData.teacherName)
          setNombre(specialData.nombreProfesor || specialData.teacherName || "Profesor");
        setClaseActual((prev) => ({ ...(prev || {}), unidad: specialData.unidad || specialData.unit || prev?.unidad || "(sin unidad)", objetivo: specialData.objetivo || specialData.objective || prev?.objetivo || "(sin objetivo)", asignatura: specialData.asignatura || specialData.subject || prev?.asignatura || asignaturaProfe || "(sin asignatura)", curso: specialData.curso || specialData.course || prev?.curso || "(sin curso)" }));
      }
      const cls = st.clase || null;
      if (cls) { setClaseActual((prev) => ({ ...(prev || {}), unidad: cls.unidad ?? prev?.unidad ?? "(sin unidad)", objetivo: cls.objetivo ?? prev?.objetivo ?? "(sin objetivo)", habilidades: cls.habilidades ?? prev?.habilidades ?? "(sin habilidades)", asignatura: cls.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)" })); }
    } catch {}
  }, [location.state, DEFAULT_SLOGAN, lang, asignaturaProfe]);

  useEffect(() => {
    if (!isEspecial) return;
    setClaseActual((prev) => ({ ...(prev || {}), unidad: tituloEspecial || prev?.unidad || "(sin unidad)", objetivo: objetivoEspecial || prev?.objetivo || "(sin objetivo)", notasEspeciales: notasEspeciales || prev?.notasEspeciales || "" }));
    try { localStorage.setItem(SPECIAL_CLASS_META_KEY, JSON.stringify({ tituloEspecial, objetivoEspecial, notasEspeciales, lang, updatedAt: Date.now() })); } catch {}
  }, [isEspecial, tituloEspecial, objetivoEspecial, notasEspeciales, lang]);

  useEffect(() => {
    if (isEspecial) return;
    (async () => {
      try {
        const res = await getClaseVigente(new Date()); setClaseVigente(res);
        if (res && (res.unidad || res.objetivo || res.habilidades)) {
          setClaseActual((prev) => ({ ...(prev || {}), unidad: res.unidad ?? prev?.unidad ?? "(sin unidad)", objetivo: res.objetivo ?? prev?.objetivo ?? "(sin objetivo)", habilidades: res.habilidades ?? prev?.habilidades ?? "(sin habilidades)", asignatura: res.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)" }));
        }
      } catch (e) { console.error("[Inicio] getClaseVigente:", e); }
    })();
  }, [asignaturaProfe, isEspecial, lang]);

  useEffect(() => {
    if (isEspecial) { setCargandoCurriculo(false); return; }
    let stop = false;
    async function run() {
      try {
        setCargandoCurriculo(true); setCurriculo(null);
        const cod = claseVigente?.codUnidad || null; if (!cod) { setCargandoCurriculo(false); return; }
        const snap = await getDoc(doc(db, "curriculo", cod));
        if (!stop) { if (snap.exists()) setCurriculo(snap.data()); setCargandoCurriculo(false); }
      } catch (e) { console.warn("[curriculo] read:", e?.code || e?.message); if (!stop) setCargandoCurriculo(false); }
    }
    run(); return () => { stop = true; };
  }, [claseVigente, isEspecial]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (uid) {
        try { const usnap = await getDoc(doc(db, "usuarios", uid)); if (usnap.exists()) { const u = usnap.data(); if (u?.nombre) setNombre(u.nombre); if (u?.asignatura) setAsignaturaProfe(u.asignatura); if (u?.slogan) setSlogan(String(u.slogan).trim() || DEFAULT_SLOGAN); } } catch (e) { console.warn("[usuarios] read:", e?.code); }
        try { const psnap = await getDoc(doc(db, "profesores", uid)); if (psnap.exists()) { const p = psnap.data() || {}; if (p?.slogan && (!slogan || slogan === DEFAULT_SLOGAN)) setSlogan(String(p.slogan).trim() || DEFAULT_SLOGAN); } } catch (e) { console.warn("[profesores] read slogan:", e?.code); }
      }
      try { const psnap = await getDoc(doc(db, "preguntaClase", "actual")); if (psnap.exists() && psnap.data()?.texto) setPreguntaClase(psnap.data().texto); } catch (e) { console.warn("[preguntaClase] read:", e?.code); }
    })();
  }, [authed, DEFAULT_SLOGAN, slogan]);

  useEffect(() => {
    if (!authed || isEspecial) return;
    const pick = (...vals) => { for (const v of vals) { const s = (v ?? "").toString().trim(); if (s && !/^\(sin/i.test(s) && !/^\(no /i.test(s)) return s; } return vals.find(Boolean) || ""; };
    const normHabs = (x) => Array.isArray(x) ? x.join(", ") : x ?? "";
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid"); if (!uid) return;
        try { const psnap = await getDoc(doc(db, "profesores", uid)); if (psnap.exists()) { const p = psnap.data() || {}; setClaseActual((prev) => ({ ...(prev || {}), unidad: pick(prev?.unidad, p.unidad, p.unidadInicial, "(sin unidad)"), objetivo: pick(prev?.objetivo, p.objetivo, p.objetivoInicial, "(sin objetivo)"), habilidades: pick(prev?.habilidades, normHabs(p.habilidades), "(sin habilidades)"), asignatura: pick(prev?.asignatura, asignaturaProfe, p.asignatura, "(sin asignatura)"), curso: pick(prev?.curso, p.curso, "(sin curso)") })); } } catch (e) { console.warn("[Inicio] profesores read:", e?.code || e); }
        try { const usnap = await getDoc(doc(db, "usuarios", uid)); if (usnap.exists()) { const u = usnap.data() || {}; setClaseActual((prev) => ({ ...(prev || {}), unidad: prev?.unidad && !/^\(sin/i.test(prev?.unidad) ? prev?.unidad : u.unidadInicial ?? u.unidad ?? "(sin unidad)", objetivo: prev?.objetivo && !/^\(sin/i.test(prev?.objetivo) ? prev?.objetivo : u.objetivo ?? "(sin objetivo)", habilidades: prev?.habilidades && !/^\(sin/i.test(prev?.habilidades) ? prev?.habilidades : normHabs(u.habilidades) || "(sin habilidades)", asignatura: pick(prev?.asignatura, asignaturaProfe, u.asignatura, "(sin asignatura)"), curso: pick(prev?.curso, u.curso, "(sin curso)") })); } } catch (e) { console.warn("[Inicio] usuarios fallback:", e?.code || e); }
      } catch {}
    })();
  }, [authed, asignaturaProfe, isEspecial, lang]);

  useEffect(() => {
    if (!authed || isEspecial) return;
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid"); if (!uid) return;
        const sQ = slotFromQuery();
        if (sQ) {
          setCurrentSlotId(sQ); try { localStorage.setItem("__lastSlotId", sQ); } catch {}
          const dsQ = await getDoc(doc(db, "clases_detalle", uid, "slots", sQ));
          if (dsQ.exists()) { const det = dsQ.data(); setClaseActual((prev) => ({ ...(prev || {}), unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)", objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)", habilidades: det.habilidades ?? prev?.habilidades ?? "(sin habilidades)", asignatura: det.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)", nivel: det.nivel ?? prev?.nivel ?? "", seccion: det.seccion ?? prev?.seccion ?? "", curso: det.curso ?? prev?.curso ?? "" })); }
          return;
        }
        const usnap = await getDoc(doc(db, "usuarios", uid));
        const cfg = usnap.exists() ? usnap.data().horarioConfig || {} : {};
        const marcasArr = getMarcasFromConfig(cfg);
        if (marcasArr.length > 1) {
          const fila = filaDesdeMarcas(marcasArr), col = colDeHoy(), slotId = `${fila}-${col}`;
          setCurrentSlotId(slotId); try { localStorage.setItem("__lastSlotId", slotId); } catch {}
          const dsnap = await getDoc(doc(db, "clases_detalle", uid, "slots", slotId));
          if (dsnap.exists()) { const det = dsnap.data(); setClaseActual((prev) => ({ ...(prev || {}), unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)", objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)", habilidades: det.habilidades ?? prev?.habilidades ?? "(sin habilidades)", asignatura: det.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)", nivel: det.nivel ?? prev?.nivel ?? "", seccion: det.seccion ?? prev?.seccion ?? "", curso: det.curso ?? prev?.curso ?? "" })); }
        }
      } catch (e) { console.warn("[horarioConfig.marcas → clases_detalle]", e?.code || e?.message); }
    })();
  }, [authed, asignaturaProfe, isEspecial, lang]);

useEffect(() => {
  fetch("/data/inicio_clase_fallback.json")
    .then((res) => res.json())
    .then(async (data) => {
    setFallbackClase(data);

    const profesor = await leerProfesorFallback();
    setFallbackProfesor(profesor);

    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
const slot =
  params.get("slot") ||
  localStorage.getItem("__lastSlotId") ||
  currentSlotId ||
  "9-3";

    const clase = await leerClaseFallback(slot);

    if (clase) {
    setFallbackClase((prev) => ({
        ...prev,
        ...Object.fromEntries(
            Object.entries(clase || {}).filter(([_, v]) => {
                if (Array.isArray(v)) return v.length > 0;
                return v !== "" && v !== null && v !== undefined;
            })
        ),
        profesor: profesor?.nombre || prev?.profesor,
        colegio: profesor?.colegio || prev?.colegio
    }));
}
})
    .catch((err) => {
      console.warn("No se pudo cargar inicio_clase_fallback.json", err);
    });
}, []);

  useEffect(() => {
    (async () => {
      let code = salaCode; if (!code) { code = randCode(); localStorage.setItem("salaCode", code); setSalaCode(code); }
      try { await setDoc(doc(db, "salas", code), { activa: true, createdAt: serverTimestamp() }, { merge: true }); } catch (e) { console.warn("[sala] setDoc:", e?.code || e?.message); }
      setParticipaURL(code ? makeUrl(`/sala/${code}`) : makeUrl("/participa"));
    })();
  }, []);

  useEffect(() => {
    if (!authed || window.__salaInitDone) return;
    (async () => {
      try {
        let code = salaCode || localStorage.getItem("salaCode");
        if (!code) { code = randCode(); localStorage.setItem("salaCode", code); setSalaCode(code); }
        await setDoc(doc(db, "salas", code), { activa: true, createdAt: serverTimestamp() }, { merge: true });
        setParticipaURL(code ? makeUrl(`/sala/${code}`) : makeUrl("/participa"));
        window.__salaInitDone = true;
      } catch (e) { console.warn("[sala][authed] setDoc:", e?.code || e?.message); }
    })();
  }, [authed, salaCode]);

  useEffect(() => {
    if (!salaCode) return;
    const qResp = query(collection(db, "salas", salaCode, "palabras"), orderBy("timestamp", "desc"));
    const unsubResp = onSnapshot(qResp, (snap) => {
      const arr = []; snap.forEach((d) => { const data = d.data() || {}; arr.push({ id: d.id, texto: data.texto || data.text || "", ts: data.timestamp?.toMillis?.() || data.ts || 0, numeroLista: data.numeroLista ?? null }); });
      setUltimos(arr.slice(0, 10)); setPalabrasAgg(buildCloud(arr));
    }, (e) => console.warn("[salas/palabras] onSnapshot:", e?.code || e));
    const qAsist = collection(db, "salas", salaCode, "asistencia");
    const unsubAsist = onSnapshot(qAsist, (snap) => { const arr = []; snap.forEach((d) => arr.push({ id: d.id, ...(d.data() || {}) })); setPresentes(arr); }, (e) => console.warn("[salas/asistencia] onSnapshot:", e?.code || e));
    return () => { unsubResp(); unsubAsist(); };
  }, [salaCode]);

  const [remaining, setRemaining] = useState({ m: 10, s: 0 });
  useEffect(() => {
    if (!currentSlotId) return;
    const key = makeCountKey(currentSlotId);
    let endStr = localStorage.getItem(key) || localStorage.getItem(COUNT_KEY);
    if (!endStr || Number(endStr) < Date.now()) { const endTime = Date.now() + 10*60*1000; localStorage.setItem(key, String(endTime)); localStorage.setItem(COUNT_KEY, String(endTime)); endStr = String(endTime); }
    const endMs = Number(endStr), tick = () => setRemaining(getRemaining(endMs));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [currentSlotId]);

  const resetCountdown = () => {
    const endTime = Date.now() + 10*60*1000, key = makeCountKey(currentSlotId || "0-0");
    localStorage.setItem(key, String(endTime)); localStorage.setItem(COUNT_KEY, String(endTime));
    setRemaining(getRemaining(endTime));
  };

  const nuevaSala = async () => {
    if (!confirm("¿Limpiar la nube de palabras y crear sala nueva?")) return;
    const code = randCode(); localStorage.setItem("salaCode", code); setSalaCode(code);
    setPalabrasAgg([]); setUltimos([]); setPresentes([]); window.__salaInitDone = false;
    try { await setDoc(doc(db, "salas", code), { activa: true, createdAt: serverTimestamp() }, { merge: true }); setParticipaURL(makeUrl(`/sala/${code}`)); }
    catch (e) { console.warn("[nuevaSala]", e); }
  };

  const makeFicha = () => {
    const habilidadesTxt = Array.isArray(claseActual?.habilidades) ? claseActual.habilidades.join("; ") : claseActual?.habilidades ?? "";
    return { asignatura: claseActual?.asignatura ?? asignaturaProfe ?? "(sin asignatura)", unidad: claseActual?.unidad ?? "(sin unidad)", objetivo: claseActual?.objetivo ?? "(sin objetivo)", habilidades: habilidadesTxt ?? "(sin habilidades)", nivel: claseActual?.nivel ?? "", seccion: claseActual?.seccion ?? "", curso: claseActual?.curso ?? "", bloque: claseActual?.bloque ?? "", dia: claseActual?.dia ?? "", codUnidad: claseVigente?.codUnidad ?? planSug?.codUnidad ?? "", programaUrl: planSug?.programaUrl ?? "", fuentes: Array.isArray(planSug?.fuentes) ? planSug.fuentes : [], planId: planSug?.planId ?? "", updatedAt: Date.now(), especial: isEspecial, tituloEspecial: tituloEspecial || "", objetivoEspecial: objetivoEspecial || "", notasEspeciales: notasEspeciales || "" };
  };

  const buildSlotPayload = () => {
    const habilidadesTxt = Array.isArray(claseActual?.habilidades) ? claseActual.habilidades.join(", ") : claseActual?.habilidades ?? "";
    return { asignatura: claseActual?.asignatura ?? asignaturaProfe ?? "", curso: claseActual?.curso ?? claseVigente?.curso ?? "", nivel: claseActual?.nivel ?? claseVigente?.nivel ?? nivelDesdeCurso(claseActual?.curso || claseVigente?.curso || "") ?? "", seccion: claseActual?.seccion ?? "", unidad: claseActual?.unidad ?? claseVigente?.unidad ?? "", objetivo: claseActual?.objetivo ?? "", habilidades: habilidadesTxt || "", bloque: claseActual?.bloque ?? "", dia: claseActual?.dia ?? "", codUnidad: claseVigente?.codUnidad ?? planSug?.codUnidad ?? "", programaUrl: planSug?.programaUrl ?? "", especial: isEspecial, tituloEspecial: tituloEspecial || "", objetivoEspecial: objetivoEspecial || "", notasEspeciales: notasEspeciales || "", lang };
  };

  const saveCurrentSlot = async (extra = {}) => {
    setSaveError(""); if (!authed) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid"); if (!uid || !currentSlotId) return;
    try {
      setSavingSlot(true); const basePayload = buildSlotPayload(), payload = { ...basePayload, ...extra, updatedAt: serverTimestamp() };
      await setDoc(doc(db, "clases_detalle", uid, "slots", currentSlotId), payload, { merge: true });
      try { localStorage.setItem("currentSlot", JSON.stringify({ slotId: currentSlotId, ...basePayload, ...extra })); } catch {}
    } catch (e) { console.warn("[saveCurrentSlot]", e?.code || e?.message); setSaveError("No se pudo guardar la ficha de la clase."); }
    finally { setSavingSlot(false); }
  };

  const objetivoDesdeNube = () => {
    try {
      const words = Array.isArray(palabrasAgg) ? palabrasAgg : [];
      if (!words.length) { setObjetivoIA(""); setSaveError(LABELS.es.objetivoNubeSinPalabras); return; }
      const top = [...words].sort((a, b) => b.value - a.value).slice(0, 3);
      const lista = top.map((w) => String(w.text || "").toLowerCase()).join(", ");
      const asig = claseActual?.asignatura || asignaturaProfe || "la asignatura";
      const obj = `Durante el inicio de la clase, las y los estudiantes compartirán ideas relacionadas con ${lista} para conectar lo trabajado anteriormente con lo que explorarán hoy en ${asig}.`;
      setObjetivoIA(obj); setSaveError(""); saveCurrentSlot({ objetivoPuenteNube: obj });
    } catch (e) { console.warn("[objetivoDesdeNube]", e?.message); setSaveError(LABELS.es.objetivoNubeError); }
  };

  useEffect(() => {
    if (BYPASS_NAV) return;
    if (!chronoDone && remaining.m === 0 && remaining.s === 0) {
      setChronoDone(true);
      const key = makeCountKey(currentSlotId || "0-0"), endStr = localStorage.getItem(key) || localStorage.getItem(COUNT_KEY) || String(Date.now()), endMs = Number(endStr);
      try { localStorage.setItem("__lastSlotId", currentSlotId || "0-0"); } catch {}
      const ficha = makeFicha(); saveCurrentSlot();
      navigate("/desarrollo", { state: { slotId: currentSlotId || "0-0", endMs, clase: claseActual || null, ficha, nombre, especial: isEspecial, lang, tituloEspecial, objetivoEspecial, notasEspeciales } });
    }
  }, [remaining, navigate, currentSlotId, claseActual, chronoDone, BYPASS_NAV, isEspecial, lang, tituloEspecial, objetivoEspecial, notasEspeciales, nombre]);

  useEffect(() => {
    if (DISABLE_CLOUD) { setCloudMode("disabled"); return; }
    try { const stored = localStorage.getItem("cloudMode"); if (stored === "html" || stored === "canvas" || stored === "svg") { setCloudMode(stored); return; } } catch {}
    if (!supportsSvgTextBBox() || isProblematicUA()) { setCloudMode("html"); try { localStorage.setItem("cloudMode","html"); } catch {} }
    else { setCloudMode("svg"); try { localStorage.setItem("cloudMode","svg"); } catch {} }
  }, [DISABLE_CLOUD]);

  useEffect(() => { return () => { clearAllCountdowns(); }; }, []);

  const cloudData = palabrasAgg;
  const palette = SHOWTIME_PRESET?.colors || ["#0f172a","#1d4ed8","#0ea5e9","#059669"];
  const fontSize = (w) => 14 + w.value * 3;
  const debugData = { lang, isEspecial, tituloEspecial, objetivoEspecial, currentSlotId, salaCode, plan, authed, isAnon, claseActual, curriculoLoaded: !!curriculo };
  const asistentesCount = presentes?.length || 0;

  // ✅ Clase segura: primero usa datos reales; si fallan, usa el JSON fallback.
  const claseSegura = fallbackClase || claseActual || {};
  const profesorSeguro =
    nombre && nombre !== "Profesor" ? nombre : fallbackClase?.profesor || "Profesor";
  const colegioSeguro = fallbackClase?.colegio || "Institución educativa";
  const sloganSeguro = slogan || fallbackClase?.slogan || DEFAULT_SLOGAN;
  const asignaturaSegura =
  claseSegura?.asignatura ||
  "(sin asignatura)";
  const cursoDesdeNivelSeccion =
  [claseSegura?.nivel, claseSegura?.seccion].filter(Boolean).join(" ").trim();

const cursoSeguro =
  claseSegura?.curso ||
  cursoDesdeNivelSeccion ||
  "(sin curso)";
  const unidadSegura =
  claseSegura?.unidad ||
  "(sin unidad)";
  const objetivoCurricularSeguro =
    claseSegura?.objetivoCurricular ||
    claseSegura?.oa ||
    claseVigente?.oa ||
    fallbackClase?.objetivoCurricular ||
    "";
  const objetivoClaseSeguro =
    claseSegura?.objetivoClase ||
    claseSegura?.objetivo ||
    (isEspecial ? objetivoEspecial : "") ||
    fallbackClase?.objetivoClase ||
    fallbackClase?.objetivo ||
    "(sin objetivo)";
  const habilidadesSeguras = Array.isArray(claseSegura?.habilidades)
    ? claseSegura.habilidades
    : Array.isArray(fallbackClase?.habilidades)
      ? fallbackClase.habilidades
      : String(claseSegura?.habilidades || "(sin habilidades)")
          .split(/[;,·]/)
          .map((s) => s.trim())
          .filter(Boolean);
  const preguntaSegura =
    preguntaClase || fallbackClase?.preguntaClase || "¿Qué palabra representa mejor la clase de hoy?";
  const recursosSeguros = Array.isArray(fallbackClase?.recursos)
    ? fallbackClase.recursos
    : ["QR activo", "Nube de palabras", "Evidencias", "Gincana Nexus"];
  const fechaClase = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const horaDelDia = new Date().getHours();
  const saludoClase =
    horaDelDia < 12
      ? "Buenos días"
      : horaDelDia < 20
      ? "Buenas tardes"
      : "Buenas noches";

  const tituloPantalla =
    cursoSeguro && cursoSeguro !== "(sin curso)"
      ? cursoSeguro
      : profesorSeguro.split(" ")[0] || "profesor";

  const handleModoDemo = () => {
    const demoSlot = window.prompt(
      "Escribe el bloque demo. Ejemplo: 9-3 para jueves bloque 9, o 10-3 para jueves bloque 10.",
      currentSlotId && currentSlotId !== "0-0" ? currentSlotId : "9-3"
    );

    if (!demoSlot) return;

    const slotLimpio = demoSlot.trim();
    if (!/^\d+-\d+$/.test(slotLimpio)) {
      alert("Formato inválido. Usa algo como 9-3 o 10-3.");
      return;
    }

    try {
      localStorage.setItem("__lastSlotId", slotLimpio);
    } catch {}

    window.location.assign(`/#/InicioClase?slot=${encodeURIComponent(slotLimpio)}`);
  };

  const handleIrADesarrollo = () => {
    const ficha = makeFicha(); saveCurrentSlot();
    navigate("/desarrollo", { state: { slotId: currentSlotId || "0-0", endMs: Date.now(), clase: claseActual || null, ficha, nombre, especial: isEspecial, lang, tituloEspecial, objetivoEspecial, notasEspeciales } });
  };

  if (!authReady) {
    return (
      <div style={page}>
        <div style={{ ...card, maxWidth:420, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontWeight:800, fontSize:"1.1rem", marginBottom:8 }}>Cargando tu clase...</div>
          <div style={{ color:COLORS.textMuted }}>Espera un momento mientras preparamos todo.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {/* ✅ BANNER TRIAL - bloquea si expiró, avisa si queda 1 día */}
      <BannerTrial />

      {DEBUG_ON && <ICDebugBadge show={true} data={debugData} />}

      {paidOk && (
        <div style={{ ...card, maxWidth:520, margin:"0 auto 1rem", borderLeft:"4px solid #16a34a" }}>
          <div style={{ fontWeight:800, marginBottom:4 }}>{labels.pagoRecibidoTitulo}</div>
          <div style={{ color:COLORS.textMuted }}>{labels.pagoRecibidoTexto}</div>
        </div>
      )}

      {/* ───────────────── PANTALLA DE MANDO DEL PROFESOR ───────────────── */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gap: "1rem",
        }}
      >
        <section
          style={{
            background: "linear-gradient(135deg, rgba(15,23,42,.96), rgba(14,116,144,.96))",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 28,
            padding: "1.3rem",
            boxShadow: "0 28px 80px rgba(2,6,23,.24)",
            color: "#ffffff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.12)",
                  border: "1px solid rgba(255,255,255,.18)",
                  color: "#a5f3fc",
                  fontWeight: 900,
                  marginBottom: 12,
                }}
              >
                InicioClase · Pantalla de mando docente
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(34px,5vw,68px)",
                  lineHeight: .95,
                  letterSpacing: "-2px",
                }}
              >
                {saludoClase}, {tituloPantalla} 👋
              </h1>

              <p
                style={{
                  margin: "12px 0 0",
                  color: "#dbeafe",
                  fontSize: 18,
                  lineHeight: 1.5,
                  maxWidth: 850,
                }}
              >
                La clase está lista para proyectarse: curso, objetivo, QR,
                participación y evidencias en un solo lugar.
              </p>
            </div>

            <div
              style={{
                minWidth: 230,
                padding: 16,
                borderRadius: 22,
                background: "rgba(255,255,255,.10)",
                border: "1px solid rgba(255,255,255,.16)",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 14, color: "#bae6fd", fontWeight: 800 }}>
                {fechaClase}
              </div>
              <div style={{ fontSize: 38, fontWeight: 950, lineHeight: 1, marginTop: 6 }}>
                {horaActual || "--:--"}
              </div>
              <div style={{ fontSize: 13, color: "#dbeafe", marginTop: 8 }}>
                Slot actual: <strong>{currentSlotId}</strong>
              </div>
            </div>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1.25fr) minmax(280px, .75fr)",
            gap: "1rem",
            alignItems: "stretch",
          }}
        >
          {/* Información principal de la clase */}
          <section
            style={{
              ...card,
              borderRadius: 26,
              padding: "1.25rem",
              boxShadow: "0 24px 60px rgba(15,23,42,.14)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <InfoTile icon="👨‍🏫" label="Profesor" value={profesorSeguro} />
              <InfoTile icon="🏫" label="Institución" value={colegioSeguro} />
              <InfoTile icon="📘" label="Asignatura" value={asignaturaSegura} />
              <InfoTile icon="🎓" label="Curso" value={cursoSeguro} />
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: "1rem",
                background:
                  "radial-gradient(circle at top right, rgba(14,165,233,.10), transparent 35%), #f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "grid", gap: 14 }}>
                <BigInfo
                  icon="📚"
                  label="Unidad"
                  value={unidadSegura}
                />

                {objetivoCurricularSeguro && (
                  <BigInfo
                    icon="🎯"
                    label="Objetivo curricular"
                    value={objetivoCurricularSeguro}
                  />
                )}

                <BigInfo
                  icon="✅"
                  label="Objetivo de esta clase"
                  value={objetivoClaseSeguro}
                />

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 950,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      marginBottom: 8,
                    }}
                  >
                    🧠 Habilidades que se desarrollarán hoy
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {habilidadesSeguras.length ? (
                      habilidadesSeguras.map((h) => (
                        <span
                          key={h}
                          style={{
                            display: "inline-flex",
                            padding: "8px 11px",
                            borderRadius: 999,
                            background: "#ecfeff",
                            color: "#0e7490",
                            fontWeight: 900,
                            fontSize: 14,
                          }}
                        >
                          {h}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: COLORS.textMuted }}>(sin habilidades)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isEspecial && notasEspeciales && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  padding: 12,
                  background: "#fefce8",
                  borderRadius: 14,
                  border: "1px dashed #eab308",
                }}
              >
                <strong>Notas del profesor: </strong>{notasEspeciales}
              </div>
            )}

            {objetivoIA && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  padding: 12,
                  background: "#eff6ff",
                  borderRadius: 14,
                  border: "1px dashed #60a5fa",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  {LABELS.es.objetivoNubeIdea}
                </div>
                <div>{objetivoIA}</div>
              </div>
            )}

            {!isEspecial && evalsProximas.length > 0 && (
              <div style={{ marginTop: 14, display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:12, fontWeight:900, color:COLORS.textMuted, textTransform:"uppercase", letterSpacing:1 }}>
                  📋 Evaluaciones próximas
                </div>
                {evalsProximas.map((ev) => {
                  const restantes = ev.clasesRestantes;
                  const colorBg = restantes <= 2 ? "#fef2f2" : restantes <= 5 ? "#fff7ed" : "#f0fdf4";
                  const colorBorder = restantes <= 2 ? "#fca5a5" : restantes <= 5 ? "#fcd34d" : "#86efac";
                  const colorText = restantes <= 2 ? "#dc2626" : restantes <= 5 ? "#d97706" : "#16a34a";
                  return (
                    <div key={ev.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", borderRadius:12, background:colorBg, border:`1px solid ${colorBorder}`, fontSize:12 }}>
                      <span>
                        <strong>{ev.nombre}</strong>
                        <span style={{ color:COLORS.textMuted, marginLeft:6 }}>
                          {new Date(ev.fecha + "T12:00:00").toLocaleDateString("es-CL", { day:"numeric", month:"short" })}
                        </span>
                      </span>
                      <span style={{ fontWeight:900, color:colorText, whiteSpace:"nowrap", marginLeft:8 }}>
                        {restantes === 0 ? "¡Hoy!" : `${restantes} clase${restantes !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                borderTop: `1px dashed ${COLORS.border}`,
                marginTop: 18,
                paddingTop: 14,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button style={btnWhite} onClick={handleIrADesarrollo}>🚀 {labels.irDesarrollo}</button>
              <button style={btnTiny} onClick={handleModoDemo}>🎬 Modo demo</button>
              <button style={btnTiny} onClick={() => navigate(getInicioClasePath())}>{labels.volverInicio}</button>
              <button style={btnTiny} onClick={() => navigate("/horario")}>🗓️ {labels.editarHorario}</button>
              <button style={{ ...btnTiny, color:"#ef4444" }} onClick={nuevaSala}>🔄 Nueva sala</button>
            </div>

            {saveError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                {saveError}
              </div>
            )}
          </section>

          {/* Panel lateral: QR, cronómetro, conexión */}
          <aside
            style={{
              display: "grid",
              gap: "1rem",
            }}
          >
            <div
              style={{
                ...card,
                borderRadius: 26,
                padding: "1.15rem",
                textAlign: "center",
                boxShadow: "0 24px 60px rgba(15,23,42,.14)",
              }}
            >
              <div style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 900, marginBottom: 4 }}>
                ⏱ Cronómetro de activación
              </div>
              <div style={{ fontSize: 54, fontFamily: "monospace", fontWeight: 950, color: "#0f172a", lineHeight: 1 }}>
                {formatMMSS(remaining.m, remaining.s)}
              </div>
              <button style={{ ...btnTiny, marginTop: 12 }} onClick={resetCountdown}>
                Reiniciar cronómetro
              </button>
            </div>

            <div
              style={{
                ...card,
                borderRadius: 26,
                padding: "1.15rem",
                boxShadow: "0 24px 60px rgba(15,23,42,.14)",
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 10 }}>
                📱 QR de ingreso
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 18,
                  padding: 12,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "center",
                  border: "1px solid #e2e8f0",
                }}
              >
                {participaURL && (
                  <QRCode value={participaURL} size={170} style={{ width:"100%", maxWidth: 190, height:"auto" }} />
                )}
              </div>

              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10, wordBreak:"break-all" }}>
                {participaURL}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <MetricBox label="Conectados" value={asistentesCount} icon="👥" />
                <MetricBox label="Sala" value={salaCode || "—"} icon="🔑" />
              </div>

              {asistentesCount === 0 && (
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 10 }}>
                  {labels.nadieEscanea}
                </div>
              )}
            </div>

            <div
              style={{
                ...card,
                borderRadius: 26,
                padding: "1.15rem",
                boxShadow: "0 24px 60px rgba(15,23,42,.14)",
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 8 }}>
                Recursos listos
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {recursosSeguros.map((r) => (
                  <div
                    key={r}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    <span style={{ color: "#16a34a", fontWeight: 950 }}>✓</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, .8fr) minmax(320px, 1.4fr) minmax(260px, .8fr)",
            gap: "1rem",
          }}
        >
          <div style={{ ...card, borderRadius: 24 }}>
            <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 8 }}>
              💡 Pregunta de activación
            </div>
            <div style={{ fontSize: 14, marginBottom: 12, color: "#0f172a", lineHeight: 1.45 }}>
              {preguntaSegura}
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
              {LABELS.es.objetivoNubeTitulo}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
              {LABELS.es.objetivoNubeDesc}
            </div>
            <button style={btnTiny} onClick={objetivoDesdeNube} disabled={savingSlot}>
              {LABELS.es.objetivoNubeBtn}
            </button>
          </div>

          <div style={{ ...card, borderRadius: 24 }}>
            <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 8 }}>
              {labels.nube}
            </div>
            {DISABLE_CLOUD ? (
              <div style={{ fontSize:12, color:COLORS.textMuted }}>{LABELS.es.nubeDesactivada}</div>
            ) : !cloudData.length ? (
              <div style={{ fontSize:12, color:COLORS.textMuted }}>{LABELS.es.nubeSinPalabras}</div>
            ) : (
              <div style={{ width:"100%", height:220 }}>
                {cloudMode === "svg" && (
                  <CloudBoundary fallback={<HtmlCloud data={cloudData} palette={palette} fontSize={fontSize} />}>
                    <WordCloud data={cloudData} font="Segoe UI" fontWeight="bold" fontSize={fontSize} spiral="archimedean" width={520} height={220} padding={2} rotate={0} fill={(d, i) => palette[i % palette.length]} />
                  </CloudBoundary>
                )}
                {cloudMode === "canvas" && <CanvasCloud data={cloudData} palette={palette} width={520} height={220} fontSize={fontSize} />}
                {cloudMode === "html" && <HtmlCloud data={cloudData} palette={palette} fontSize={fontSize} />}
              </div>
            )}
          </div>

          <div style={{ ...card, borderRadius: 24 }}>
            <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 8 }}>
              {labels.ultimosEnvios}
            </div>
            {!ultimos.length ? (
              <div style={{ fontSize:12, color:COLORS.textMuted }}>{labels.sinRespuestas}</div>
            ) : (
              <div style={{ maxHeight:220, overflowY:"auto", fontSize:12 }}>
                {ultimos.map((r) => (
                  <div key={r.id} style={{ padding:"5px 0", borderBottom:"1px solid #e5e7eb" }}>
                    <strong>{r.numeroLista != null ? `#${r.numeroLista} · ` : ""}</strong>
                    <span>{r.texto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <EpicStarters
        t={t}
        idioma={lang}
        isSpecialClass={isEspecial}
        asignatura={asignaturaSegura}
        curso={cursoSeguro}
        unidad={unidadSegura}
        objetivo={objetivoClaseSeguro}
      />
    </div>
  );
}


function InfoTile({ icon, label, value }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 28px rgba(15,23,42,.06)",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 950, color: "#0f172a", lineHeight: 1.15 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function BigInfo({ icon, label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 5,
        }}
      >
        {icon} {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 950, color: "#0f172a", lineHeight: 1.25 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function MetricBox({ icon, label, value }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 950, color: "#0f172a", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

export default function InicioClase() {
  return (
    <GlobalBoundary>
      <InicioClaseInner />
    </GlobalBoundary>
  );
}