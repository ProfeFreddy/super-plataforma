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
import { api } from "../lib/api";
import { db } from "../firebase";
import { MINEDUC_ENABLED } from "../lib/api";

import {
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
} from "firebase/firestore"; // +collection/getDocs/query/where
import CronometroGlobal from "../components/CronometroGlobal";
import { subscribeEmergency } from "../services/emergencyService"; // ✅ QUEDA ESTA
import HTMLFlipBook from "react-pageflip"; // ✅ QUEDA ESTA
import FichaClaseSticky from "../components/FichaClaseSticky";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";

/* ---- PDF (react-pdf) ---- */
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/* Worker estable por CDN (evita diferencias de ruta entre versiones) */
pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

import { ensurePdfJs } from "../lib/pdfSafe";

// --- helper para pedir JSON sin headers raros (evita preflight) ---
async function fetchJSON(url) {
  const r = await fetch(url, { method: "GET", mode: "cors" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ADICIONAL */
import { getClaseVigente, getYearWeek } from "../services/PlanificadorService";

/* auth para garantizar sesión antes de tocar Firestore */
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

/* 🔁 CAMBIO API_BASE: import base dinámica para llamadas a serverless */
import { API_BASE } from "../utils/apiBase";

/* NUEVO: base del proxy (más robusto) */
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

/* helpers de tiempo/slot para demo (?at=HH:MM&dow=1..5) */
const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00";

function _now() {
  const q = new URLSearchParams(window.location.search);
  const at = q.get("at");
  if (at) {
    const [hh, mm] = at.split(":").map(Number);
    const d = new Date();
    const H = Number.isFinite(hh) ? hh : 0;
    const M = Number.isFinite(mm) ? mm : 0;
    d.setHours(H);
    d.setMinutes(M);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  }
  return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date();
}

function colDeHoy() {
  const q = new URLSearchParams(window.location.search);
  const fromQ = Number(q.get("dow"));
  const d = fromQ >= 1 && fromQ <= 5 ? fromQ : _now().getDay(); // 0..6
  return d >= 1 && d <= 5 ? d - 1 : 0; // 0..4
}

function filaDesdeMarcas(marcas = []) {
  const now = _now();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < marcas.length - 1; i++) {
    const [sh, sm] = marcas[i];
    const [eh, em] = marcas[i + 1];
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (mins >= start && mins < end) return i;
  }
  return 0;
}

/* Acepta varios formatos en horarioConfig */
function getMarcasFromConfig(cfg = {}) {
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;

  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object") {
    return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  }

  if (Array.isArray(cfg.marcasStr)) {
    return cfg.marcasStr.map((s) => {
      const [h, m] = String(s).split(":").map((n) => Number(n) || 0);
      return [h, m];
    });
  }

  if (Array.isArray(cfg.bloquesGenerados) && cfg.bloquesGenerados.length) {
    const starts = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...starts, lastEnd].map((s) => {
      const [h, m] = s.split(":").map((n) => Number(n) || 0);
      return [h, m];
    });
  }
  return [];
}

// ====== estilos (alineados con Home/InicioClase) ======
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
  gridTemplateColumns: "1fr 2fr 1fr",
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

/* =======================
   NUEVOS estilos/tools
   ======================= */
const toolsWrap = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: `1px dashed ${COLORS.border}`,
};
const toolsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "center",
  alignItems: "center",
};
const inputSmall = {
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  minWidth: 220,
  outline: "none",
};
const selectSmall = { ...inputSmall, minWidth: 160 };
const btnTool = { ...btnWhite, padding: ".45rem .7rem", fontWeight: 800 };

/* fila de iconos */
const iconsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "center",
  alignItems: "center",
  marginTop: 10,
};
const iconBtn = {
  ...btnWhite,
  padding: 6,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 56,
  height: 56,
};
const iconImg = { width: 28, height: 28 };

