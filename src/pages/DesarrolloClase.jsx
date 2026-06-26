// src/pages/DesarrolloClase.jsx  
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useLayoutEffect,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";

import {
  MINEDUC_ENABLED,
  api,
  buscarAsignaturaMineduc,
  buscarUnidadMineduc,
  buscarHabilidadesMineduc,
} from "../lib/api";

import {
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import CronometroGlobal from "../components/CronometroGlobal";
import { subscribeEmergency } from "../services/emergencyService";
import HTMLFlipBook from "react-pageflip";
import FichaClaseSticky from "../components/FichaClaseSticky";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

import { ensurePdfJs } from "../lib/pdfSafe";

async function fetchJSON(url) {
  const r = await fetch(url, { method: "GET", mode: "cors" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

import { getClaseVigente, getYearWeek } from "../services/PlanificadorService";

import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

import { API_BASE } from "../utils/apiBase";

const PROXY_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PROXY_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_PROXY_URL || process.env.VITE_PROXY_BASE)) ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:8080");

const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00";

function _now() {
  const q = new URLSearchParams(window.location.search);
  const at = q.get("at");
  if (at) {
    const [hh, mm] = at.split(":").map(Number);
    const d = new Date();
    d.setHours(Number.isFinite(hh) ? hh : 0);
    d.setMinutes(Number.isFinite(mm) ? mm : 0);
    d.setSeconds(0); d.setMilliseconds(0);
    return d;
  }
  return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date();
}

function colDeHoy() {
  const q = new URLSearchParams(window.location.search);
  const fromQ = Number(q.get("dow"));
  const d = fromQ >= 1 && fromQ <= 5 ? fromQ : _now().getDay();
  return d >= 1 && d <= 5 ? d - 1 : 0;
}

function filaDesdeMarcas(marcas = []) {
  const now = _now();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < marcas.length - 1; i++) {
    const [sh, sm] = marcas[i];
    const [eh, em] = marcas[i + 1];
    if (mins >= sh * 60 + sm && mins < eh * 60 + em) return i;
  }
  return 0;
}

function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object")
    return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  if (Array.isArray(cfg.marcasStr))
    return cfg.marcasStr.map((s) => { const [h, m] = String(s).split(":").map((n) => Number(n) || 0); return [h, m]; });
  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) {
    const starts = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...starts, lastEnd].map((s) => { const [h, m] = s.split(":").map((n) => Number(n) || 0); return [h, m]; });
  }
  return [];
}

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

const row = (gap = "1rem") => ({
  display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap, alignItems: "stretch",
});

const card = {
  background: COLORS.white, color: COLORS.textDark, borderRadius: 12, padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
  border: `1px solid ${COLORS.border}`, maxWidth: "100%", overflow: "hidden",
};

const btnWhite = {
  background: COLORS.white, color: COLORS.btnText, border: "none", borderRadius: 10,
  padding: ".6rem .9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,.15)",
};

const toolsWrap = { marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${COLORS.border}` };
const toolsRow = { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" };
const inputSmall = { padding: "8px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 8, minWidth: 220, outline: "none" };
const selectSmall = { ...inputSmall, minWidth: 160 };
const btnTool = { ...btnWhite, padding: ".45rem .7rem", fontWeight: 800 };

const iconsRow = { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center", marginTop: 10 };
const iconBtn = { ...btnWhite, padding: 6, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56 };
const iconImg = { width: 28, height: 28 };

const ico = (domain) => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;

function IconPresent({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3 5c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5v2h3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h3v-2H5a2 2 0 0 1-2-2V5zm2 0v10h14V5H5zm7.7 2.3 3.6 3.6a1 1 0 0 1-1.4 1.4l-1.9-1.9V14a1 1 0 1 1-2 0V10.4l-1.9 1.9a1 1 0 0 1-1.4-1.4l3.6-3.6a1 1 0 0 1 1.4 0z" />
    </svg>
  );
}

const SHAPE_SPACE_URL = "https://huggingface.co/spaces/hysts/Shap-E";
const TRIPOSR_SPACE_URL = "https://huggingface.co/spaces/Intel/TripoSR";
const AFRAME_DEMO_URL = "https://aframe.io/examples/showcase/helloworld/";

const COUNT_KEY_LEGACY = "inicioClase_countdown_end";
function makeCountKey(slotId = "0-0") {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek();
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
}

const norm = (s = "") => s.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

const ASIG_SLUGS = {
  matematica: "matematica", matematicas: "matematica", lenguaje: "lenguaje",
  "lenguaje y comunicacion": "lenguaje", "lengua y literatura": "lenguaje",
  fisica: "fisica", quimica: "quimica", historia: "historia",
  "historia y ciencias sociales": "historia", ingles: "ingles",
  biologia: "biologia", ciencias: "ciencias", tecnologia: "tecnologia",
};

function asigToSlug(asig = "") { return ASIG_SLUGS[norm(asig)] || "matematica"; }
function nivelToApi(cursoStr = "", prefer = "") { return /basico|basica/i.test(norm(cursoStr || prefer)) ? "basica" : "media"; }
function cursoFromNivelSeccion(nivel = "", seccion = "") { return [nivel.replace(/º/g, "°"), seccion].filter(Boolean).join(" ").trim(); }

function slotFromQuery() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("slot");
    if (!s) return null;
    const [f, c] = s.split("-").map((n) => Number(n));
    if (Number.isInteger(f) && Number.isInteger(c)) return `${f}-${c}`;
  } catch {}
  return null;
}

const APP_GROUPS = {
  Generales: [
    { id: "google", name: "Google", url: "https://google.com", icon: "G", embed: true },
    { id: "wikipedia", name: "Wikipedia", url: "https://wikipedia.org", icon: "W", embed: true },
    { id: "flipbook", name: "Flipbook", url: "https://heyzine.com", icon: "FB", embed: true },
    { id: "timer", name: "Timer", url: "https://timer.onlineclock.net", icon: "T", embed: true },
    { id: "qr", name: "QR Generator", url: "https://qrcode-monkey.com", icon: "QR", embed: true },
  ],
  Matematica: [
    { id: "geogebra-graph", name: "GeoGebra · Graphing", url: "https://www.geogebra.org/graphing", icon: "GG", embed: true },
    { id: "geogebra-geom", name: "GeoGebra · Geometry", url: "https://www.geogebra.org/geometry", icon: "GG", embed: true },
  ],
  Lenguaje: [
    { id: "wordreference", name: "WordReference", url: "https://www.wordreference.com", icon: "WR", embed: true },
    { id: "linguee", name: "Linguee", url: "https://www.linguee.es", icon: "LG", embed: true },
    { id: "padlet", name: "Padlet", url: "https://padlet.com", icon: "PD", embed: true },
  ],
  Ciencias: [],
  Historia: [
    { id: "google-arts", name: "Google Arts & Culture", url: "https://artsandculture.google.com", icon: "AC", embed: true },
  ],
  Ingles: [
    { id: "cambridge", name: "Cambridge Dictionary", url: "https://dictionary.cambridge.org", icon: "CD", embed: true },
  ],
  Artes: [
    { id: "sketchpad", name: "Sketchpad", url: "https://sketch.io/sketchpad", icon: "SP", embed: true },
    { id: "autodraw", name: "AutoDraw", url: "https://www.autodraw.com", icon: "AD", embed: true },
  ],
  Tecnologia: [
    { id: "scratch", name: "Scratch", url: "https://scratch.mit.edu", icon: "SC", embed: true },
  ],
};

const appsWrap = { marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.border}` };
const appsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 8 };
const appTile = { background: "#ffffff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 3px 8px rgba(16,24,40,.06)" };
const appIcon = { width: 28, height: 28, flex: "0 0 28px", borderRadius: 6 };
const appTitle = { fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: COLORS.textDark };
const appGroupLabel = { fontSize: 11, color: COLORS.textMuted };