/* helper favicon */
const ico = (domain) =>
  `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;

/* icono presentar/compartir */
function IconPresent({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 5c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5v2h3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h3v-2H5a2 2 0 0 1-2-2V5zm2 0v10h14V5H5zm7.7 2.3 3.6 3.6a1 1 0 0 1-1.4 1.4l-1.9-1.9V14a1 1 0 1 1-2 0V10.4l-1.9 1.9a1 1 0 0 1-1.4-1.4l3.6-3.6a1 1 0 0 1 1.4 0z"
      />
    </svg>
  );
}

/* 3D */
const SHAPE_SPACE_URL = "https://huggingface.co/spaces/hysts/Shap-E";
const TRIPOSR_SPACE_URL = "https://huggingface.co/spaces/Intel/TripoSR";
const AFRAME_DEMO_URL = "https://aframe.io/examples/showcase/helloworld/";

/* CRONOMETRO COMPARTIDO (clave por slot) */
const COUNT_KEY_LEGACY = "inicioClase_countdown_end";
function makeCountKey(slotId = "0-0") {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek();
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
}

/* helpers de normalización y mapeo a slugs API MINEDUC */
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
  return ASIG_SLUGS[k] || "matematica"; // fallback estable
}

function nivelToApi(cursoStr = "", prefer = "") {
  const s = norm(cursoStr || prefer);
  if (/basico|basica/i.test(s)) return "basica";
  return "media";
}

function cursoFromNivelSeccion(nivel = "", seccion = "") {
  const n = (nivel || "").replace(/º/g, "°");
  return [n, seccion].filter(Boolean).join(" ").trim();
}

/* Permite forzar slot via ?slot=fila-col */
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

/* ===============================
   CONFIG: catálogos de Apps
   =============================== */
const APP_GROUPS = {
  Generales: [
    { id: "youtube", name: "YouTube", url: "https://youtube.com", icon: "YT", embed: true },
    { id: "google", name: "Google", url: "https://google.com", icon: "G", embed: true },
    { id: "wikipedia", name: "Wikipedia", url: "https://wikipedia.org", icon: "W", embed: true },
    { id: "drive", name: "Drive", url: "https://drive.google.com", icon: "D", embed: false },
    { id: "flipbook", name: "Flipbook", url: "https://heyzine.com", icon: "FB", embed: true },
    { id: "timer", name: "Timer", url: "https://timer.onlineclock.net", icon: "T", embed: true },
    { id: "qr", name: "QR Generator", url: "https://qrcode-monkey.com", icon: "QR", embed: true },
  ],
  Matematica: [
    {
      id: "geogebra-graph",
      name: "GeoGebra · Graficadora",
      url: "https://www.geogebra.org/graphing",
      icon: "GG",
      embed: true,
    },
    {
      id: "geogebra-geom",
      name: "GeoGebra · Geometria",
      url: "https://www.geogebra.org/geometry",
      icon: "GG",
      embed: true,
    },
    {
      id: "desmos",
      name: "Desmos",
      url: "https://www.desmos.com/calculator",
      icon: "DS",
      embed: true,
    },
    {
      id: "phet-math",
      name: "PhET Matematicas",
      url: "https://phet.colorado.edu/es/simulations/filter?subjects=math",
      icon: "PH",
      embed: false,
    },
  ],
  Lenguaje: [
    { id: "wordreference", name: "WordReference", url: "https://www.wordreference.com", icon: "WR", embed: true },
    { id: "linguee", name: "Linguee", url: "https://www.linguee.es", icon: "LG", embed: true },
    { id: "docs", name: "Google Docs", url: "https://docs.google.com", icon: "GD", embed: false },
    { id: "padlet", name: "Padlet", url: "https://padlet.com", icon: "PD", embed: false },
  ],
  Ciencias: [
    {
      id: "phet-physics",
      name: "PhET Fisica",
      url: "https://phet.colorado.edu/es/simulations/filter?subjects=physics",
      icon: "PH",
      embed: false,
    },
    {
      id: "phet-chem",
      name: "PhET Quimica",
      url: "https://phet.colorado.edu/es/simulations/filter?subjects=chemistry",
      icon: "PH",
      embed: false,
    },
    {
      id: "phet-bio",
      name: "PhET Biologia",
      url: "https://phet.colorado.edu/es/simulations/filter?subjects=biology",
      icon: "PH",
      embed: false,
    },
  ],
  Historia: [
    {
      id: "google-arts",
      name: "Google Arts & Culture",
      url: "https://artsandculture.google.com",
      icon: "AC",
      embed: true,
    },
    { id: "timeline", name: "KnightLab Timeline", url: "https://timeline.knightlab.com", icon: "TL", embed: false },
  ],
  Ingles: [
    { id: "cambridge", name: "Cambridge Dictionary", url: "https://dictionary.cambridge.org", icon: "CD", embed: true },
    { id: "reverso", name: "Reverso Context", url: "https://context.reverso.net", icon: "RV", embed: true },
  ],
  Artes: [
    { id: "sketchpad", name: "Sketchpad", url: "https://sketch.io/sketchpad", icon: "SP", embed: true },
    { id: "autodraw", name: "AutoDraw", url: "https://www.autodraw.com", icon: "AD", embed: true },
  ],
  Tecnologia: [
    { id: "scratch", name: "Scratch", url: "https://scratch.mit.edu", icon: "SC", embed: false },
    { id: "w3schools", name: "W3Schools", url: "https://www.w3schools.com/tryit", icon: "W3", embed: true },
  ],
};

/* estilos grid Apps */
const appsWrap = {
  marginTop: 10,
  paddingTop: 10,
  borderTop: `1px dashed ${COLORS.border}`,
};
const appsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginTop: 8,
};
const appTile = {
  background: "#ffffff",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "10px",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  gap: 10,
  alignItems: "center",
  boxShadow: "0 3px 8px rgba(16,24,40,.06)",
};
const appIcon = {
  width: 28,
  height: 28,
  flex: "0 0 28px",
  borderRadius: 6,
};
const appTitle = { fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: COLORS.textDark };
const appGroupLabel = { fontSize: 11, color: COLORS.textMuted };

/* ===============================
   COMPONENTE PRINCIPAL
   =============================== */
export default function DesarrolloClase({ duracion = 30, onIrACierre }) {
  const navigate = useNavigate();
  const location = useLocation();

  // FIX: mover a dentro del componente (los hooks no van a nivel de módulo)
  useEffect(() => {
    ensurePdfJs().catch(console.warn);
  }, []);

  // useContext dentro del componente
  const planCtx = useContext(PlanContext) || {};
  const { user = null, plan = "FREE", caps = PLAN_CAPS.FREE, loading = false } = planCtx;

  const [horaActual, setHoraActual] = useState("");
  const [nombreProfesor, setNombreProfesor] = useState("Profesor");
  const [asignatura, setAsignatura] = useState("(sin asignatura)");
  const [curso, setCurso] = useState("(sin curso)");
  const [unidad, setUnidad] = useState("");
  const [oaMinisterio, setOaMinisterio] = useState(null);
  const [wikipediaUrl, setWikipediaUrl] = useState(null);

  // Wikipedia summary (intro 3–4 líneas)
  const [wikiTitle, setWikiTitle] = useState("");
  const [wikiSummary, setWikiSummary] = useState("");
  const [wikiThumb, setWikiThumb] = useState("");
  const [wikiLang, setWikiLang] = useState("es");

  // sesión antes de leer Firestore
  const [authed, setAuthed] = useState(false);

  // detalle clase
  const [objetivo, setObjetivo] = useState("");
  const [habilidades, setHabilidades] = useState("");

  // NUEVO: estado de emergencia (lectura live)
  const [emergency, setEmergency] = useState(null);

  // herramientas rápidas
  const [ytQuery, setYtQuery] = useState("");
  const [ggTool, setGgTool] = useState("calculator"); // calculator | geometry | 3d
  const [customLink, setCustomLink] = useState("");

  // panel principal
  const [mainSrc, setMainSrc] = useState("https://www.youtube-nocookie.com/embed/Ibrj8pRX8Zg");
  const [panelMsg, setPanelMsg] = useState("");

  // presentación (archivo o pantalla)
  const [presentKind, setPresentKind] = useState("iframe"); // 'iframe' | 'screen' | 'image'
  const [presentBlobUrl, setPresentBlobUrl] = useState(null);
  const fileInputRef = useRef(null);
  const screenVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  // clase vigente/badge
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
          if (res.asignatura && asignatura === "(sin asignatura)") setAsignatura(res.asignatura);
          if ((res.nivel || res.seccion) && curso === "(sin curso)") {
            setCurso(cursoFromNivelSeccion(res.nivel, res.seccion));
          }
        }
      } catch (e) {
        console.error("[Desarrollo] getClaseVigente:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureHttp = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const openInNew = (url) => window.open(url, "_blank", "noopener,noreferrer");

  // wrapper lector (para sitios que bloquean iframe)
  const readerWrap = (u) => {
    try {
      const x = ensureHttp(u);
      const parsed = new URL(x);
      const scheme = parsed.protocol.replace(":", "");
      return `https://r.jina.ai/${scheme}://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch {
      return u;
    }
  };

  // helpers EMBED
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
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
      q || "matemática 1 medio"
    )}`;
  };

  const toEmbedURL = (urlOrQuery, kind) => {
    if (kind === "youtube") {
      const q =
        (urlOrQuery || "").trim() || (unidad ? `matemática ${unidad}` : "matemática 1 medio");
      return ytEmbedFromQuery(q);
    }

    if (kind === "geogebra") {
      let path = "/calculator";
      if (ggTool === "geometry") path = "/geometry";
      if (ggTool === "3d") path = "/3d";
      return `https://www.geogebra.org${path}?embed`;
    }

    if (kind === "desmos") {
      return "https://www.desmos.com/calculator?embed&lang=es";
    }

    // CUSTOM + conocidos
    let u = ensureHttp((urlOrQuery || "").trim());
    try {
      const parsed = new URL(u);

      if (parsed.hostname.includes("youtube") || parsed.hostname.includes("youtu.be")) {
        return ytEmbedFromQuery(u);
      }

      if (parsed.hostname.endsWith("docs.google.com")) {
        if (parsed.pathname.includes("/document/")) return u.replace(/\/edit.*$/i, "/preview");
        if (parsed.pathname.includes("/spreadsheets/")) return u.replace(/\/edit.*$/i, "/preview");
        if (parsed.pathname.includes("/presentation/")) return u.replace(/\/edit.*$/i, "/embed");
      }

      if (
        parsed.hostname.endsWith("onedrive.live.com") ||
        parsed.hostname.endsWith("sharepoint.com")
      ) {
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`;
      }

      // Wikipedia directa
      if (parsed.hostname.includes("wikipedia.org")) return u;
    } catch {
      return ytEmbedFromQuery(urlOrQuery);
    }

    return u;
  };

  // cargar en panel principal
  const trySetMain = (embedUrl) => {
    setPanelMsg("");
    setMainSrc(embedUrl);
    setPresentKind("iframe");
    if (
      /(^https?:\/\/)?(docs\.google\.com|drive\.google\.com|office\.com|onedrive\.live\.com|sharepoint\.com)/i.test(
        embedUrl
      )
    ) {
      setPanelMsg(
        "Este sitio puede requerir inicio de sesión o bloquear funciones dentro del panel. Si no ves contenido, pega un enlace público/“embed”."
      );
    }
  };

  // Presentación de archivo o pantalla
  const handleSelectFile = () => fileInputRef.current?.click();

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type === "application/pdf") {
      if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {}
      setPresentBlobUrl(url);
      setPresentKind("iframe");
      trySetMain(url);
    } else if (file.type.startsWith("image/")) {
      if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {}
      setPresentBlobUrl(url);
      setPresentKind("image");
      setPanelMsg("");
    } else {
      URL.revokeObjectURL(url);
      alert(
        "Para Word/Excel/PowerPoint, usa «Compartir pantalla». (El panel renderiza nativamente PDF e imágenes)."
      );
    }
    try {
      e.target.value = "";
    } catch {}
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      screenStreamRef.current = stream;
      setPresentKind("screen");
      setSharing(true);
      const [track] = stream.getVideoTracks();
      track.addEventListener("ended", () => stopScreenShare());
    } catch (e) {
      console.warn("DisplayMedia cancelado/no disponible:", e);
    }
  };

  const stopScreenShare = () => {
    try {
      const stream = screenStreamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch {}
    screenStreamRef.current = null;
    setSharing(false);
    setPresentKind("iframe");
  };

  const presentChooser = () => {
    const yes = window.confirm(
      "¿Compartir pantalla ahora?\nAceptar: Compartir pantalla\nCancelar: Presentar archivo (PDF o imagen) en el panel"
    );
    if (yes) startScreenShare();
    else handleSelectFile();
  };

  useEffect(() => {
    return () => {
      if (presentBlobUrl) try { URL.revokeObjectURL(presentBlobUrl); } catch {}
      if (screenStreamRef.current) {
        try {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
      }
    };
  }, []); // eslint-disable-line

  // Handlers → panel principal
  const handleOpenYouTube = () => trySetMain(toEmbedURL(ytQuery, "youtube"));
  const handleOpenGeoGebra = () => trySetMain(toEmbedURL("", "geogebra"));
  const handleOpenDesmos = () => trySetMain(toEmbedURL("", "desmos"));
  const handleOpenPhET = () => {
    trySetMain(
      "https://phet.colorado.edu/es/simulations/filter?subjects=math&type=html,prototype"
    );
    setPanelMsg(
      "Para ver una simulación dentro del panel, entra a la simulación → 'Compartir/Insertar' y pega ese enlace en 'Abrir en panel'."
    );
  };
  const handleOpenDrive = () => trySetMain(readerWrap("https://drive.google.com"));
  const handleOpenCustom = () => {
    const u = customLink.trim();
    if (!u) return;
    trySetMain(toEmbedURL(u, "custom"));
  };

  const handleOpenPowerPoint = () => trySetMain(readerWrap("https://www.office.com/launch/powerpoint"));
  const handleOpenWord = () => trySetMain(readerWrap("https://www.office.com/launch/word"));
  const handleOpenExcel = () => trySetMain(readerWrap("https://www.office.com/launch/excel"));

  const handleOpenSlides = () => trySetMain(readerWrap("https://slides.new"));
  const handleOpenDocs = () => trySetMain(readerWrap("https://docs.new"));
  const handleOpenSheets = () => trySetMain(readerWrap("https://sheets.new"));

  const handleOpenYouTubeIcon = () => handleOpenYouTube();

  // Wikipedia DIRECTA
  const handleOpenWikipedia = () => {
    if (wikipediaUrl) trySetMain(wikipediaUrl);
    else trySetMain("https://es.wikipedia.org");
  };

  // reloj
  useEffect(() => {
    setHoraActual(new Date().toLocaleTimeString());
    const id = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // asegura sesión anónima primero
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
        console.error("[Desarrollo] auth error:", e);
        setAuthed(false);
      }
    });
    return () => unsub();
  }, []);

  /* NUEVO: suscripción live a Clase de Emergencia (cuando ya hay sesión) */
  useEffect(() => {
    if (!authed) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid) return;
    const off = subscribeEmergency(uid, setEmergency);
    return () => off && off();
  }, [authed]);

  /* preferir lo que venga desde Inicio (state) */
  useEffect(() => {
    const st = location?.state || null;
    if (!st) return;
    try {
      if (st.clase) {
        setUnidad((prev) => prev || st.clase.unidad || "");
        setObjetivo((prev) => prev || st.clase.objetivo || "");
        setHabilidades((prev) => prev || st.clase.habilidades || "");
        if (st.clase.asignatura) setAsignatura(st.clase.asignatura);
        if (st.clase.curso) setCurso(st.clase.curso);
        if (!st.clase.curso && (st.clase.nivel || st.clase.seccion)) {
          setCurso(cursoFromNivelSeccion(st.clase.nivel, st.clase.seccion));
        }
      }
      if (st.slotId) {
        try {
          localStorage.setItem("__lastSlotId", st.slotId);
        } catch {}
      }
      if (Number.isFinite(+st.endMs) && +st.endMs > 0) {
        const key = makeCountKey(st.slotId || "0-0");
        try {
          localStorage.setItem(key, String(st.endMs));
          localStorage.setItem(COUNT_KEY_LEGACY, String(st.endMs));
        } catch {}
      }
    } catch {}
  }, [location]);

  // AUTO–INICIO cronómetro si no hay endMs válido
  useLayoutEffect(() => {
    try {
      const slotPref =
        location?.state?.slotId || slotFromQuery() || localStorage.getItem("__lastSlotId") || "0-0";
      const key = makeCountKey(slotPref);
      const legacy = COUNT_KEY_LEGACY;
      const now = Date.now();
      let endStr = localStorage.getItem(key) || localStorage.getItem(legacy);
      if (!endStr || +endStr <= now) {
        const endMs = now + duracion * 60 * 1000;
        localStorage.setItem(key, String(endMs));
        localStorage.setItem(legacy, String(endMs));
      }
    } catch {}
  }, []); // eslint-disable-line

  // ====== ESTADOS NUEVOS PARA OA/UNIDAD/HABILIDADES (MINEDUC) ======
  const [oaData, setOaData] = useState(null);       // Objetivos / OA
  const [unidadData, setUnidadData] = useState(null);
  const [habData, setHabData] = useState(null);     // Habilidades

  // ====== FUNCIONES QUE ME PEDISTE PEGAR (DENTRO DEL COMPONENTE) ======
  async function cargarOA(params) {
    try {
      if (!MINEDUC_ENABLED) {
        console.debug("[MINEDUC] OFF → skip OA");
        setOaData((prev) => prev ?? { items: [] });
        return;
      }
      const data = await buscarAsignaturaMineduc(params); // ← tus params reales
      setOaData(data);
    } catch (err) {
      console.warn("[MINEDUC] OA error/controlado:", err);
      setOaData((prev) => prev ?? { items: [] });
    }
  }

  async function cargarUnidad(params) {
    try {
      if (!MINEDUC_ENABLED) {
        console.debug("[MINEDUC] OFF → skip Unidad");
        setUnidadData((prev) => prev ?? { items: [] });
        return;
      }
      const data = await buscarUnidadMineduc(params);
      setUnidadData(data);
    } catch (err) {
      console.warn("[MINEDUC] Unidad error/controlado:", err);
      setUnidadData((prev) => prev ?? { items: [] });
    }
  }

  async function cargarHabilidades(params) {
    try {
      if (!MINEDUC_ENABLED) {
        console.debug("[MINEDUC] OFF → skip Habilidades");
        setHabData((prev) => prev ?? { items: [] });
        return;
      }
      const data = await buscarHabilidadesMineduc(params);
      setHabData(data);
    } catch (err) {
      console.warn("[MINEDUC] Habilidades error/controlado:", err);
      setHabData((prev) => prev ?? { items: [] });
    }
  }

  // Disparador para poblar catálogos MINEDUC sin romper tu flujo actual
  useEffect(() => {
    const unidadParaOA = (location?.state?.clase?.unidad || unidad || "").trim();
    const asigForOA = (location?.state?.clase?.asignatura || asignatura || "Matemática").trim();
    const cursoForOA = (location?.state?.clase?.curso || curso || "").trim();

    if (!unidadParaOA && !asigForOA && !cursoForOA) return;

    const params = {
      asignatura: asigToSlug(asigForOA),
      nivel: nivelToApi(cursoForOA, claseVigente?.nivel || ""),
      unidad: unidadParaOA,
    };
    // No afectan tu render actual: solo llenan oaData/unidadData/habData
    cargarOA(params);
    cargarUnidad(params);
    cargarHabilidades(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignatura, curso, unidad, MINEDUC_ENABLED]);

  // carga datos base + OA + Wikipedia (por unidad, con fallback objetivo)
  useEffect(() => {
    if (!authed) return;

    const obtenerDatos = async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
        if (!uid) return;

        /* === MEJORA: nombre del profesor desde `profesores/{uid}` con fallback a `usuarios/{uid}` === */
        try {
          const pref = doc(db, "profesores", uid);
          const psnap = await getDoc(pref);
          if (psnap.exists()) {
            const data = psnap.data() || {};
            const nombreP =
              data.nombre || data.nombreCompleto || data.profesorNombre || null;
            if (nombreP) setNombreProfesor(nombreP);
          }
        } catch (e) {
          if (e?.code !== "permission-denied")
            console.warn("[Desarrollo] profesores read:", e?.code || e);
        }

        try {
          const uref = doc(db, "usuarios", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const u = usnap.data() || {};
            if (nombreProfesor === "Profesor") {
              const nombreU = u.nombre || u.nombreCompleto || null;
              if (nombreU) setNombreProfesor(nombreU);
            }
          }
        } catch (e) {
          if (e?.code !== "permission-denied")
            console.warn("[Desarrollo] usuarios read:", e?.code || e);
        }
        /* === FIN MEJORA nombre profesor === */

        // 1) profesores/{uid} también trae unidad/asignatura/curso
        let unidadInicial = "";
        try {
          const pref = doc(db, "profesores", uid);
          const psnap = await getDoc(pref);
          if (psnap.exists()) {
            const data = psnap.data() || {};
            unidadInicial = (data.unidadInicial || "").trim();
            setUnidad((prev) => prev || unidadInicial);
            setAsignatura((prev) =>
              prev === "(sin asignatura)"
                ? data.asignatura || "(sin asignatura)"
                : prev
            );
            setCurso((prev) =>
              prev === "(sin curso)"
                ? data.curso ||
                  cursoFromNivelSeccion(data.nivel, data.seccion) ||
                  "(sin curso)"
                : prev
            );
          }
        } catch (e) {
          if (e?.code !== "permission-denied")
            console.warn("[Desarrollo] profesores read:", e?.code || e);
        }

        // 2) fallback usuarios/{uid}
        if (!unidadInicial) {
          try {
            const uref = doc(db, "usuarios", uid);
            const usnap = await getDoc(uref);
            if (usnap.exists()) {
              const u = usnap.data() || {};
              unidadInicial = (u.unidadInicial || u.unidad || "").trim();
              setUnidad((prev) => prev || unidadInicial);
              if (u.asignatura && asignatura === "(sin asignatura)")
                setAsignatura(u.asignatura);
              if (u.curso && curso === "(sin curso)") setCurso(u.curso);
            }
          } catch (e) {
            if (e?.code !== "permission-denied")
              console.warn("[Desarrollo] usuarios fallback:", e?.code || e);
          }
        }

        // 3) fallback clases_detalle/{uid}/slots/último o por ?slot=
        try {
          const slotPref =
            location?.state?.slotId ||
            slotFromQuery() ||
            localStorage.getItem("__lastSlotId") ||
            "0-0";
          const dref = doc(db, "clases_detalle", uid, "slots", slotPref);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const det = dsnap.data() || {};
            setUnidad((prev) => prev || det.unidad || "");
            setObjetivo((prev) => prev || det.objetivo || "");
            setHabilidades((prev) =>
              prev ||
              (Array.isArray(det.habilidades)
                ? det.habilidades.join(", ")
                : det.habilidades || "")
            );
            if (det.asignatura && asignatura === "(sin asignatura)")
              setAsignatura(det.asignatura);

            if (curso === "(sin curso)") {
              if (det.curso || det.nivel || det.seccion) {
                setCurso(
                  det.curso ||
                    cursoFromNivelSeccion(det.nivel, det.seccion) ||
                    "(sin curso)"
                );
              } else {
                try {
                  const hcell = await getDoc(
                    doc(db, "horarios", uid, "celdas", slotPref)
                  );
                  if (hcell.exists()) {
                    const hx = hcell.data() || {};
                    if (hx.curso) setCurso(hx.curso);
                    if (hx.asignatura && asignatura === "(sin asignatura)")
                      setAsignatura(hx.asignatura);
                  }
                } catch {}
              }
            }
          } else {
            const uref = doc(db, "usuarios", uid);
            const usnap = await getDoc(uref);
            const cfg = usnap.exists() ? usnap.data()?.horarioConfig || {} : {};
            const marcasArr = getMarcasFromConfig(cfg);
            if (Array.isArray(marcasArr) && marcasArr.length > 1) {
              const fila = filaDesdeMarcas(marcasArr);
              const col = colDeHoy();
              const slotId = `${fila}-${col}`;
              const dref2 = doc(db, "clases_detalle", uid, "slots", slotId);
              const ds2 = await getDoc(dref2);
              if (ds2.exists()) {
                const det2 = ds2.data() || {};
                setUnidad((prev) => prev || det2.unidad || "");
                setObjetivo((prev) => prev || det2.objetivo || "");
                setHabilidades((prev) =>
                  prev ||
                  (Array.isArray(det2.habilidades)
                    ? det2.habilidades.join(", ")
                    : det2.habilidades || "")
                );
                if (det2.asignatura && asignatura === "(sin asignatura)")
                  setAsignatura(det2.asignatura);
                if (curso === "(sin curso)") {
                  setCurso(
                    det2.curso ||
                      cursoFromNivelSeccion(det2.nivel, det2.seccion) ||
                      "(sin curso)"
                  );
                }
              }
            }
          }
        } catch (e) {
          if (e?.code !== "permission-denied")
            console.warn("[Desarrollo] clases_detalle fallback:", e?.code || e);
        }

        // OA + Wikipedia (flujo existente)
        const unidadParaOA = location?.state?.clase?.unidad || unidadInicial || unidad || "";
        const asigForOA = location?.state?.clase?.asignatura || asignatura || "Matemática";
        const cursoForOA = location?.state?.clase?.curso || curso || "";

        if (unidadParaOA) {
          const asigSlug = asigToSlug(asigForOA);
          const nivelApi = nivelToApi(cursoForOA, claseVigente?.nivel || "");

          try {
            const proxyUrl = `${API_BASE}/mineduc?asignatura=${encodeURIComponent(
              asigSlug
            )}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadParaOA)}`;
            const rProxy = await api.get(proxyUrl);
            const firstProxy = Array.isArray(rProxy.data) ? rProxy.data[0] : null;
            if (firstProxy) {
              setOaMinisterio(firstProxy);
            } else {
              throw new Error("Proxy sin resultados, intento directo");
            }
          } catch (e) {
            try {
              const directUrl = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?asignatura=${encodeURIComponent(
                asigSlug
              )}&nivel=${encodeURIComponent(nivelApi)}&unidad=${encodeURIComponent(unidadParaOA)}`;
              const oaResponse = await api.get(directUrl);
              const first = Array.isArray(oaResponse.data) ? oaResponse.data[0] : null;
              setOaMinisterio(first || null);
            } catch (e2) {
              console.warn(
                "[Desarrollo] OA ministerio no disponible (CORS/local):",
                e2?.message || e2
              );
            }
          }

          try {
            // 1) buscamos título por unidad (fallback objetivo)
            const q1 = unidadParaOA;
            let firstTitle = "";
            let lang = "es";

            const wikiSearchEs = await api.get(
              `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
                q1
              )}&format=json&origin=*`
            );

            firstTitle = wikiSearchEs?.data?.query?.search?.[0]?.title || "";
            lang = "es";

            if (!firstTitle && objetivo) {
              const wikiSearchEsObj = await api.get(
                `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
                  objetivo
                )}&format=json&origin=*`
              );
              firstTitle = wikiSearchEsObj?.data?.query?.search?.[0]?.title || "";
              lang = "es";
            }

            if (!firstTitle) {
              const wikiSearchEn = await api.get(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
                  q1
                )}&format=json&origin=*`
              );
              firstTitle = wikiSearchEn?.data?.query?.search?.[0]?.title || "";
              if (firstTitle) lang = "en";
            }

            if (firstTitle) {
              const base = lang === "es" ? "https://es.wikipedia.org" : "https://en.wikipedia.org";
              const full = `${base}/wiki/${encodeURIComponent(firstTitle)}`;
              setWikipediaUrl(full);
              setWikiTitle(firstTitle);
              setWikiLang(lang);

              // 2) SUMMARY limpio (3–4 líneas)
              try {
                const sumUrl = `${base}/api/rest_v1/page/summary/${encodeURIComponent(
                  firstTitle
                )}?origin=*`;
                const sumRes = await api.get(sumUrl);
                const extract = sumRes?.data?.extract || "";
                const thumb = sumRes?.data?.thumbnail?.source || "";
                setWikiSummary(extract);
                setWikiThumb(thumb);
              } catch (sumErr) {
                console.warn("[Desarrollo] Wikipedia summary no disponible:", sumErr?.message || sumErr);
                setWikiSummary("");
                setWikiThumb("");
              }
            }
          } catch (e) {
            console.warn("[Desarrollo] Wikipedia no disponible:", e?.message || e);
          }
        }
      } catch (err) {
        console.error("Error cargando datos de Desarrollo:", err);
      }
    };

    obtenerDatos();
  }, [authed]); // solo cuando ya hay sesión

  /* marcas → clases_detalle */
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const uid = localStorage.getItem("uid") || auth.currentUser?.uid;
        if (!uid) return;

        const stSlot = location?.state?.slotId || slotFromQuery() || null;
        if (stSlot) {
          const dref0 = doc(db, "clases_detalle", uid, "slots", stSlot);
          const ds0 = await getDoc(dref0);
          if (ds0.exists()) {
            const det = ds0.data() || {};
            setUnidad((prev) => prev || det.unidad || "");
            setObjetivo((prev) => prev || det.objetivo || "");
            setHabilidades((prev) =>
              prev ||
              (Array.isArray(det.habilidades)
                ? det.habilidades.join(", ")
                : det.habilidades || "")
            );
            if (det.asignatura && asignatura === "(sin asignatura)")
              setAsignatura(det.asignatura);
            if (curso === "(sin curso)") {
              setCurso(
                det.curso ||
                  cursoFromNivelSeccion(det.nivel, det.seccion) ||
                  "(sin curso)"
              );
            }
            return;
          }
        }

        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        const cfg = usnap.exists() ? usnap.data()?.horarioConfig || {} : {};

        const marcasArr = getMarcasFromConfig(cfg);
        if (Array.isArray(marcasArr) && marcasArr.length > 1) {
          const fila = filaDesdeMarcas(marcasArr);
          const col = colDeHoy();
          const slotId = `${fila}-${col}`;

          const dref = doc(db, "clases_detalle", uid, "slots", slotId);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const det = dsnap.data() || {};
            setUnidad((prev) => prev || det.unidad || "");
            setObjetivo((prev) => prev || det.objetivo || "");
            setHabilidades((prev) =>
              prev ||
              (Array.isArray(det.habilidades)
                ? det.habilidades.join(", ")
                : det.habilidades || "")
            );
            if (det.asignatura && asignatura === "(sin asignatura)")
              setAsignatura(det.asignatura);
            if (curso === "(sin curso)") {
              setCurso(
                det.curso ||
                  cursoFromNivelSeccion(det.nivel, det.seccion) ||
                  "(sin curso)"
              );
            }
          }
        }
      } catch (e) {
        console.warn("[Desarrollo] marcas–clases_detalle:", e?.code || e?.message);
      }
    })();
  }, [authed]); // eslint-disable-line

  // === NUEVO: Wikipedia inmediata cuando se identifica/cambia el OBJETIVO ===
  useEffect(() => {
    const run = async () => {
      const q = (objetivo || "").trim();
      if (!q) return;
      try {
        // Buscar primero en ES, fallback EN
        let firstTitle = "";
        let lang = "es";

        const wikiSearchEs = await api.get(
          `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            q
          )}&format=json&origin=*`
        );

        firstTitle = wikiSearchEs?.data?.query?.search?.[0]?.title || "";

        if (!firstTitle) {
          const wikiSearchEn = await api.get(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              q
            )}&format=json&origin=*`
          );
          firstTitle = wikiSearchEn?.data?.query?.search?.[0]?.title || "";
          if (firstTitle) lang = "en";
        }

        if (!firstTitle) return;

        const base = lang === "es" ? "https://es.wikipedia.org" : "https://en.wikipedia.org";
        const full = `${base}/wiki/${encodeURIComponent(firstTitle)}`;

        setWikipediaUrl(full);
        setWikiTitle(firstTitle);
        setWikiLang(lang);

        // Summary/thumbnail
        try {
          const sumUrl = `${base}/api/rest_v1/page/summary/${encodeURIComponent(
            firstTitle
          )}?origin=*`;
          const sumRes = await api.get(sumUrl);
          const extract = sumRes?.data?.extract || "";
          const thumb = sumRes?.data?.thumbnail?.source || "";
          setWikiSummary(extract);
          setWikiThumb(thumb);
        } catch {
          setWikiSummary("");
          setWikiThumb("");
        }
      } catch (e) {
        // silencioso para no interrumpir clase
      }
    };
    run();
  }, [objetivo]); // <-- en cuanto hay objetivo, se abre Wikipedia relacionada

  // al terminar el cronómetro, ir a cierre
  const handleEnd = () => {
    if (onIrACierre) onIrACierre();
    else navigate("/cierre");
  };

  /* ============================
   * Laboratorio 3D
   * ============================ */
  const [prompt3D, setPrompt3D] = useState("");
  const [glbUrl, setGlbUrl] = useState("");
  const [modelSrc, setModelSrc] = useState(null);
  const modelFileInputRef = useRef(null);

  // referencia para hacer scroll al visor
  const viewerRef = useRef(null);

  // Carga script de <model-viewer> si no existe
  useEffect(() => {
    if (!window.customElements || !window.customElements.get?.("model-viewer")) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
  }, []);

  const openShapE = () => {
    trySetMain(SHAPE_SPACE_URL + (prompt3D ? `?prompt=${encodeURIComponent(prompt3D)}` : ""));
    setPanelMsg(
      "Usa la Space para generar y descargar el GLB; luego pégalo abajo en 'URL GLB' o súbelo."
    );
  };
  const openTripoSR = () => {
    trySetMain(TRIPOSR_SPACE_URL);
    setPanelMsg(
      "Primero genera una imagen (p. ej., en Stable Diffusion) y súbela en la Space para obtener el GLB."
    );
  };

  const handleShowGLB = () => {
    const u = glbUrl.trim();
    if (!u) return alert("Pega una URL .glb/.gltf primero o sube un archivo.");
    setModelSrc(u);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handlePickGLB = () => modelFileInputRef.current?.click();
  const handleGLBChosen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/(\.glb|\.gltf)$/i.test(f.name)) {
      alert("Sube un archivo .glb o .gltf.");
      return;
    }
    const u = URL.createObjectURL(f);
    setModelSrc(u);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      e.target.value = "";
    } catch {}
  };

  // generación vía servidor local (proxy)
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  const generateLocal3D = async () => {
    const p = (prompt3D || "").trim();
    if (!p) return alert("Escribe un prompt 3D primero.");
    setGenLoading(true);
    setGenMsg("Generando modelo…");

    try {
      const r = await fetch(`${API_BASE}/shape/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        body: JSON.stringify({ prompt: p, steps: 32, size: 1.2 }),
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      if (data?.url) {
        setModelSrc(data.url);
        setGlbUrl(data.url);
      } else if (data?.blobBase64) {
        setModelSrc(data.blobBase64);
        setGlbUrl(data.blobBase64);
      } else {
        throw new Error("Respuesta sin URL ni blobBase64");
      }

      setGenMsg("Listo ✓");
      viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.warn(err);
      setGenMsg(
        "No se pudo generar desde el servidor local. Abre Shap-E (botón) o verifica tu proxy en " +
          PROXY_BASE
      );
      alert("Falló la generación local. Revisa el proxy o usa el botón de Shap-E.");
    } finally {
      setGenLoading(false);
      setTimeout(() => setGenMsg(""), 3500);
    }
  };

  /* Escape room */
  const [escapeUrl, setEscapeUrl] = useState("");
  const openEscapeDemo = () => {
    trySetMain(AFRAME_DEMO_URL);
    setPanelMsg(
      "Demo A-Frame. Para una sala propia, pega la URL de tu mundo (FrameVR/Spatial/etc.) y ábrela."
    );
  };
  const openEscapeRoomUrl = () => {
    if (!escapeUrl.trim()) return;
    trySetMain(ensureHttp(escapeUrl.trim()));
  };

  /* ================================
     Visor PDF del Programa
     ================================ */
  const [pdfUrl, setPdfUrl] = useState(() => {
    const fromState = location?.state?.ficha?.programaUrl || "";
    const saved = localStorage.getItem("programaPdfUrl") || "";
    return fromState || saved || "";
  });
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const pdfWrapRef = useRef(null);
  const [pdfWidth, setPdfWidth] = useState(900);

  // NUEVO: modo (flipbook/scroll) + URL resuelta desde mineduc_pdfs
  const [pdfMode, setPdfMode] = useState("flip"); // 'flip' | 'scroll'
  const [resolvedMineducUrl, setResolvedMineducUrl] = useState("");

  // Nivel heurístico (desde ficha, claseVigente o curso)
  const nivelPrefer = (() => {
    const fromState = location?.state?.ficha?.nivel || "";
    const fromVig = claseVigente?.nivel || "";
    if (fromState) return fromState;
    if (fromVig) return fromVig;
    const m = String(curso || "").match(/(\d+)\s*[°º]?\s*(b[aá]sico|medio)/i);
    return m ? `${m[1]}° ${m[2].toLowerCase().replace("basico", "básico")}` : "";
  })();

  // Busca en mineduc_pdfs si no hay URL manual
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (pdfUrl) {
          setResolvedMineducUrl("");
          return;
        }
        if (!nivelPrefer) {
          setResolvedMineducUrl("");
          return;
        }

        const qs = query(collection(db, "mineduc_pdfs"), where("nivel", "==", nivelPrefer));
        const snap = await getDocs(qs);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const hit =
          items.find((x) => x.asignatura === asignatura && x.unidad === unidad) ||
          items.find((x) => x.asignatura === asignatura) ||
          items[0];

        if (!cancelled) setResolvedMineducUrl(hit?.url || "");
      } catch (e) {
        if (!cancelled) setResolvedMineducUrl("");
        console.warn("[ProgramaPDF] mineduc_pdfs lookup:", e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, nivelPrefer, asignatura, unidad]); // eslint-disable-line

  // Ancho responsive para el modo scroll
  useEffect(() => {
    const el = pdfWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.max(320, Math.floor(entries[0].contentRect.width - 24));
      setPdfWidth(Math.min(980, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (location?.state?.ficha?.programaUrl) {
      try {
        localStorage.setItem("programaPdfUrl", location.state.ficha.programaUrl);
      } catch {}
    }
  }, [location?.state?.ficha?.programaUrl]);

  const onPdfLoaded = ({ numPages }) => {
    setPdfPages(numPages || 0);
    setPdfPage(1);
  };
  const goPrev = () => setPdfPage((p) => Math.max(1, p - 1));
  const goNext = () => setPdfPage((p) => Math.min(pdfPages || 1, p + 1));
  const handleSetPdf = () => {
    const u = (pdfUrl || "").trim();
    if (!u) return;
    try {
      localStorage.setItem("programaPdfUrl", u);
    } catch {}
  };

  const finalPdfUrl = pdfUrl || resolvedMineducUrl;

  /* ===============================
     LÓGICA Apps Grid (catálogo)
     =============================== */
  const ALL_APPS = useMemo(
    () =>
      Object.entries(APP_GROUPS).flatMap(([group, apps]) =>
        (apps || []).map((a) => ({ ...a, group }))
      ),
    []
  );

  const [showApps, setShowApps] = useState(true);
  const [appGroupSel, setAppGroupSel] = useState("Todas");
  const [appSearch, setAppSearch] = useState("");

  const groupNames = useMemo(() => ["Todas", ...Object.keys(APP_GROUPS)], []);
  const appsFiltered = useMemo(() => {
    const needle = norm(appSearch);
    return ALL_APPS.filter((a) => {
      const inGroup = appGroupSel === "Todas" || a.group === appGroupSel;
      const inSearch =
        !needle ||
        norm(a.name).includes(needle) ||
        norm(a.id).includes(needle) ||
        norm(a.group).includes(needle);
      return inGroup && inSearch;
    });
  }, [ALL_APPS, appGroupSel, appSearch]);

  const openApp = (app) => {
    const id = String(app.id || "");
    const url = ensureHttp(app.url || "");
    if (app.embed) {
      if (id.startsWith("geogebra")) return trySetMain(toEmbedURL(url, "geogebra"));
      if (id.includes("desmos")) return trySetMain(toEmbedURL(url, "desmos"));
      if (id.includes("youtube")) return trySetMain(toEmbedURL(url, "youtube"));
      const finalUrl = /wikipedia|drive\.google|docs\.google|office|sharepoint|onedrive/.test(url)
        ? toEmbedURL(url, "custom")
        : ensureHttp(url);
      return trySetMain(finalUrl);
    }
    openInNew(url);
  };

  // Estilos resumen Wikipedia
  const wikiIntroWrap = {
    display: "grid",
    gridTemplateColumns: wikiThumb ? "88px 1fr" : "1fr",
    gap: 12,
    alignItems: "start",
  };
  const wikiThumbStyle = {
    width: 88,
    height: 88,
    objectFit: "cover",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: "#f8fafc",
  };
  const clamp4 = {
    display: "-webkit-box",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
  const subtle = { fontSize: 12, color: COLORS.textMuted };

  // ======= Overrides de vista si hay EMERGENCIA activa =======
  const unidadShown = emergency?.active ? (emergency.unidad || unidad) : unidad;
  const objetivoShown = emergency?.active ? (emergency.objetivo || objetivo) : objetivo;
  const habilidadesShown = emergency?.active
    ? (Array.isArray(emergency.habilidades) ? emergency.habilidades.join(", ") : emergency.habilidades || habilidades)
    : habilidades;

  return (
    <div style={page}>
      {/* Banner de Clase de Emergencia (si corresponde) */}
      {emergency?.active && (
        <div
          style={{
            ...card,
            marginBottom: "1rem",
            border: "1px solid #fecaca",
            background: "linear-gradient(90deg, #fee2e2, #ffffff)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background:'#fee2e2', color:'#991b1b', borderRadius:999, padding:'4px 10px', fontWeight:800 }}>
              🔴 Emergencia activa
            </span>
            {emergency?.language && (
              <span style={{ background:'#e0f2fe', color:'#075985', borderRadius:999, padding:'4px 10px', fontWeight:700 }}>
                🌐 {String(emergency.language).toUpperCase()}
              </span>
            )}
            <span style={{ color: COLORS.textDark }}>
              <b>{emergency.unidad || "(sin unidad)"}</b> — {emergency.objetivo || "(sin objetivo)"}
            </span>
          </div>
        </div>
      )}

      {/* ADICIONAL: Banner de clase vigente */}
      {claseVigente && (
        <div
          style={{
            ...card,
            marginBottom: "1rem",
            background:
              claseVigente.fuente === "calendario"
                ? "rgba(124,58,237,.06)"
                : "rgba(2,132,199,.06)",
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
        </div>
      )}

      {/* Fila superior */}
      <div style={{ ...row("1rem"), marginBottom: "1rem" }}>
        {/* IZQUIERDA */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>
            Desarrollo
          </div>
          <div style={{ color: COLORS.textMuted, marginBottom: 8 }}>{horaActual}</div>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
            <CronometroGlobal duracion={duracion} onEnd={handleEnd} />
          </div>
        </div>

        {/* CENTRO */}
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 6 }}>
            Unidad
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>{unidadShown || "(sin unidad)"} </strong>
            {emergency?.active && emergency?.language && (
              <span style={{ marginLeft: 8, background:'#e0f2fe', color:'#075985', borderRadius:999, padding:'2px 8px', fontSize:12 }}>
                🌐 {String(emergency.language).toUpperCase()}
              </span>
            )}
          </div>

          {/* Objetivo y Habilidades */}
          <div style={{ marginBottom: 6 }}>
            <strong>Objetivo:</strong> {objetivoShown || "(sin objetivo)"}
          </div>
          <div>
            <strong>Habilidades:</strong> {habilidadesShown || "(sin habilidades)"}
          </div>

          {oaMinisterio && (
            <div style={{ marginTop: 8, color: COLORS.textDark }}>
              <strong>OA:</strong> {oaMinisterio.descripcion}
            </div>
          )}

          <div style={{ marginTop: 10, color: COLORS.textMuted }}>
            <strong>Curso:</strong> {curso} &nbsp;|&nbsp; <strong>Asignatura:</strong>{" "}
            {asignatura}
          </div>
        </div>

        {/* DERECHA */}
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: ".6rem" }}>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <button style={btnWhite}>‹</button>
            <button style={btnWhite}>👍</button>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800 }}>{nombreProfesor}</div>
            <div style={{ color: COLORS.textMuted }}>{asignatura}</div>
          </div>
        </div>
      </div>

      {/* Bloque de fases de EMERGENCIA (Desarrollo) */}
      {emergency?.active && emergency?.fases?.desarrollo && (
        <div
          style={{
            ...card,
            border: "1px dashed #ef4444",
            background: "#fff",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>🔴 Emergencia — Desarrollo:</strong>
            {emergency?.language && (
              <span style={{ background:'#e0f2fe', color:'#075985', borderRadius:999, padding:'2px 8px', fontSize:12 }}>
                🌐 {String(emergency.language).toUpperCase()}
              </span>
            )}
          </div>
          <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
            {emergency.fases.desarrollo}
          </p>
        </div>
      )}

      {/* Contenido principal */}
      <div style={{ ...card, textAlign: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>🎬 Recurso de apoyo</h3>

        {/* Panel principal */}
        {presentKind === "screen" ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            style={{
              width: "80%",
              height: 420,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: "#000",
              objectFit: "contain",
            }}
          />
        ) : presentKind === "image" && presentBlobUrl ? (
          <img
            src={presentBlobUrl}
            alt="Imagen presentada"
            style={{
              width: "80%",
              height: 420,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: "#000",
              objectFit: "contain",
            }}
          />
        ) : (
          <iframe
            key={mainSrc}
            width="80%"
            height="420"
            src={mainSrc}
            title="Panel principal"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#000" }}
          ></iframe>
        )}

        {panelMsg && <div style={{ marginTop: 8, color: "#b45309" }}>⚠️ {panelMsg}</div>}

        {/* Herramientas rápidas */}
        <div style={toolsWrap}>
          <h4 style={{ margin: "0 0 8px" }}>🧰 Herramientas rápidas</h4>

          <div style={toolsRow}>
            {/* YouTube */}
            <input
              style={inputSmall}
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              placeholder="Buscar o pegar enlace de YouTube… (ej: proporcionalidad o https://youtu.be/ID)"
            />
            <button style={btnTool} onClick={handleOpenYouTube}>
              ▶️ Ver en panel
            </button>

            {/* GeoGebra */}
            <select
              style={selectSmall}
              value={ggTool}
              onChange={(e) => setGgTool(e.target.value)}
              title="Tipo de app GeoGebra"
            >
              <option value="calculator">GeoGebra · Graficadora</option>
              <option value="geometry">GeoGebra · Geometría</option>
              <option value="3d">GeoGebra · 3D</option>
            </select>
            <button style={btnTool} onClick={handleOpenGeoGebra}>
              📐 En panel
            </button>

            {/* Desmos */}
            <button style={btnTool} onClick={handleOpenDesmos}>
              🧮 Desmos en panel
            </button>

            {/* PhET */}
            <button style={btnTool} onClick={handleOpenPhET}>
              🧪 PhET (portal)
            </button>

            {/* Drive (portal) */}
            <button style={btnTool} onClick={handleOpenDrive}>
              📂 Drive
            </button>

            {/* Link personalizado → en panel */}
            <input
              style={{ ...inputSmall, minWidth: 280 }}
              value={customLink}
              onChange={(e) => setCustomLink(e.target.value)}
              placeholder="Pega cualquier enlace (intentaremos mostrarlo aquí)"
            />
            <button style={btnTool} onClick={handleOpenCustom}>
              🔗 Abrir en panel
            </button>
          </div>

          {/* barra de íconos */}
          <div style={iconsRow}>
            {/* Presentar */}
            <button
              style={iconBtn}
              onClick={presentChooser}
              title={sharing ? "Compartiendo… (elige otra opción)" : "Presentar (pantalla o archivo)"}
            >
              <IconPresent />
            </button>

            {/* accesos 3D */}
            <button style={iconBtn} onClick={openShapE} title="Shap-E (texto→3D)">
              <img src={ico("huggingface.co")} alt="Shap-E" style={iconImg} />
            </button>
            <button style={iconBtn} onClick={openTripoSR} title="TripoSR (imagen→3D)">
              <img src={ico("huggingface.co")} alt="TripoSR" style={iconImg} />
            </button>
            <button style={iconBtn} onClick={openEscapeDemo} title="Escape Room (demo A-Frame)">
              <img src={ico("aframe.io")} alt="A-Frame" style={iconImg} />
            </button>
          </div>

          {/* Grid simple de Apps */}
          <div style={appsWrap}>
            <div style={{ ...toolsRow, justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h4 style={{ margin: 0 }}>⚙️ Apps rápidas</h4>
                <button
                  style={{ ...btnTool, padding: ".3rem .6rem" }}
                  onClick={() => setShowApps((v) => !v)}
                  title="Mostrar/Ocultar catálogo"
                >
                  {showApps ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  style={selectSmall}
                  value={appGroupSel}
                  onChange={(e) => setAppGroupSel(e.target.value)}
                  title="Filtrar por categoría"
                >
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <input
                  style={{ ...inputSmall, minWidth: 240 }}
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  placeholder="Buscar app por nombre/categoría…"
                />
              </div>
            </div>

            {showApps && (
              <div style={appsGrid}>
                {appsFiltered.map((app) => {
                  let domain = "example.com";
                  try {
                    domain = new URL(ensureHttp(app.url)).host;
                  } catch {}
                  return (
                    <div
                      key={`${app.group}:${app.id}`}
                      style={appTile}
                      onClick={() => openApp(app)}
                      title={app.embed ? "Abrir dentro del panel" : "Abrir en pestaña nueva"}
                    >
                      <img src={ico(domain)} alt={app.name} style={appIcon} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={appTitle}>{app.name} {app.embed ? "" : "—"}</span>
                        <span style={appGroupLabel}>{app.group}</span>
                      </div>
                    </div>
                  );
                })}
                {appsFiltered.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1/-1",
                      color: COLORS.textMuted,
                      fontStyle: "italic",
                      padding: 6,
                    }}
                  >
                    Sin resultados para ese filtro/búsqueda.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* input de archivo oculto para PDF/imagen (presentación) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFileChosen}
            style={{ display: "none" }}
          />
        </div>
        {/* FIN herramientas rápidas */}
      </div>

      {/* Visor PDF del Programa */}
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, textAlign: "center" }}>📑 Programa de Estudio (PDF)</h3>

        <div style={{ ...toolsRow, marginBottom: 8 }}>
          <input
            style={{ ...inputSmall, minWidth: 420 }}
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            placeholder="Pega aquí la URL del PDF del programa (nivel + asignatura)"
          />
          <button style={btnTool} onClick={handleSetPdf}>
            💾 Guardar enlace
          </button>

          {/* NUEVO: botones de modo + usar mineduc */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{ ...btnTool, opacity: pdfMode === "flip" ? 1 : 0.6 }}
              onClick={() => setPdfMode("flip")}
              title="Ver como Flipbook"
            >
              📖 Flipbook
            </button>
            <button
              style={{ ...btnTool, opacity: pdfMode === "scroll" ? 1 : 0.6 }}
              onClick={() => setPdfMode("scroll")}
              title="Ver en modo paginado/scroll"
            >
              📄 Scroll
            </button>
            {resolvedMineducUrl && !pdfUrl && (
              <button
                style={btnTool}
                onClick={() => setPdfUrl(resolvedMineducUrl)}
                title="Usar URL encontrada en mineduc_pdfs"
              >
                🏷️ Usar MINEDUC
              </button>
            )}
          </div>
        </div>

        {!finalPdfUrl ? (
          <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
            Pega la URL del PDF arriba. Si vienes desde <em>Inicio</em> con ficha, uso automáticamente{" "}
            <code>ficha.programaUrl</code>. Si está vacío, intentamos buscarlo en <code>mineduc_pdfs</code> por tu{" "}
            {nivelPrefer ? `nivel «${nivelPrefer}»` : "nivel"} y asignatura.
          </div>
        ) : pdfMode === "scroll" ? (
          <div
            ref={pdfWrapRef}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <button style={btnTool} onClick={goPrev} disabled={pdfPage <= 1}>
                ◀️ Anterior
              </button>
              <div style={{ fontWeight: 700 }}>
                Página {pdfPage} / {pdfPages || "…"}
              </div>
              <button style={btnTool} onClick={goNext} disabled={!pdfPages || pdfPage >= pdfPages}>
                Siguiente ▶️
              </button>
            </div>

            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              <Document
                file={{ url: finalPdfUrl }}
                onLoadSuccess={onPdfLoaded}
                loading={<div style={{ padding: 12 }}>Cargando PDF…</div>}
              >
                <Page pageNumber={pdfPage} width={pdfWidth} renderAnnotationLayer renderTextLayer />
              </Document>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Document
              file={{ url: finalPdfUrl }}
              onLoadError={(e) => console.error("PDF error:", e)}
              onLoadSuccess={({ numPages }) => setPdfPages(numPages)}
              loading={<div style={{ padding: 12 }}>Cargando PDF…</div>}
            >
              {pdfPages ? (
                <HTMLFlipBook width={800} height={1000} className="shadow-lg">
                  {Array.from({ length: pdfPages }).map((_, i) => (
                    <div key={`pg-${i}`} className="bg-white p-2">
                      <Page
                        pageNumber={i + 1}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={800}
                      />
                    </div>
                  ))}
                </HTMLFlipBook>
              ) : null}
            </Document>
          </div>
        )}
      </div>

      {/* Laboratorio 3D */}
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, textAlign: "center" }}>🧪 Laboratorio 3D</h3>

        <div style={{ ...toolsRow, marginBottom: 6 }}>
          <input
            style={{ ...inputSmall, minWidth: 360 }}
            value={prompt3D}
            onChange={(e) => setPrompt3D(e.target.value)}
            placeholder="Prompt 3D (ej.: 'un prisma triangular low-poly de color azul')"
            onKeyDown={(e) => {
              if (e.key === "Enter") generateLocal3D();
            }}
          />
          <button style={btnTool} onClick={openShapE}>
            🧊 Abrir Shap-E (texto→3D)
          </button>
          <button style={btnTool} onClick={openTripoSR}>
            🖼️ Abrir TripoSR (imagen→3D)
          </button>

          <button
            style={{ ...btnTool, opacity: genLoading ? 0.7 : 1 }}
            onClick={generateLocal3D}
            disabled={genLoading}
            title="Requiere proxy local en PROXY_BASE/shape/generate"
          >
            ✅ Generar (servidor)
          </button>
        </div>

        {genMsg && (
          <div style={{ textAlign: "center", color: "#b45309", marginBottom: 6 }}>{genMsg}</div>
        )}

        <div style={{ ...toolsRow, marginBottom: 10 }}>
          <input
            style={{ ...inputSmall, minWidth: 360 }}
            value={glbUrl}
            onChange={(e) => setGlbUrl(e.target.value)}
            placeholder="URL .glb/.gltf (pégalo aquí para previsualizar)"
          />
          <button style={btnTool} onClick={handleShowGLB}>
            👁️ Ver 3D
          </button>
          <button style={btnTool} onClick={handlePickGLB}>
            ⤴️ Subir GLB
          </button>
          <input
            ref={modelFileInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            onChange={handleGLBChosen}
            style={{ display: "none" }}
          />
        </div>

        <div ref={viewerRef} style={{ display: "flex", justifyContent: "center" }}>
          {modelSrc ? (
            // eslint-disable-next-line react/no-unknown-property
            <model-viewer
              src={modelSrc}
              alt="Modelo 3D"
              camera-controls
              auto-rotate
              exposure="1.1"
              style={{
                width: "100%",
                maxWidth: 720,
                height: 420,
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
              }}
              ar
            ></model-viewer>
          ) : (
            <div style={{ color: COLORS.textMuted, fontStyle: "italic" }}>
              Pega una URL .glb/.gltf o sube un GLB para previsualizarlo aquí.
            </div>
          )}
        </div>
      </div>

      {/* Intro de Wikipedia (3–4 líneas) */}
      {wikipediaUrl && (wikiSummary || wikiTitle) && (
        <div style={{ ...card, marginBottom: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <h3 style={{ margin: 0 }}>📚 Introducción (Wikipedia)</h3>
            <div style={subtle}>
              Relacionado con: <strong>{unidadShown || objetivoShown || "la temática de la clase"}</strong>
            </div>
          </div>

          <div style={wikiIntroWrap}>
            {wikiThumb ? <img src={wikiThumb} alt={wikiTitle || "Wikipedia"} style={wikiThumbStyle} /> : null}
            <div>
              {wikiTitle && (
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  <a
                    href={wikipediaUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: COLORS.textDark, textDecoration: "none" }}
                    title="Abrir artículo"
                  >
                    {wikiTitle} —
                  </a>
                </div>
              )}
              {wikiSummary ? (
                <div style={clamp4}>{wikiSummary}</div>
              ) : (
                <div style={{ color: COLORS.textMuted, fontStyle: "italic" }}>
                  No se pudo obtener el resumen. Puedes abrir el artículo completo abajo.
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ ...subtle, textDecoration: "underline" }}
                >
                  Abrir artículo completo →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Artículo de Wikipedia embebido (directo) */}
      {wikipediaUrl && (
        <div style={{ ...card }}>
          <h3 style={{ marginTop: 0, textAlign: "center" }}>📚 Información complementaria</h3>
          <iframe
            src={wikipediaUrl}
            width="100%"
            height="420"
            title="Contenido Wikipedia"
            style={{ border: `1px solid ${COLORS.border}`, borderRadius: "8px" }}
          ></iframe>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button onClick={() => navigate("/cierre")} style={btnWhite} title="Ir al Cierre">
          ⏭️ Ir al Cierre
        </button>
      </div>
    </div>
  );
}