const STRINGS = {
  es: {
    devTitle: "Desarrollo", specialBanner: "⭐ Clase especial", specialSub: "Configuración personalizada para esta sesión",
    unitTitle: "Unidad", objectiveTitle: "Objetivo", skillsTitle: "Habilidades",
    courseLabel: "Curso", subjectLabel: "Asignatura",
    weeklyPlanCalendar: "Plan semanal (vigente)", weeklyPlanSlots: "Horario (fallback)", weeklyPlanNone: "Sin clase planificada",
    assessmentTag: "· (Evaluación)", supportResourceTitle: "🎬 Recurso de apoyo", quickToolsTitle: "🧰 Herramientas rápidas",
    ytPlaceholder: "Buscar o pegar enlace de YouTube…", geogebraInPanel: "📐 En panel", desmosInPanel: "🧮 Desmos en panel",
    phetPortal: "🧪 PhET (portal)", driveLabel: "📂 Drive", customLinkPlaceholder: "Pega cualquier enlace",
    presentTooltip: "Presentar (pantalla o archivo)", appsTitle: "⚙️ Apps rápidas", appsShow: "Mostrar", appsHide: "Ocultar",
    appsSearchPlaceholder: "Buscar app por nombre/categoría…", appsNoResults: "Sin resultados.", appsToggleTitle: "Mostrar/Ocultar catálogo",
    appsFilterTitle: "Filtrar por categoría", openInPanelTitle: "Abrir dentro del panel", openInNewTabTitle: "Abrir en pestaña nueva",
    pdfProgramTitle: "📑 Programa de Estudio (PDF)", pdfUrlPlaceholder: "Pega aquí la URL del PDF del programa",
    pdfSaveLink: "💾 Guardar enlace", pdfFlipMode: "📖 Flipbook", pdfScrollMode: "📄 Scroll", pdfUseMineduc: "🏷️ Usar MINEDUC",
    pdfHelperText: "Pega la URL del PDF arriba.", pdfPrev: "◀️ Anterior", pdfNext: "Siguiente ▶️",
    pdfLoading: "Cargando PDF…", pdfNoUrl: "Pega la URL del PDF arriba.", pdfPageLabel: "Página",
    lab3dTitle: "🧪 Laboratorio 3D", prompt3DPlaceholder: "Prompt 3D", lab3dGenerateServer: "✅ Generar (servidor)",
    glbPlaceholder: "URL .glb/.gltf", view3D: "👁️ Ver 3D", uploadGLB: "⤴️ Subir GLB", lab3dHelper: "Pega una URL .glb/.gltf o sube un GLB.",
    wikiIntroTitle: "📚 Introducción (Wikipedia)", wikiRelatedToPrefix: "Relacionado con:", wikiOpenFull: "Abrir artículo completo →",
    wikiComplementaryTitle: "📚 Información complementaria", wikiNoSummary: "No se pudo obtener el resumen.", wikiTopicFallback: "la temática de la clase",
    goToClosure: "⏭️ Ir al Cierre", goToClosureTitle: "Ir al Cierre", emergencyActive: "🔴 Emergencia activa",
    emergencyDevTitle: "🔴 Emergencia — Desarrollo:", emergencyBadgeLangPrefix: "🌐 ",
    panelLoginHint: "Este sitio puede requerir inicio de sesión.", panelPhETHint: "Para ver una simulación dentro del panel, usa el enlace embed.",
    shapEHint: "Usa la Space para generar y descargar el GLB.", tripoHint: "Genera una imagen y súbela en la Space.",
    escapeHint: "Demo A-Frame.", local3dFail: "No se pudo generar.", local3dGenerating: "Generando modelo…", local3dDone: "Listo ✓",
    local3dNeedPrompt: "Escribe un prompt 3D primero.", local3dProxyHint: "Requiere proxy local",
    fileUnsupported: "Para Word/Excel/PowerPoint, usa «Compartir pantalla».", needUrlFirst: "Pega una URL .glb/.gltf primero.",
    needEscapeUrl: "Pega primero la URL de tu sala de escape.", noUrlCustom: "Pega un enlace primero.",
    shareConfirmEs: "¿Compartir pantalla ahora?\nAceptar: Compartir pantalla\nCancelar: Presentar archivo en el panel",
    sharingNow: "Compartiendo…", noUnit: "(sin unidad)", noObjective: "(sin objetivo)", noSkills: "(sin habilidades)",
    noCourse: "(sin curso)", noSubject: "(sin asignatura)", noUnitEmergency: "(sin unidad)", noObjectiveEmergency: "(sin objetivo)",
    shapEButtonLabel: "🧊 Abrir Shap-E (texto→3D)", tripoButtonLabel: "🖼️ Abrir TripoSR (imagen→3D)",
    shapEIconTitle: "Shap-E (texto→3D)", tripoIconTitle: "TripoSR (imagen→3D)", escapeDemoTitle: "Escape Room (demo A-Frame)",
    glbUploadHint: "Sube un archivo .glb o .gltf.", geoCalcLabel: "GeoGebra · Graficadora",
    geoGeomLabel: "GeoGebra · Geometría", geo3dLabel: "GeoGebra · 3D", geoToolTitle: "Tipo de app GeoGebra",
  },
  en: {
    devTitle: "Development", specialBanner: "⭐ Special class", specialSub: "Custom configuration for this session",
    unitTitle: "Unit", objectiveTitle: "Objective", skillsTitle: "Skills", courseLabel: "Class", subjectLabel: "Subject",
    weeklyPlanCalendar: "Weekly plan (calendar)", weeklyPlanSlots: "Schedule (fallback)", weeklyPlanNone: "No planned lesson",
    assessmentTag: "· (Assessment)", supportResourceTitle: "🎬 Support resource", quickToolsTitle: "🧰 Quick tools",
    ytPlaceholder: "Search or paste YouTube link…", geogebraInPanel: "📐 In panel", desmosInPanel: "🧮 Desmos in panel",
    phetPortal: "🧪 PhET (portal)", driveLabel: "📂 Drive", customLinkPlaceholder: "Paste any link",
    presentTooltip: "Present (screen or file)", appsTitle: "⚙️ Quick apps", appsShow: "Show", appsHide: "Hide",
    appsSearchPlaceholder: "Search app by name/category…", appsNoResults: "No results.", appsToggleTitle: "Show/Hide catalog",
    appsFilterTitle: "Filter by category", openInPanelTitle: "Open inside the panel", openInNewTabTitle: "Open in new tab",
    pdfProgramTitle: "📑 Study Program (PDF)", pdfUrlPlaceholder: "Paste the Study Program PDF URL",
    pdfSaveLink: "💾 Save link", pdfFlipMode: "📖 Flipbook", pdfScrollMode: "📄 Scroll", pdfUseMineduc: "🏷️ Use MINEDUC",
    pdfHelperText: "Paste the PDF URL above.", pdfPrev: "◀️ Previous", pdfNext: "Next ▶️",
    pdfLoading: "Loading PDF…", pdfNoUrl: "Paste the PDF URL above.", pdfPageLabel: "Page",
    lab3dTitle: "🧪 3D Lab", prompt3DPlaceholder: "3D prompt", lab3dGenerateServer: "✅ Generate (server)",
    glbPlaceholder: "GLB/GLTF URL", view3D: "👁️ View 3D", uploadGLB: "⤴️ Upload GLB", lab3dHelper: "Paste a .glb/.gltf URL or upload a GLB.",
    wikiIntroTitle: "📚 Introduction (Wikipedia)", wikiRelatedToPrefix: "Related to:", wikiOpenFull: "Open full article →",
    wikiComplementaryTitle: "📚 Extra information", wikiNoSummary: "Could not fetch the summary.", wikiTopicFallback: "the main class topic",
    goToClosure: "⏭️ Go to Closure", goToClosureTitle: "Go to Closure", emergencyActive: "🔴 Active emergency",
    emergencyDevTitle: "🔴 Emergency — Development:", emergencyBadgeLangPrefix: "🌐 ",
    panelLoginHint: "This site may require login.", panelPhETHint: "Use the embed link to show a simulation.",
    shapEHint: "Use the Space to generate and download the GLB.", tripoHint: "Generate an image and upload it.",
    escapeHint: "A-Frame demo.", local3dFail: "Local generation failed.", local3dGenerating: "Generating model…", local3dDone: "Done ✓",
    local3dNeedPrompt: "Type a 3D prompt first.", local3dProxyHint: "Requires local proxy",
    fileUnsupported: "For Word/Excel/PowerPoint, use Share screen.", needUrlFirst: "Paste a .glb/.gltf URL first.",
    needEscapeUrl: "Paste your escape-room URL first.", noUrlCustom: "Paste a link first.",
    shareConfirmEs: "Share screen now?\nOK: Share screen\nCancel: Present file in the panel",
    sharingNow: "Sharing…", noUnit: "(no unit)", noObjective: "(no objective)", noSkills: "(no skills)",
    noCourse: "(no class)", noSubject: "(no subject)", noUnitEmergency: "(no unit)", noObjectiveEmergency: "(no objective)",
    shapEButtonLabel: "🧊 Open Shap-E (text→3D)", tripoButtonLabel: "🖼️ Open TripoSR (image→3D)",
    shapEIconTitle: "Shap-E (text→3D)", tripoIconTitle: "TripoSR (image→3D)", escapeDemoTitle: "Escape Room (A-Frame demo)",
    glbUploadHint: "Upload a .glb or .gltf file.", geoCalcLabel: "GeoGebra · Graphing",
    geoGeomLabel: "GeoGebra · Geometry", geo3dLabel: "GeoGebra · 3D", geoToolTitle: "GeoGebra app type",
  },
};

export default function DesarrolloClase({ duracion = 30, onIrACierre }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [language, setLanguage] = useState("es");
  const [isSpecial, setIsSpecial] = useState(false);

  const langKey = language === "en" ? "en" : "es";
  const S = STRINGS[langKey];

  useEffect(() => { ensurePdfJs().catch(console.warn); }, []);

  const planCtx = useContext(PlanContext) || {};
  const { user = null, plan = "FREE", caps = PLAN_CAPS.FREE, loading = false } = planCtx;

  const [horaActual, setHoraActual] = useState("");
  const [nombreProfesor, setNombreProfesor] = useState("Profesor");
  const [asignatura, setAsignatura] = useState(S.noSubject);
  const [curso, setCurso] = useState(S.noCourse);
  const [unidad, setUnidad] = useState("");
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [wikipediaUrl, setWikipediaUrl] = useState(null);
  const [wikiTitle, setWikiTitle] = useState("");
  const [wikiSummary, setWikiSummary] = useState("");
  const [wikiThumb, setWikiThumb] = useState("");
  const [wikiLang, setWikiLang] = useState("es");
  const [authed, setAuthed] = useState(false);
  const [objetivo, setObjetivo] = useState("");
  const [habilidades, setHabilidades] = useState("");
  const [emergency, setEmergency] = useState(null);
  const [ytQuery, setYtQuery] = useState("");
  const [ggTool, setGgTool] = useState("calculator");
  const [customLink, setCustomLink] = useState("");
  const [mainSrc, setMainSrc] = useState("https://www.youtube-nocookie.com/embed/Ibrj8pRX8Zg");
  const [panelMsg, setPanelMsg] = useState("");
  const [presentKind, setPresentKind] = useState("iframe");
  const [presentBlobUrl, setPresentBlobUrl] = useState(null);
  const fileInputRef = useRef(null);
  const screenVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [claseVigente, setClaseVigente] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getClaseVigente(new Date());
        setClaseVigente(res);
        if (res) {
          if (res.unidad && !unidad) setUnidad(res.unidad);
          if (res.objetivo && !objetivo) setObjetivo(res.objetivo);
          if (res.habilidades && !habilidades) setHabilidades(res.habilidades);
          if (res.asignatura && asignatura === S.noSubject) setAsignatura(res.asignatura);
          if ((res.nivel || res.seccion) && curso === S.noCourse) setCurso(cursoFromNivelSeccion(res.nivel, res.seccion));
        }
      } catch (e) { console.error("[Desarrollo] getClaseVigente:", e); }
    })();
  }, []); // eslint-disable-line

  const ensureHttp = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const openInNew = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const readerWrap = (u) => {
    try {
      const x = ensureHttp(u);
      const parsed = new URL(x);
      const scheme = parsed.protocol.replace(":", "");
      return `https://r.jina.ai/${scheme}://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch { return u; }
  };

  const extractYouTubeId = (s) => {
    try {
      if (/youtu\.?be/.test(s)) {
        const u = new URL(s);
        if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
        const id = u.searchParams.get("v");
        if (id) return id;
      }
    } catch {}
    if (/^[\w-]{10,12}$/.test(s)) return s.trim();
    return null;
  };

  const ytEmbedFromQuery = (q) => {
    const id = extractYouTubeId(q);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q || "matemática 1 medio")}`;
  };

  const toEmbedURL = (urlOrQuery, kind) => {
    if (kind === "youtube") return ytEmbedFromQuery((urlOrQuery || "").trim() || (unidad ? `matemática ${unidad}` : "matemática 1 medio"));
    if (kind === "geogebra") { let path = "/calculator"; if (ggTool === "geometry") path = "/geometry"; if (ggTool === "3d") path = "/3d"; return `https://www.geogebra.org${path}?embed`; }
    if (kind === "desmos") return "https://www.desmos.com/calculator?embed&lang=es";
    let u = ensureHttp((urlOrQuery || "").trim());
    try {
      const parsed = new URL(u);
      if (parsed.hostname.includes("youtube") || parsed.hostname.includes("youtu.be")) return ytEmbedFromQuery(u);
      if (parsed.hostname.endsWith("docs.google.com")) {
        if (parsed.pathname.includes("/document/")) return u.replace(/\/edit.*$/i, "/preview");
        if (parsed.pathname.includes("/spreadsheets/")) return u.replace(/\/edit.*$/i, "/preview");
        if (parsed.pathname.includes("/presentation/")) return u.replace(/\/edit.*$/i, "/embed");
      }
      if (parsed.hostname.endsWith("onedrive.live.com") || parsed.hostname.endsWith("sharepoint.com"))
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`;
      if (parsed.hostname.includes("wikipedia.org")) return u;
    } catch { return ytEmbedFromQuery(urlOrQuery); }
    return u;
  };

  const trySetMain = (embedUrl) => {
    setPanelMsg(""); setMainSrc(embedUrl); setPresentKind("iframe");
    if (/(^https?:\/\/)?(docs\.google\.com|drive\.google\.com|office\.com|onedrive\.live\.com|sharepoint\.com)/i.test(embedUrl)) setPanelMsg(S.panelLoginHint);
  };

  const handleSelectFile = () => fileInputRef.current?.click();

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type === "application/pdf") { if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {} setPresentBlobUrl(url); setPresentKind("iframe"); trySetMain(url); }
    else if (file.type.startsWith("image/")) { if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {} setPresentBlobUrl(url); setPresentKind("image"); setPanelMsg(""); }
    else { URL.revokeObjectURL(url); alert(S.fileUnsupported); }
    try { e.target.value = ""; } catch {}
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      screenStreamRef.current = stream; setPresentKind("screen"); setSharing(true);
      const [track] = stream.getVideoTracks();
      track.addEventListener("ended", () => stopScreenShare());
    } catch (e) { console.warn("DisplayMedia cancelado:", e); }
  };

  const stopScreenShare = () => {
    try { const stream = screenStreamRef.current; if (stream) stream.getTracks().forEach((t) => t.stop()); } catch {}
    screenStreamRef.current = null; setSharing(false); setPresentKind("iframe");
  };

  const presentChooser = () => { const yes = window.confirm(langKey === "en" ? STRINGS.en.shareConfirmEs : STRINGS.es.shareConfirmEs); if (yes) startScreenShare(); else handleSelectFile(); };

  useEffect(() => {
    return () => {
      if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {}
      if (screenStreamRef.current) try { screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, []); // eslint-disable-line

  const handleOpenYouTube = () => trySetMain(toEmbedURL(ytQuery, "youtube"));
  const handleOpenGeoGebra = () => trySetMain(toEmbedURL("", "geogebra"));
  const handleOpenDesmos = () => trySetMain(toEmbedURL("", "desmos"));
  const handleOpenPhET = () => { trySetMain("https://phet.colorado.edu/es/simulations/filter?subjects=math&type=html,prototype"); setPanelMsg(S.panelPhETHint); };
  const handleOpenDrive = () => trySetMain(readerWrap("https://drive.google.com"));
  const handleOpenCustom = () => { const u = customLink.trim(); if (!u) { alert(S.noUrlCustom); return; } trySetMain(toEmbedURL(u, "custom")); };
  const handleOpenWikipedia = () => { if (wikipediaUrl) trySetMain(wikipediaUrl); else trySetMain("https://es.wikipedia.org"); };

  useEffect(() => {
    setHoraActual(new Date().toLocaleTimeString());
    const id = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) { const cred = await signInAnonymously(auth); localStorage.setItem("uid", cred.user.uid); setAuthed(true); }
        else { localStorage.setItem("uid", u.uid); setAuthed(true); }
      } catch (e) { console.error("[Desarrollo] auth error:", e); setAuthed(false); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authed) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid"); if (!uid) return;
    let cleanup;
    try { const maybeOff = subscribeEmergency(uid, setEmergency); if (typeof maybeOff === "function") cleanup = maybeOff; } catch (e) { console.warn("[Desarrollo] subscribeEmergency error:", e); }
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [authed]);

  useEffect(() => {
    const st = location?.state || null; if (!st) return;
    try {
      if (st.isClaseEspecial || st.claseEspecial || st.tipo === "especial") setIsSpecial(true);
      if (st.language) setLanguage(String(st.language).toLowerCase());

      if (st.claseEspecial) {
        const cE = st.claseEspecial;
        if (cE.unidad) setUnidad((prev) => prev || cE.unidad || "");
        if (cE.objetivo) setObjetivo((prev) => prev || cE.objetivo || "");
        if (cE.habilidades) setHabilidades((prev) => prev || cE.habilidades || "");
        if (cE.asignatura) setAsignatura(cE.asignatura);
        if (cE.curso) setCurso(cE.curso);
        if (!cE.curso && (cE.nivel || cE.seccion)) setCurso(cursoFromNivelSeccion(cE.nivel, cE.seccion));
      }

      // ✅ Leer datos de clase desde el state (propagados desde InicioClase)
      if (st.clase) {
        setUnidad((prev) => prev || st.clase.unidad || "");
        setObjetivo((prev) => prev || st.clase.objetivo || "");
        const habsFromState = Array.isArray(st.clase.habilidades) ? st.clase.habilidades.join(", ") : st.clase.habilidades || "";
        setHabilidades((prev) => prev || habsFromState);
        if (st.clase.asignatura) setAsignatura(st.clase.asignatura);
        if (st.clase.curso) setCurso(st.clase.curso);
        if (!st.clase.curso && (st.clase.nivel || st.clase.seccion)) setCurso(cursoFromNivelSeccion(st.clase.nivel, st.clase.seccion));
      }

      if (st.slotId) { try { localStorage.setItem("__lastSlotId", st.slotId); } catch {} }
      if (Number.isFinite(+st.endMs) && +st.endMs > 0) {
        const key = makeCountKey(st.slotId || "0-0");
        try { localStorage.setItem(key, String(st.endMs)); localStorage.setItem(COUNT_KEY_LEGACY, String(st.endMs)); } catch {}
      }
    } catch {}
  }, [location]);

  useLayoutEffect(() => {
    try {
      const slotPref = location?.state?.slotId || slotFromQuery() || localStorage.getItem("__lastSlotId") || "0-0";
      const key = makeCountKey(slotPref);
      const now = Date.now();
      let endStr = localStorage.getItem(key) || localStorage.getItem(COUNT_KEY_LEGACY);
      if (!endStr || +endStr <= now) { const endMs = now + duracion * 60 * 1000; localStorage.setItem(key, String(endMs)); localStorage.setItem(COUNT_KEY_LEGACY, String(endMs)); }
    } catch {}
  }, []); // eslint-disable-line

  const [oaData, setOaData] = useState(null);
  const [unidadData, setUnidadData] = useState(null);
  const [habData, setHabData] = useState(null);

  async function cargarOA(params) {
    try { if (!MINEDUC_ENABLED) { setOaData((prev) => prev ?? { items: [] }); return; } const data = await buscarAsignaturaMineduc(params); setOaData(data); }
    catch (err) { console.warn("[MINEDUC] OA:", err); setOaData((prev) => prev ?? { items: [] }); }
  }
  async function cargarUnidad(params) {
    try { if (!MINEDUC_ENABLED) { setUnidadData((prev) => prev ?? { items: [] }); return; } const data = await buscarUnidadMineduc(params); setUnidadData(data); }
    catch (err) { console.warn("[MINEDUC] Unidad:", err); setUnidadData((prev) => prev ?? { items: [] }); }
  }
  async function cargarHabilidades(params) {
    try { if (!MINEDUC_ENABLED) { setHabData((prev) => prev ?? { items: [] }); return; } const data = await buscarHabilidadesMineduc(params); setHabData(data); }
    catch (err) { console.warn("[MINEDUC] Habilidades:", err); setHabData((prev) => prev ?? { items: [] }); }
  }

  useEffect(() => {
    const unidadParaOA = (location?.state?.clase?.unidad || unidad || "").trim();
    const asigForOA = (location?.state?.clase?.asignatura || asignatura || "Matemática").trim();
    const cursoForOA = (location?.state?.clase?.curso || curso || "").trim();
    if (!unidadParaOA && !asigForOA && !cursoForOA) return;
    const params = { asignatura: asigToSlug(asigForOA), nivel: nivelToApi(cursoForOA, claseVigente?.nivel || ""), unidad: unidadParaOA };
    cargarOA(params); cargarUnidad(params); cargarHabilidades(params);
  }, [asignatura, curso, unidad, MINEDUC_ENABLED]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return;
    const obtenerDatos = async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid; if (!uid) return;

        try { const pref = doc(db, "profesores", uid); const psnap = await getDoc(pref); if (psnap.exists()) { const data = psnap.data() || {}; const nombreP = data.nombre || data.nombreCompleto || data.profesorNombre || null; if (nombreP) setNombreProfesor(nombreP); } } catch (e) { if (e?.code !== "permission-denied") console.warn("[Desarrollo] profesores read:", e?.code || e); }
        try { const uref = doc(db, "usuarios", uid); const usnap = await getDoc(uref); if (usnap.exists()) { const u = usnap.data() || {}; if (nombreProfesor === "Profesor") { const nombreU = u.nombre || u.nombreCompleto || null; if (nombreU) setNombreProfesor(nombreU); } } } catch (e) { if (e?.code !== "permission-denied") console.warn("[Desarrollo] usuarios read:", e?.code || e); }

        let unidadInicial = "";
        try {
          const pref = doc(db, "profesores", uid); const psnap = await getDoc(pref);
          if (psnap.exists()) {
            const data = psnap.data() || {};
            unidadInicial = (data.unidadInicial || "").trim();
            setUnidad((prev) => prev || unidadInicial);
            setAsignatura((prev) => prev === S.noSubject ? data.asignatura || S.noSubject : prev);
            setCurso((prev) => prev === S.noCourse ? data.curso || cursoFromNivelSeccion(data.nivel, data.seccion) || S.noCourse : prev);
          }
        } catch (e) { if (e?.code !== "permission-denied") console.warn("[Desarrollo] profesores read:", e?.code || e); }

        if (!unidadInicial) {
          try {
            const uref = doc(db, "usuarios", uid); const usnap = await getDoc(uref);
            if (usnap.exists()) { const u = usnap.data() || {}; unidadInicial = (u.unidadInicial || u.unidad || "").trim(); setUnidad((prev) => prev || unidadInicial); if (u.asignatura && asignatura === S.noSubject) setAsignatura(u.asignatura); if (u.curso && curso === S.noCourse) setCurso(u.curso); }
          } catch (e) { if (e?.code !== "permission-denied") console.warn("[Desarrollo] usuarios fallback:", e?.code || e); }
        }

        try {
          const slotPref = location?.state?.slotId || slotFromQuery() || localStorage.getItem("__lastSlotId") || "0-0";
          const dref = doc(db, "clases_detalle", uid, "slots", slotPref);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const det = dsnap.data() || {};
            setUnidad((prev) => prev || det.unidad || "");
            setObjetivo((prev) => prev || det.objetivo || "");
            setHabilidades((prev) => prev || (Array.isArray(det.habilidades) ? det.habilidades.join(", ") : det.habilidades || ""));
            if (det.asignatura && asignatura === S.noSubject) setAsignatura(det.asignatura);
            if (curso === S.noCourse) {
              if (det.curso || det.nivel || det.seccion) setCurso(det.curso || cursoFromNivelSeccion(det.nivel, det.seccion) || S.noCourse);
            }
          } else {
            const uref = doc(db, "usuarios", uid); const usnap = await getDoc(uref);
            const cfg = usnap.exists() ? usnap.data()?.horarioConfig || {} : {};
            const marcasArr = getMarcasFromConfig(cfg);
            if (Array.isArray(marcasArr) && marcasArr.length > 1) {
              const fila = filaDesdeMarcas(marcasArr); const col = colDeHoy(); const slotId = `${fila}-${col}`;
              const dref2 = doc(db, "clases_detalle", uid, "slots", slotId); const ds2 = await getDoc(dref2);
              if (ds2.exists()) {
                const det2 = ds2.data() || {};
                setUnidad((prev) => prev || det2.unidad || "");
                setObjetivo((prev) => prev || det2.objetivo || "");
                setHabilidades((prev) => prev || (Array.isArray(det2.habilidades) ? det2.habilidades.join(", ") : det2.habilidades || ""));
                if (det2.asignatura && asignatura === S.noSubject) setAsignatura(det2.asignatura);
                if (curso === S.noCourse) setCurso(det2.curso || cursoFromNivelSeccion(det2.nivel, det2.seccion) || S.noCourse);
              }
            }
          }
        } catch (e) { if (e?.code !== "permission-denied") console.warn("[Desarrollo] clases_detalle fallback:", e?.code || e); }

        const unidadParaOA = location?.state?.clase?.unidad || unidadInicial || unidad || "";
        const asigForOA = location?.state?.clase?.asignatura || asignatura || "Matemática";
        const cursoForOA = location?.state?.clase?.curso || curso || "";

        if (unidadParaOA) {
          const asigSlug = asigToSlug(asigForOA);
          const nivelApi = nivelToApi(cursoForOA, claseVigente?.nivel || "");
          try {
            const proxyUrl = `${API_BASE}/mineduc?asignatura=${encodeURIComponent(asigSlug)}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadParaOA)}`;
            const rProxy = await api.get(proxyUrl);
            const firstProxy = Array.isArray(rProxy.data) ? rProxy.data[0] : null;
            if (firstProxy) setOaMinisterio(firstProxy); else throw new Error("Proxy sin resultados");
          } catch (e) {
            try {
              const directUrl = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(asigSlug)}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadParaOA)}`;
              const oaResponse = await api.get(directUrl);
              setOaMinisterio(Array.isArray(oaResponse.data) ? oaResponse.data[0] : null);
            } catch (e2) { console.warn("[Desarrollo] OA ministerio no disponible:", e2?.message || e2); }
          }

          try {
            let firstTitle = ""; let lang = "es";
            const wikiSearchEs = await api.get(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(unidadParaOA)}&format=json&origin=*`);
            firstTitle = wikiSearchEs?.data?.query?.search?.[0]?.title || "";
            if (!firstTitle && objetivo) { const wikiSearchEsObj = await api.get(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(objetivo)}&format=json&origin=*`); firstTitle = wikiSearchEsObj?.data?.query?.search?.[0]?.title || ""; }
            if (!firstTitle) { const wikiSearchEn = await api.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(unidadParaOA)}&format=json&origin=*`); firstTitle = wikiSearchEn?.data?.query?.search?.[0]?.title || ""; if (firstTitle) lang = "en"; }
            if (firstTitle) {
              const base = lang === "es" ? "https://es.wikipedia.org" : "https://en.wikipedia.org";
              setWikipediaUrl(`${base}/wiki/${encodeURIComponent(firstTitle)}`); setWikiTitle(firstTitle); setWikiLang(lang);
              try { const sumRes = await api.get(`${base}/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}?origin=*`); setWikiSummary(sumRes?.data?.extract || ""); setWikiThumb(sumRes?.data?.thumbnail?.source || ""); } catch { setWikiSummary(""); setWikiThumb(""); }
            }
          } catch (e) { console.warn("[Desarrollo] Wikipedia no disponible:", e?.message || e); }
        }
      } catch (err) { console.error("Error cargando datos de Desarrollo:", err); }
    };
    obtenerDatos();
  }, [authed]); // eslint-disable-line

  useEffect(() => {
    if (!authed) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid"); if (!uid) return;
    let cleanup;
    try { const maybeOff = subscribeEmergency(uid, setEmergency); if (typeof maybeOff === "function") cleanup = maybeOff; } catch (e) { console.warn("[Desarrollo] subscribeEmergency error:", e); }
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [authed]);

  useEffect(() => {
    const run = async () => {
      const q = (objetivo || "").trim(); if (!q) return;
      try {
        let firstTitle = ""; let lang = "es";
        const wikiSearchEs = await api.get(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`);
        firstTitle = wikiSearchEs?.data?.query?.search?.[0]?.title || "";
        if (!firstTitle) { const wikiSearchEn = await api.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`); firstTitle = wikiSearchEn?.data?.query?.search?.[0]?.title || ""; if (firstTitle) lang = "en"; }
        if (!firstTitle) return;
        const base = lang === "es" ? "https://es.wikipedia.org" : "https://en.wikipedia.org";
        setWikipediaUrl(`${base}/wiki/${encodeURIComponent(firstTitle)}`); setWikiTitle(firstTitle); setWikiLang(lang);
        try { const sumRes = await api.get(`${base}/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}?origin=*`); setWikiSummary(sumRes?.data?.extract || ""); setWikiThumb(sumRes?.data?.thumbnail?.source || ""); } catch { setWikiSummary(""); setWikiThumb(""); }
      } catch {}
    };
    run();
  }, [objetivo]);

  useEffect(() => { if (emergency?.language && !location?.state?.language) setLanguage(String(emergency.language).toLowerCase()); }, [emergency, location]);

  // ✅ handleEnd — propaga todos los datos de clase al Cierre
  const handleEnd = () => {
    const stateToSend = {
      ...(location?.state || {}),
      isClaseEspecial: isSpecial,
      language,
      clase: {
        unidad, objetivo,
        habilidades: habilidades || "",
        asignatura,
        curso,
      },
      slotId: location?.state?.slotId || localStorage.getItem("__lastSlotId") || "0-0",
    };
    if (onIrACierre) onIrACierre(stateToSend);
    else navigate("/cierre", { state: stateToSend });
  };

  const [prompt3D, setPrompt3D] = useState("");
  const [glbUrl, setGlbUrl] = useState("");
  const [modelSrc, setModelSrc] = useState(null);
  const modelFileInputRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!window.customElements || !window.customElements.get?.("model-viewer")) {
      const s = document.createElement("script"); s.type = "module"; s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"; s.crossOrigin = "anonymous"; document.head.appendChild(s);
    }
  }, []);

  const openShapE = () => { trySetMain(SHAPE_SPACE_URL + (prompt3D ? `?prompt=${encodeURIComponent(prompt3D)}` : "")); setPanelMsg(S.shapEHint); };
  const openTripoSR = () => { trySetMain(TRIPOSR_SPACE_URL); setPanelMsg(S.tripoHint); };
  const handleShowGLB = () => { const u = glbUrl.trim(); if (!u) { alert(S.needUrlFirst); return; } setModelSrc(u); viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const handlePickGLB = () => modelFileInputRef.current?.click();
  const handleGLBChosen = (e) => { const f = e.target.files?.[0]; if (!f) return; if (!/(\.glb|\.gltf)$/i.test(f.name)) { alert(S.glbUploadHint); return; } const u = URL.createObjectURL(f); setModelSrc(u); viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); try { e.target.value = ""; } catch {} };

  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  const generateLocal3D = async () => {
    const p = (prompt3D || "").trim(); if (!p) { alert(S.local3dNeedPrompt); return; }
    setGenLoading(true); setGenMsg(S.local3dGenerating);
    try {
      const r = await fetch(`${API_BASE}/shape/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, mode: "cors", body: JSON.stringify({ prompt: p, steps: 32, size: 1.2 }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.url) { setModelSrc(data.url); setGlbUrl(data.url); } else if (data?.blobBase64) { setModelSrc(data.blobBase64); setGlbUrl(data.blobBase64); } else throw new Error("Respuesta sin URL");
      setGenMsg(S.local3dDone); viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) { console.warn(err); setGenMsg(S.local3dFail + " " + PROXY_BASE); alert(S.local3dFail); }
    finally { setGenLoading(false); setTimeout(() => setGenMsg(""), 3500); }
  };

  const [escapeUrl, setEscapeUrl] = useState("");
  const openEscapeDemo = () => { trySetMain(AFRAME_DEMO_URL); setPanelMsg(S.escapeHint); };
  const openEscapeRoomUrl = () => { if (!escapeUrl.trim()) { alert(S.needEscapeUrl); return; } trySetMain(ensureHttp(escapeUrl.trim())); };

  const [pdfUrl, setPdfUrl] = useState(() => { const fromState = location?.state?.ficha?.programaUrl || ""; const saved = localStorage.getItem("programaPdfUrl") || ""; return fromState || saved || ""; });
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const pdfWrapRef = useRef(null);
  const [pdfWidth, setPdfWidth] = useState(900);
  const [pdfMode, setPdfMode] = useState("flip");
  const [resolvedMineducUrl, setResolvedMineducUrl] = useState("");

  const nivelPrefer = (() => {
    const fromState = location?.state?.ficha?.nivel || "";
    const fromVig = claseVigente?.nivel || "";
    if (fromState) return fromState;
    if (fromVig) return fromVig;
    const m = String(curso || "").match(/(\d+)\s*[°º]?\s*(b[aá]sico|medio)/i);
    return m ? `${m[1]}° ${m[2].toLowerCase().replace("basico", "básico")}` : "";
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (pdfUrl) { setResolvedMineducUrl(""); return; }
        if (!nivelPrefer) { setResolvedMineducUrl(""); return; }
        const qs = query(collection(db, "mineduc_pdfs"), where("nivel", "==", nivelPrefer));
        const snap = await getDocs(qs);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const hit = items.find((x) => x.asignatura === asignatura && x.unidad === unidad) || items.find((x) => x.asignatura === asignatura) || items[0];
        if (!cancelled) setResolvedMineducUrl(hit?.url || "");
      } catch (e) { if (!cancelled) setResolvedMineducUrl(""); console.warn("[ProgramaPDF] mineduc_pdfs lookup:", e?.message || e); }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl, nivelPrefer, asignatura, unidad]); // eslint-disable-line

  useEffect(() => {
    const el = pdfWrapRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { const w = Math.max(320, Math.floor(entries[0].contentRect.width - 24)); setPdfWidth(Math.min(980, w)); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => { if (location?.state?.ficha?.programaUrl) { try { localStorage.setItem("programaPdfUrl", location.state.ficha.programaUrl); } catch {} } }, [location?.state?.ficha?.programaUrl]);

  const onPdfLoaded = ({ numPages }) => { setPdfPages(numPages || 0); setPdfPage(1); };
  const goPrev = () => setPdfPage((p) => Math.max(1, p - 1));
  const goNext = () => setPdfPage((p) => Math.min(pdfPages || 1, p + 1));
  const handleSetPdf = () => { const u = (pdfUrl || "").trim(); if (!u) return; try { localStorage.setItem("programaPdfUrl", u); } catch {} };
  const finalPdfUrl = pdfUrl || resolvedMineducUrl;

  const ALL_APPS = useMemo(() => Object.entries(APP_GROUPS).flatMap(([group, apps]) => (apps || []).map((a) => ({ ...a, group }))), []);
  const [showApps, setShowApps] = useState(true);
  const [appGroupSel, setAppGroupSel] = useState("Todas");
  const [appSearch, setAppSearch] = useState("");
  const groupNames = useMemo(() => ["Todas", ...Object.keys(APP_GROUPS)], []);
  const appsFiltered = useMemo(() => {
    const needle = norm(appSearch);
    return ALL_APPS.filter((a) => { const inGroup = appGroupSel === "Todas" || a.group === appGroupSel; const inSearch = !needle || norm(a.name).includes(needle) || norm(a.id).includes(needle) || norm(a.group).includes(needle); return inGroup && inSearch; });
  }, [ALL_APPS, appGroupSel, appSearch]);

  const openApp = (app) => {
    const id = String(app.id || ""); const url = ensureHttp(app.url || "");
    if (app.embed) {
      if (id.startsWith("geogebra")) return trySetMain(toEmbedURL(url, "geogebra"));
      if (id.includes("desmos")) return trySetMain(toEmbedURL(url, "desmos"));
      if (id.includes("youtube")) return trySetMain(toEmbedURL(url, "youtube"));
      const finalUrl = /wikipedia|drive\.google|docs\.google|office|sharepoint|onedrive/.test(url) ? toEmbedURL(url, "custom") : ensureHttp(url);
      return trySetMain(finalUrl);
    }
    openInNew(url);
  };

  const wikiIntroWrap = { display: "grid", gridTemplateColumns: wikiThumb ? "88px 1fr" : "1fr", gap: 12, alignItems: "start" };
  const wikiThumbStyle = { width: 88, height: 88, objectFit: "cover", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#f8fafc" };
  const clamp4 = { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" };
  const subtle = { fontSize: 12, color: COLORS.textMuted };

  const unidadShown = emergency?.active ? emergency.unidad || unidad : unidad;
  const objetivoShown = emergency?.active ? emergency.objetivo || objetivo : objetivo;
  const habilidadesShown = emergency?.active ? (Array.isArray(emergency.habilidades) ? emergency.habilidades.join(", ") : emergency.habilidades || habilidades) : habilidades;

  return (
    <div style={page}>
      {isSpecial && (
        <div style={{ ...card, marginBottom: "1rem", border: "1px solid #facc15", background: "linear-gradient(90deg,#fef3c7,#ffffff)" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{S.specialBanner}</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>{S.specialSub}</div>
        </div>
      )}

      {emergency?.active && (
        <div style={{ ...card, marginBottom: "1rem", border: "1px solid #fecaca", background: "linear-gradient(90deg, #fee2e2, #ffffff)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 999, padding: "4px 10px", fontWeight: 800 }}>{S.emergencyActive}</span>
            {emergency?.language && <span style={{ background: "#e0f2fe", color: "#075985", borderRadius: 999, padding: "4px 10px", fontWeight: 700 }}>{S.emergencyBadgeLangPrefix}{String(emergency.language).toUpperCase()}</span>}
            <span style={{ color: COLORS.textDark }}><b>{emergency.unidad || S.noUnitEmergency}</b> — {emergency.objetivo || S.noObjectiveEmergency}</span>
          </div>
        </div>
      )}

      {claseVigente && (
        <div style={{ ...card, marginBottom: "1rem", background: claseVigente.fuente === "calendario" ? "rgba(124,58,237,.06)" : "rgba(2,132,199,.06)" }}>
          <div style={{ fontWeight: 800 }}>{claseVigente.fuente === "calendario" ? S.weeklyPlanCalendar : claseVigente.fuente === "slots" ? S.weeklyPlanSlots : S.weeklyPlanNone}</div>
          {claseVigente.unidad && <div><b>{S.unitTitle}:</b> {claseVigente.unidad}{claseVigente.evaluacion ? ` ${S.assessmentTag}` : ""}</div>}
        </div>
      )}

      <div style={{ ...row("1rem"), marginBottom: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>{S.devTitle}</div>
          <div style={{ color: COLORS.textMuted, marginBottom: 8 }}>{horaActual}</div>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
            <CronometroGlobal duracion={duracion} onEnd={handleEnd} />
          </div>
        </div>

        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 6 }}>{S.unitTitle}</div>
          <div style={{ marginBottom: 6 }}>
            <strong>{unidadShown || S.noUnit} </strong>
            {emergency?.active && emergency?.language && <span style={{ marginLeft: 8, background: "#e0f2fe", color: "#075985", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{S.emergencyBadgeLangPrefix}{String(emergency.language).toUpperCase()}</span>}
          </div>
          <div style={{ marginBottom: 6 }}><strong>{S.objectiveTitle}:</strong> {objetivoShown || S.noObjective}</div>
          <div><strong>{S.skillsTitle}:</strong> {habilidadesShown || S.noSkills}</div>
          {oaMinisterio && <div style={{ marginTop: 8, color: COLORS.textDark }}><strong>OA:</strong> {oaMinisterio.descripcion}</div>}
          <div style={{ marginTop: 10, color: COLORS.textMuted }}>
            <strong>{S.courseLabel}:</strong> {curso || S.noCourse} &nbsp;|&nbsp; <strong>{S.subjectLabel}:</strong> {asignatura || S.noSubject}
          </div>
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: ".6rem" }}>
          <div style={{ display: "flex", gap: ".5rem" }}><button style={btnWhite}>‹</button><button style={btnWhite}>👍</button></div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800 }}>{nombreProfesor}</div>
            <div style={{ color: COLORS.textMuted }}>{asignatura}</div>
          </div>
        </div>
      </div>

      {emergency?.active && emergency?.fases?.desarrollo && (
        <div style={{ ...card, border: "1px dashed #ef4444", background: "#fff", marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{S.emergencyDevTitle}</strong>
            {emergency?.language && <span style={{ background: "#e0f2fe", color: "#075985", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{S.emergencyBadgeLangPrefix}{String(emergency.language).toUpperCase()}</span>}
          </div>
          <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{emergency.fases.desarrollo}</p>
        </div>
      )}

      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>{S.supportResourceTitle}</h3>
        {presentKind === "screen" ? (
          <video ref={screenVideoRef} autoPlay playsInline style={{ width: "80%", height: 420, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#000", objectFit: "contain" }} />
        ) : presentKind === "image" && presentBlobUrl ? (
          <img src={presentBlobUrl} alt="Presented" style={{ width: "80%", height: 420, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#000", objectFit: "contain" }} />
        ) : (
          <iframe key={mainSrc} width="80%" height="420" src={mainSrc} title="Panel principal" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#000" }}></iframe>
        )}
        {panelMsg && <div style={{ marginTop: 8, color: "#b45309" }}>⚠️ {panelMsg}</div>}

        <div style={toolsWrap}>
          <h4 style={{ margin: "0 0 8px" }}>{S.quickToolsTitle}</h4>
          <div style={toolsRow}>
            <input style={inputSmall} value={ytQuery} onChange={(e) => setYtQuery(e.target.value)} placeholder={S.ytPlaceholder} />
            <button style={btnTool} onClick={handleOpenYouTube}>▶️ Ver en panel</button>
            <select style={selectSmall} value={ggTool} onChange={(e) => setGgTool(e.target.value)} title={S.geoToolTitle}>
              <option value="calculator">{S.geoCalcLabel}</option>
              <option value="geometry">{S.geoGeomLabel}</option>
              <option value="3d">{S.geo3dLabel}</option>
            </select>
            <button style={btnTool} onClick={handleOpenGeoGebra}>{S.geogebraInPanel}</button>
            <button style={btnTool} onClick={handleOpenDesmos}>{S.desmosInPanel}</button>
            <button style={btnTool} onClick={handleOpenPhET}>{S.phetPortal}</button>
            <button style={btnTool} onClick={handleOpenDrive}>{S.driveLabel}</button>
            <input style={{ ...inputSmall, minWidth: 280 }} value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder={S.customLinkPlaceholder} />
            <button style={btnTool} onClick={handleOpenCustom}>🔗 Abrir en panel</button>
          </div>
          <div style={iconsRow}>
            <button style={iconBtn} onClick={presentChooser} title={sharing ? S.sharingNow : S.presentTooltip}><IconPresent /></button>
            <button style={iconBtn} onClick={openShapE} title={S.shapEIconTitle}><img src={ico("huggingface.co")} alt="Shap-E" style={iconImg} /></button>
            <button style={iconBtn} onClick={openTripoSR} title={S.tripoIconTitle}><img src={ico("huggingface.co")} alt="TripoSR" style={iconImg} /></button>
            <button style={iconBtn} onClick={openEscapeDemo} title={S.escapeDemoTitle}><img src={ico("aframe.io")} alt="A-Frame" style={iconImg} /></button>
          </div>
          <div style={appsWrap}>
            <div style={{ ...toolsRow, justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h4 style={{ margin: 0 }}>{S.appsTitle}</h4>
                <button style={{ ...btnTool, padding: ".3rem .6rem" }} onClick={() => setShowApps((v) => !v)} title={S.appsToggleTitle}>{showApps ? S.appsHide : S.appsShow}</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select style={selectSmall} value={appGroupSel} onChange={(e) => setAppGroupSel(e.target.value)} title={S.appsFilterTitle}>
                  {groupNames.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <input style={{ ...inputSmall, minWidth: 240 }} value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder={S.appsSearchPlaceholder} />
              </div>
            </div>
            {showApps && (
              <div style={appsGrid}>
                {appsFiltered.map((app) => {
                  let domain = "example.com";
                  try { domain = new URL(ensureHttp(app.url)).host; } catch {}
                  return (
                    <div key={`${app.group}:${app.id}`} style={appTile} onClick={() => openApp(app)} title={app.embed ? S.openInPanelTitle : S.openInNewTabTitle}>
                      <img src={ico(domain)} alt={app.name} style={appIcon} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={appTitle}>{app.name}</span>
                        <span style={appGroupLabel}>{app.group}</span>
                      </div>
                    </div>
                  );
                })}
                {appsFiltered.length === 0 && <div style={{ gridColumn: "1/-1", color: COLORS.textMuted, fontStyle: "italic", padding: 6 }}>{S.appsNoResults}</div>}
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={handleFileChosen} style={{ display: "none" }} />
        </div>
      </div>

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, textAlign: "center" }}>{S.pdfProgramTitle}</h3>
        <div style={{ ...toolsRow, marginBottom: 8 }}>
          <input style={{ ...inputSmall, minWidth: 420 }} value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder={S.pdfUrlPlaceholder} />
          <button style={btnTool} onClick={handleSetPdf}>{S.pdfSaveLink}</button>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btnTool, opacity: pdfMode === "flip" ? 1 : 0.6 }} onClick={() => setPdfMode("flip")}>{S.pdfFlipMode}</button>
            <button style={{ ...btnTool, opacity: pdfMode === "scroll" ? 1 : 0.6 }} onClick={() => setPdfMode("scroll")}>{S.pdfScrollMode}</button>
            {resolvedMineducUrl && !pdfUrl && <button style={btnTool} onClick={() => setPdfUrl(resolvedMineducUrl)}>{S.pdfUseMineduc}</button>}
          </div>
        </div>
        {!finalPdfUrl ? (
          <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{S.pdfHelperText}</div>
        ) : pdfMode === "scroll" ? (
          <div ref={pdfWrapRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <button style={btnTool} onClick={goPrev} disabled={pdfPage <= 1}>{S.pdfPrev}</button>
              <div style={{ fontWeight: 700 }}>{S.pdfPageLabel} {pdfPage} / {pdfPages || "…"}</div>
              <button style={btnTool} onClick={goNext} disabled={!pdfPages || pdfPage >= pdfPages}>{S.pdfNext}</button>
            </div>
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", background: "#f8fafc" }}>
              <Document file={{ url: finalPdfUrl }} onLoadSuccess={onPdfLoaded} loading={<div style={{ padding: 12 }}>{S.pdfLoading}</div>}>
                <Page pageNumber={pdfPage} width={pdfWidth} renderAnnotationLayer renderTextLayer />
              </Document>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Document file={{ url: finalPdfUrl }} onLoadError={(e) => console.error("PDF error:", e)} onLoadSuccess={({ numPages }) => setPdfPages(numPages)} loading={<div style={{ padding: 12 }}>{S.pdfLoading}</div>}>
              {pdfPages ? (
                <HTMLFlipBook width={800} height={1000} className="shadow-lg">
                  {Array.from({ length: pdfPages }).map((_, i) => (
                    <div key={`pg-${i}`} className="bg-white p-2">
                      <Page pageNumber={i + 1} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
                    </div>
                  ))}
                </HTMLFlipBook>
              ) : null}
            </Document>
          </div>
        )}
      </div>

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, textAlign: "center" }}>{S.lab3dTitle}</h3>
        <div style={{ ...toolsRow, marginBottom: 6 }}>
          <input style={{ ...inputSmall, minWidth: 360 }} value={prompt3D} onChange={(e) => setPrompt3D(e.target.value)} placeholder={S.prompt3DPlaceholder} onKeyDown={(e) => { if (e.key === "Enter") generateLocal3D(); }} />
          <button style={btnTool} onClick={openShapE}>{S.shapEButtonLabel}</button>
          <button style={btnTool} onClick={openTripoSR}>{S.tripoButtonLabel}</button>
          <button style={{ ...btnTool, opacity: genLoading ? 0.7 : 1 }} onClick={generateLocal3D} disabled={genLoading} title={S.local3dProxyHint}>{S.lab3dGenerateServer}</button>
        </div>
        {genMsg && <div style={{ textAlign: "center", color: "#b45309", marginBottom: 6 }}>{genMsg}</div>}
        <div style={{ ...toolsRow, marginBottom: 10 }}>
          <input style={{ ...inputSmall, minWidth: 360 }} value={glbUrl} onChange={(e) => setGlbUrl(e.target.value)} placeholder={S.glbPlaceholder} />
          <button style={btnTool} onClick={handleShowGLB}>{S.view3D}</button>
          <button style={btnTool} onClick={handlePickGLB}>{S.uploadGLB}</button>
          <input ref={modelFileInputRef} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={handleGLBChosen} style={{ display: "none" }} />
        </div>
        <div ref={viewerRef} style={{ display: "flex", justifyContent: "center" }}>
          {modelSrc ? (
            <model-viewer src={modelSrc} alt="Modelo 3D" camera-controls auto-rotate exposure="1.1" style={{ width: "100%", maxWidth: 720, height: 420, borderRadius: 12, border: `1px solid ${COLORS.border}` }} ar></model-viewer>
          ) : (
            <div style={{ color: COLORS.textMuted, fontStyle: "italic" }}>{S.lab3dHelper}</div>
          )}
        </div>
      </div>

      {wikipediaUrl && (wikiSummary || wikiTitle) && (
        <div style={{ ...card, marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>{S.wikiIntroTitle}</h3>
            <div style={subtle}>{S.wikiRelatedToPrefix} <strong>{unidadShown || objetivoShown || S.wikiTopicFallback}</strong></div>
          </div>
          <div style={wikiIntroWrap}>
            {wikiThumb ? <img src={wikiThumb} alt={wikiTitle || "Wikipedia"} style={wikiThumbStyle} /> : null}
            <div>
              {wikiTitle && <div style={{ fontWeight: 800, marginBottom: 4 }}><a href={wikipediaUrl} target="_blank" rel="noreferrer noopener" style={{ color: COLORS.textDark, textDecoration: "none" }}>{wikiTitle} —</a></div>}
              {wikiSummary ? <div style={clamp4}>{wikiSummary}</div> : <div style={{ color: COLORS.textMuted, fontStyle: "italic" }}>{S.wikiNoSummary}</div>}
              <div style={{ marginTop: 8 }}><a href={wikipediaUrl} target="_blank" rel="noreferrer noopener" style={{ ...subtle, textDecoration: "underline" }}>{S.wikiOpenFull}</a></div>
            </div>
          </div>
        </div>
      )}

      {wikipediaUrl && (
        <div style={{ ...card }}>
          <h3 style={{ marginTop: 0, textAlign: "center" }}>{S.wikiComplementaryTitle}</h3>
          <iframe src={wikipediaUrl} width="100%" height="420" title="Contenido Wikipedia" style={{ border: `1px solid ${COLORS.border}`, borderRadius: "8px" }}></iframe>
        </div>
      )}

      {/* ✅ Botón Ir al Cierre — propaga todos los datos de clase */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          onClick={() =>
            navigate("/cierre", {
              state: {
                ...(location?.state || {}),
                isClaseEspecial: isSpecial,
                language,
                clase: {
                  unidad, objetivo,
                  habilidades: habilidades || "",
                  asignatura,
                  curso,
                },
                slotId: location?.state?.slotId || localStorage.getItem("__lastSlotId") || "0-0",
              },
            })
          }
          style={btnWhite}
          title={S.goToClosureTitle}
        >
          {S.goToClosure}
        </button>
      </div>
    </div>
  );
}