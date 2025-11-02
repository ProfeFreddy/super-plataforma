// InicioClase.jsx 
import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "react-qr-code";
import WordCloud from "react-d3-cloud";
import { db } from "../firebase";
import { getClaseVigente, getYearWeek, slotIdFrom } from "../services/PlanificadorService";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";
// ⛔ TEMP: desactivamos para deploy porque Vercel no encuentra este módulo
// import { syncSlotsFromHorario } from "../services/slots";
// (Se removió import FichaClaseSticky porque no se usa en este archivo)
import NubeDePalabras from "../components/NubeDePalabras";

import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// NUEVO: helper de nivel y servicio OA
import { nivelDesdeCurso } from "../lib/niveles";
import { getPrimerOA } from "../services/curriculoService";

// ✅ NUEVO: Cronómetro global reutilizable
import CronometroGlobal from "../components/CronometroGlobal";

/* =========================================================
   NUEVO: helpers comunes para navegación "segura"
   (mismos conceptos que en HorarioEditable)
   ========================================================= */

// limpia contadores viejos cuando sales de la clase
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
const ORIGIN = window.location.origin || "https://www.pragmaprofe.com";
const BASE = `${ORIGIN}/#/participa`;
const urlQR = `${BASE}?code=${salaCode}&slot=${slotId}&yw=${yearWeek}`;


// posibles rutas reales del tablero del profe
const INICIO_CLASE_CANDIDATES = [
  "/InicioClase",
  "/inicioClase",
  "/inicioclase",
  "/Inicioclase",
  "/inicio", // por si lo montaste como /inicio
];

// decide a dónde volver cuando decimos "Volver al Inicio"
function getInicioClasePath() {
  try {
    const ls = localStorage.getItem("inicioClasePath");
    const win = (typeof window !== "undefined" && window.__INICIO_CLASE_PATH) || null;
    return (ls && String(ls)) || (win && String(win)) || INICIO_CLASE_CANDIDATES[0];
  } catch {
    return INICIO_CLASE_CANDIDATES[0];
  }
}

/* === NUEVO: helper de URL consistente (HashRouter/BrowserRouter) === */
function makeUrl(path) {
  // normaliza
  const p = path.startsWith("/") ? path : `/${path}`;
  const hostOverride = localStorage.getItem("hostOverride"); // ej: http://IP:5174
  const base =
    hostOverride && /^https?:\/\/.*/.test(hostOverride)
      ? hostOverride.replace(/\/+$/, "")
      : window.location.origin;

  // detecta si estamos usando hash (#/ruta) mirando la URL actual
  const useHash =
    typeof window !== "undefined" &&
    (window.location.hash?.startsWith("#/") || window.location.href.includes("/#/"));

  return useHash ? `${base}/#${p}` : `${base}${p}`;
}

// Guard liviano: asegura user (anónimo si hace falta) y evita redirigir a /login
function useAuthReadyLight() {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) {
          // crea sesión anónima y continúa
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUser(cred.user ?? null);
        } else {
          setUser(u);
        }
      } catch {
        // incluso si falla, no redirigimos: dejamos entrar en modo offline
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    });
    return () => { alive = false; unsub && unsub(); };
  }, []);

  return { ready, user, isAnon: !!user?.isAnonymous };
}

/* =========================================================
   helpers originales
   ========================================================= */

// ====== helpers de countdown por SLOT ======
function makeCountKey(slotId = "0-0") {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek(); // p.ej. "2025-39"
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
}

// === DEBUG DE TIEMPO
const FORCE_TEST_TIME = false;
const TEST_DATETIME_ISO = "2025-08-11T08:10:00"; // Lunes 11-08-2025 08:10
function getNowForSchedule() {
  return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date();
}

/* Fallback seguro para el contexto (sin hooks) */
const PLAN_DEFAULTS = {
  user: null,
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: false,
};

// ====== estilos
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
const btnTiny = {
  ...btnWhite,
  padding: ".35rem .6rem",
  fontWeight: 600,
  boxShadow: "none",
  border: `1px solid ${COLORS.border}`,
};

// ====== cronómetro ======
const COUNT_KEY = "inicioClase_countdown_end";
const getRemaining = (endMs) => {
  const diff = Math.max(0, endMs - Date.now());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { m, s, finished: diff === 0 };
};
const formatMMSS = (m, s) =>
  `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

// ------------------------------------------------------------
// MODO PRUEBA: forzar hora/día vía query (?at=HH:MM&dow=1..5)
// ------------------------------------------------------------
function nowFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  const at = q.get("at");
  if (!at) return new Date();
  const [hh, mm] = at.split(":").map(Number);
  const d = new Date();
  d.setHours(hh);
  d.setMinutes(mm);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}
function dowFromQuery() {
  const q = new URLSearchParams(window.location.search || "");
  const v = Number(q.get("dow"));
  return v >= 1 && v <= 5 ? v : null;
}

/* NUEVO: permitir forzar slot vía query (?slot=fila-col) */
function slotFromQuery() {
  try {
    const q = new URLSearchParams(window.location.search || "");
    const s = q.get("slot");
    if (!s) return null;
    const [f, c] = s.split("-").map((n) => Number(n));
    if (Number.isInteger(f) && Number.isInteger(c)) return `${f}-${c}`;
  } catch {}
  return null;
}

// Reconstruye la matriz de horario desde rutas nuevas/legacy, con fallback
async function readHorarioMatrix(uid) {
  try {
    const hRef = doc(db, "horarios", uid);
    const hSnap = await getDoc(hRef);
    if (hSnap.exists() && Array.isArray(hSnap.data()?.horario)) {
      return hSnap.data().horario;
    }
  } catch (e) {
    console.debug("[horarios] fallback -> usuarios", e?.code);
  }
  try {
    const uRef = doc(db, "usuarios", uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) return null;
    const u = uSnap.data();
    if (u.horarioMatriz) {
      const keys = Object.keys(u.horarioMatriz).sort(
        (a, b) => Number(a.replace("f", "")) - Number(b.replace("f", ""))
      );
      return keys.map((k) => u.horarioMatriz[k]);
    }
    if (Array.isArray(u.horarioSlots)) {
      const rows = u.horarioConfig?.bloquesGenerados?.length ?? 16;
      const cols = 5;
      const matrix = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
          asignatura: "",
          nivel: "",
          seccion: "",
          unidad: "",
          objetivo: "",
          habilidades: "",
        }))
      );
      u.horarioSlots.forEach((s) => {
        if (s?.fila != null && s?.col != null) {
          matrix[s.fila][s.col] = {
            asignatura: s.asignatura ?? "",
            nivel: s.nivel ?? "",
            seccion: s.seccion ?? "",
            unidad: s.unidad ?? "",
            objetivo: s.objetivo ?? "",
            habilidades: Array.isArray(s.habilidades)
              ? s.habilidades.join(", ")
              : (s.habilidades ?? ""),
          };
        }
      });
      return matrix;
    }
  } catch (e) {
    console.debug("[usuarios] read error:", e?.code);
  }
  return null;
}

// helpers para calcular el slot actual usando horarioConfig.marcas
const colDeHoy = () => {
  const qDow = dowFromQuery();
  const d =
    qDow != null ? qDow : (FORCE_TEST_TIME ? getNowForSchedule().getDay() : new Date().getDay());
  return d >= 1 && d <= 5 ? d - 1 : 0; // 0..4 = L..V
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

/* NUEVO HELPER: acepta varios formatos de horarioConfig */
function getMarcasFromConfig(cfg = {}) {
  // a) array de [h,m]
  if (Array.isArray(cfg.marcas) && Array.isArray(cfg.marcas[0])) return cfg.marcas;

  // b) array de maps {h,m}
  if (Array.isArray(cfg.marcas) && cfg.marcas.length && typeof cfg.marcas[0] === "object") {
    return cfg.marcas.map((x) => [Number(x.h) || 0, Number(x.m) || 0]);
  }

  // c) marcasStr: ["08:00", ...]
  if (Array.isArray(cfg.marcasStr)) {
    return cfg.marcasStr.map((s) => {
      const [h, m] = String(s).split(":").map((n) => Number(n) || 0);
      return [h, m];
    });
  }

  // d) bloquesGenerados: ["08:00 - 08:45", ...]
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

// ========= sala/código para la nube de palabras =========
const randCode = () => String(Math.floor(10000 + Math.random() * 90000)); // 5 dígitos

// ========= helpers de fiabilidad del cloud =========
function supportsSvgTextBBox() {
  try {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    const t = document.createElementNS(NS, "text");
    t.textContent = "m";
    svg.appendChild(t);
    document.body.appendChild(svg);
    const bbox = t.getBBox();
    document.body.removeChild(svg);
    return Number.isFinite(bbox?.width) && bbox.width > 0;
  } catch {
    return false;
  }
}
const isProblematicUA = () => /OPR|Opera Mini|Opera/i.test(navigator.userAgent);

// Error boundary para capturar fallos del WordCloud y caer a HTML
class CloudBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    try {
      localStorage.setItem("cloudMode", "html");
    } catch {}
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error("[WordCloud SVG] error:", err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ErrorBoundary global para evitar pantallas en blanco
class GlobalBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("[InicioClase] render error:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f8fafc",
            fontFamily: "Segoe UI, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 720,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.05)",
              padding: "20px",
            }}
          >
            <h3 style={{ margin: "0 0 8px" }}>Se produjo un error al dibujar la pantalla</h3>
            <div style={{ color: "#475569", marginBottom: 12 }}>
              Prueba con los modos de diagnóstico:
            </div>
            <code
              style={{
                display: "block",
                background: "#0f172a",
                color: "#e2e8f0",
                padding: "10px",
                borderRadius: 8,
                overflowX: "auto",
              }}
            >
              {window.location.origin}/inicio?safe=1&bypass=1{"\n"}
              {window.location.origin}/inicio?nocloud=1&bypass=1
            </code>
            <div style={{ marginTop: 12, color: "#475569" }}>
              Detalle: {String(this.state.err?.message || this.state.err) || "(sin mensaje)"}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Componente fallback HTML/canvas (nube de palabras)
function HtmlCloud({ data, palette, fontSize }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        padding: "6px 2px",
      }}
    >
      {data.map((w, i) => (
        <span
          key={w.key || `${w.text}_${i}`}
          style={{
            fontWeight: 800,
            fontSize: fontSize(w),
            lineHeight: 1.05,
            color: palette[i % palette.length],
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
          title={`${w.text} ×${w.value}`}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}

/* CanvasCloud */
function CanvasCloud({ data, palette, width, height, fontSize }) {
  const ref = useRef(null);

  // FIX: define un 'authed' local
  const authed = !!(auth.currentUser?.uid || localStorage.getItem("uid"));

  // ⛔ TEMP: desactivamos esta sync automática para que Vercel pueda build-ear
  // useEffect(() => {
  //   if (!authed) return;
  //   const uid = auth.currentUser?.uid || localStorage.getItem("uid");
  //   if (!uid) return;
  //   if (window.__slotsSyncedForUid === uid) return;
  //
  //   (async () => {
  //     try {
  //       await syncSlotsFromHorario(uid, { overwrite: false });
  //       window.__slotsSyncedForUid = uid;
  //       console.log("slots sincronizados desde el horario");
  //     } catch (e) {
  //       console.warn("syncSlotsFromHorario error:", e);
  //     }
  //   })();
  // }, [authed]);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.floor(width * dpr);
    cvs.height = Math.floor(height * dpr);
    cvs.style.width = `${width}px`;
    cvs.style.height = `${height}px`;

    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // ordenar de mayor a menor
    const words = [...data].sort((a, b) => fontSize(b) - fontSize(a));

    const centerX = width / 2;
    const centerY = height / 2;
    const placed = [];
    const padding = 4;

    // espiral aritmética
    const a = 0;
    const b = 6;
    const step = 0.35;

    const collides = (r1, r2) =>
      !(
        r2.x > r1.x + r1.w ||
        r2.x + r2.w < r1.x ||
        r2.y > r1.y + r1.h ||
        r2.y + r2.h < r1.y
      );

    words.forEach((w, idx) => {
      const size = Math.max(12, Math.floor(fontSize(w)));
      const text = String(w.text || "");
      const color = palette[idx % palette.length];

      let t = 0;
      let found = false;
      let px = centerX,
        py = centerY;
      let rect;

      for (let tries = 0; tries < 2000; tries++) {
        const r = a + b * t;
        px = centerX + r * Math.cos(t);
        py = centerY + r * Math.sin(t);

        const metricsCtx = ctx;
        metricsCtx.font = `bold ${size}px Segoe UI, sans-serif`;
        metricsCtx.textBaseline = "middle";
        metricsCtx.textAlign = "center";

        const metrics = metricsCtx.measureText(text);
        const tw = metrics.width;
        const th = size * 0.9;
        rect = {
          x: px - tw / 2 - padding,
          y: py - th / 2 - padding,
          w: tw + 2 * padding,
          h: th + 2 * padding,
        };

        if (placed.every((p) => !collides(p, rect))) {
          found = true;
          break;
        }
        t += step;
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(text, px, py);
      ctx.globalAlpha = 1;

      if (found) placed.push(rect);
    });
  }, [data, palette, width, height, fontSize]);

  return <canvas ref={ref} style={{ display: "block", width, height }} />;
}

/* Overlay de debug */
function ICDebugBadge({ show, data }) {
  if (!show) return null;

  // 🚑 FIX CRASH: conversión segura para no gatillar "Cannot convert object to primitive value"
  const safeVal = (val) => {
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    ) {
      return String(val);
    }
    if (val === null || val === undefined) return "";
    try {
      return JSON.stringify(val);
    } catch {
      return "[obj]";}
  };

  const row = (k, v) => (
    <div
      key={k}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        borderBottom: "1px solid rgba(255,255,255,.12)",
        paddingBottom: 4,
      }}
    >
      <span style={{ opacity: 0.75 }}>{k}</span>
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          background: "#064e3b",
          color: "#d1fae5",
          padding: "2px 4px",
          borderRadius: 4,
          maxWidth: "100%",
          overflowX: "auto",
        }}
      >
        {safeVal(v)}
      </pre>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9999,
        background: "#052e16",
        color: "#d1fae5",
        padding: "10px 12px",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        width: 260,
        maxHeight: 240,
        overflowY: "auto",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>InicioClase — debug</div>
      <div style={{ display: "grid", gap: 6 }}>
        {Object.entries(data).map(([k, v]) => row(k, v))}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   NUEVO: helper para nube “tipo Mentimeter”
   (normaliza/agrupa por palabra, case-insensitive)
─────────────────────────────────────────────── */
function buildCloud(items = []) {
  const map = new Map();
  for (const r of items) {
    const k = String(r?.text || r?.texto || "").trim();
    if (!k) continue;
    const key = k.toLowerCase(); // une “Triángulo” y “triángulo” (solo case)
    const v = Number(r?.value ?? r?.count ?? 1);
    map.set(key, (map.get(key) || 0) + (isFinite(v) ? v : 1));
  }
  return Array.from(map, ([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 120);
}

function InicioClase() {
  const navigate = useNavigate();
  const location = useLocation();
  // al inicio de function InicioClase()
  const { ready: authReady, user: authUser, isAnon: isAnonLight } = useAuthReadyLight();

  // ✅ NUEVO: guardamos si es sesión anónima o real
  const [isAnon, setIsAnon] = useState(false);

  // ✅ NUEVO: banner de pago recibido y limpieza de ?paid=1
  const [paidOk, setPaidOk] = useState(false);
  useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search || "");
      if (qs.get("paid") === "1") {
        setPaidOk(true);
        // Limpia la query para que no se repita al refrescar
        navigate(location.pathname, { replace: true });
      }
    } catch {}
  }, [location, navigate]);

  // flags por query
  const __qs = new URLSearchParams(window.location.search || "");
  const SAFE_MODE = __qs.get("safe") === "1";
  const DISABLE_CLOUD = __qs.get("nocloud") === "1";
  const DEBUG_ON = __qs.get("debug") === "1";
  const BYPASS_NAV = __qs.get("bypass") === "1"; // ⬅️ NUEVO: no navegar auto
  const LEGACY_CLOUD = __qs.get("legacycloud") === "1"; // ⬅️ NUEVO: compara render anterior
  try {
    console.log("[InicioClase] flags", { SAFE_MODE, DISABLE_CLOUD, BYPASS_NAV, LEGACY_CLOUD });
  } catch {}

  /* Uso del contexto con fallback */
  const {
    user = PLAN_DEFAULTS.user,
    plan = PLAN_DEFAULTS.plan,
    caps = PLAN_DEFAULTS.caps,
    loading = PLAN_DEFAULTS.loading,
  } = useContext(PlanContext) || PLAN_DEFAULTS;

  const [currentSlotId, setCurrentSlotId] = useState("0-0");
  const [authed, setAuthed] = useState(false);
  const [nombre, setNombre] = useState("Profesor");

  // NUEVO: slogan configurable (por defecto)
  const DEFAULT_SLOGAN = "De un profe para los profes";
  const [slogan, setSlogan] = useState(DEFAULT_SLOGAN);

  const [asignaturaProfe, setAsignaturaProfe] = useState("");
  const [horaActual, setHoraActual] = useState("");
  const [claseActual, setClaseActual] = useState(null);
  const [planSug, setPlanSug] = useState(null);
  const [preguntaClase, setPreguntaClase] = useState(
    "¿Qué palabra representa mejor la última clase?"
  );
  const [ultimos, setUltimos] = useState([]);

  // ✅ ASISTENCIA
  const [presentes, setPresentes] = useState([]); // [{id, numeroLista, ts}]

  // clase vigente según plan semanal
  const [claseVigente, setClaseVigente] = useState(null);

  // Sala / Código y URL para estudiantes
  const [salaCode, setSalaCode] = useState(localStorage.getItem("salaCode") || "");
  const [participaURL, setParticipaURL] = useState("");

  // Para mantener tu bloque opcional más abajo:
  const [palabras, setPalabras] = useState([]);

  // === modo de render del cloud ===
  const [cloudMode, setCloudMode] = useState("auto");

  // === Currículo (OA + Habilidades)
  const [curriculo, setCurriculo] = useState(null);
  const [cargandoCurriculo, setCargandoCurriculo] = useState(true);

  // login anónimo permitido
  const ALLOW_ANON = true;

  // ✅ NUEVO: guard para no disparar navegación doble
  const [chronoDone, setChronoDone] = useState(false);

  // tomar slot forzado o recordado apenas monta
  useEffect(() => {
    const s = slotFromQuery() || localStorage.getItem("__lastSlotId");
    if (s) setCurrentSlotId(s);
  }, []);

  // === Auth al montar (ARREGLADO) ===
  useEffect(() => {
    // este ref evita hacer signInAnonymously más de una vez y pisar sesiones reales
    let didTryAnon = false;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // tenemos usuario firebase (puede ser real con email o anon)
        setAuthed(true);
        setIsAnon(!!u.isAnonymous);

        const stored = localStorage.getItem("uid");
        if (stored !== u.uid) {
          localStorage.setItem("uid", u.uid);
        }
        return;
      }

      // si llegamos aquí, no hay usuario todavía
      // sólo intentamos crear anónimo si está permitido Y aún no intentamos
      if (ALLOW_ANON && !didTryAnon) {
        didTryAnon = true;
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anon sign-in:", e);
        }
      }
    });

    return () => unsub();
  }, []);

  // si vengo de postLogin(), priorizo lo que trae en state
  useEffect(() => {
    const st = location?.state || null;
    if (!st) return;

    try {
      const prof = st.profesor || {};
      if (prof?.nombre) setNombre(prof.nombre);
      if (prof?.slogan) setSlogan(String(prof.slogan).trim() || DEFAULT_SLOGAN);

      const cls = st.clase || null;
      if (cls) {
        setClaseActual((prev) => ({
          ...(prev || {}),
          unidad: cls.unidad ?? prev?.unidad ?? "(sin unidad)",
          objetivo: cls.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
          habilidades:
            cls.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
          asignatura:
            cls.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
        }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // leer clase vigente
  useEffect(() => {
    (async () => {
      try {
        const res = await getClaseVigente(new Date());
        setClaseVigente(res);
        if (res && (res.unidad || res.objetivo || res.habilidades)) {
          setClaseActual((prev) => ({
            ...(prev || {}),
            unidad: res.unidad ?? prev?.unidad ?? "(sin unidad)",
            objetivo: res.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
            habilidades:
              res.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
            asignatura:
              res.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
          }));
        }
      } catch (e) {
        console.error("[Inicio] getClaseVigente:", e);
      }
    })();
  }, [asignaturaProfe]);

  // Cargar currículo (OA + Habilidades)
  useEffect(() => {
    let stop = false;
    async function run() {
      try {
        setCargandoCurriculo(true);
        setCurriculo(null);

        const cod = claseVigente?.codUnidad || null;
        if (!cod) {
          setCargandoCurriculo(false);
          return;
        }
        const ref = doc(db, "curriculo", cod);
        const snap = await getDoc(ref);
        if (!stop) {
          if (snap.exists()) setCurriculo(snap.data());
          setCargandoCurriculo(false);
        }
      } catch (e) {
        console.warn("[curriculo] read:", e?.code || e?.message);
        if (!stop) setCargandoCurriculo(false);
      }
    }
    run();
    return () => {
      stop = true;
    };
  }, [claseVigente]);

  // reloj de hora actual
  useEffect(() => {
    setHoraActual(new Date().toLocaleTimeString());
    const id = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // =========================
  // CRONÓMETRO CORREGIDO
  // =========================
  const [remaining, setRemaining] = useState({ m: 10, s: 0 });

  // controla el countdown por SLOT (con reset si expiró)
  useEffect(() => {
    if (!currentSlotId) return;

    const key = makeCountKey(currentSlotId);
    // intenta leer el fin desde el key por-slot o desde el key legacy
    let endStr = localStorage.getItem(key) || localStorage.getItem(COUNT_KEY);

    // ⬅️ Reset automático si no hay fin o ya expiró
    if (!endStr || Number(endStr) < Date.now()) {
      const endTime = Date.now() + 10 * 60 * 1000; // 10 min
      localStorage.setItem(key, String(endTime));
      localStorage.setItem(COUNT_KEY, String(endTime)); // compatibilidad atrás
      endStr = String(endTime);
    }

    const endMs = Number(endStr);
    const tick = () => setRemaining(getRemaining(endMs));

    tick(); // primer cálculo inmediato
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentSlotId]);

  // Reinicio manual a 10:00
  const resetCountdown = () => {
    const endTime = Date.now() + 10 * 60 * 1000;
    const key = makeCountKey(currentSlotId || "0-0");
    localStorage.setItem(key, String(endTime));
    localStorage.setItem(COUNT_KEY, String(endTime));
    setRemaining(getRemaining(endTime));
  };

  // helper para construir la ficha a enviar a Desarrollo
  const makeFicha = () => {
    const habilidadesTxt =
      Array.isArray(claseActual?.habilidades)
        ? claseActual.habilidades.join("; ")
        : (claseActual?.habilidades ?? "");
    return {
      asignatura: claseActual?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
      unidad: claseActual?.unidad ?? "(sin unidad)",
      objetivo: claseActual?.objetivo ?? "(sin objetivo)",
      habilidades: habilidadesTxt ?? "(sin habilidades)",
      // contexto extra que ayuda en Desarrollo
      nivel: claseActual?.nivel ?? "",
      seccion: claseActual?.seccion ?? "",
      bloque: claseActual?.bloque ?? "",
      dia: claseActual?.dia ?? "",
      codUnidad: claseVigente?.codUnidad ?? planSug?.codUnidad ?? "",
      programaUrl: planSug?.programaUrl ?? "",
      fuentes: Array.isArray(planSug?.fuentes) ? planSug.fuentes : [],
      planId: planSug?.planId ?? "",
      updatedAt: Date.now(),
    };
  };

  // cuando termina el countdown, navega a /desarrollo (salvo bypass)
  useEffect(() => {
    if (BYPASS_NAV) return; // ⬅️ NUEVO: no navegar en modo prueba
    if (!chronoDone && remaining.m === 0 && remaining.s === 0) {
      setChronoDone(true);
      const key = makeCountKey(currentSlotId || "0-0");
      const endStr =
        localStorage.getItem(key) || localStorage.getItem(COUNT_KEY) || String(Date.now());
      const endMs = Number(endStr);
      try {
        localStorage.setItem("__lastSlotId", currentSlotId || "0-0");
      } catch {}
      const ficha = makeFicha();
      navigate("/desarrollo", {
        state: {
          slotId: currentSlotId || "0-0",
          endMs,
          clase: claseActual || null,
          ficha,
        },
      });
    }
  }, [remaining, navigate, currentSlotId, claseActual, chronoDone, BYPASS_NAV]);

  // crear/asegurar sala + armar URL QR (USANDO makeUrl)
  useEffect(() => {
    (async () => {
      let code = salaCode;
      if (!code) {
        code = randCode();
        localStorage.setItem("salaCode", code);
        setSalaCode(code);
      }
      try {
        await setDoc(
          doc(db, "salas", code),
          { activa: true, createdAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn("[sala] setDoc:", e?.code || e?.message);
      }

      // URL alumno final en el QR
      const studentURL = code ? makeUrl(`/sala/${code}`) : makeUrl("/participa");
      setParticipaURL(studentURL);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // volver a asegurar sala cuando ya hay sesión (USANDO makeUrl)
  useEffect(() => {
    if (!authed) return;
    if (window.__salaInitDone) return;
    (async () => {
      try {
        let code = salaCode || localStorage.getItem("salaCode");
        if (!code) {
          code = randCode();
          localStorage.setItem("salaCode", code);
          setSalaCode(code);
        }

        await setDoc(
          doc(db, "salas", code),
          { activa: true, createdAt: serverTimestamp() },
          { merge: true }
        );

        const studentURL = code ? makeUrl(`/sala/${code}`) : makeUrl("/participa");
        setParticipaURL(studentURL);

        window.__salaInitDone = true;
      } catch (e) {
        console.warn("[sala][authed] setDoc:", e?.code || e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, salaCode]);

  // nombre profe + pregunta + slogan
  useEffect(() => {
    if (!authed) return;
    (async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (uid) {
        try {
          // Preferencia: usuarios/{uid}
          const uref = doc(db, "usuarios", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const u = usnap.data();
            if (u?.nombre) setNombre(u.nombre);
            if (u?.asignatura) setAsignaturaProfe(u.asignatura);
            if (u?.slogan) setSlogan(String(u.slogan).trim() || DEFAULT_SLOGAN);
          }
        } catch (e) {
          console.warn("[usuarios] read nombre/slogan:", e?.code);
        }
        try {
          // Fallback: profesores/{uid}
          const pref = doc(db, "profesores", uid);
          const psnap = await getDoc(pref);
          if (psnap.exists()) {
            const p = psnap.data() || {};
            if (p?.slogan && (!slogan || slogan === DEFAULT_SLOGAN)) {
              setSlogan(String(p.slogan).trim() || DEFAULT_SLOGAN);
            }
          }
        } catch (e) {
          console.warn("[profesores] read slogan:", e?.code);
        }
      }
      try {
        const pref = doc(db, "preguntaClase", "actual");
        const psnap = await getDoc(pref);
        if (psnap.exists() && psnap.data()?.texto)
          setPreguntaClase(psnap.data().texto);
      } catch (e) {
        console.warn("[preguntaClase] read:", e?.code);
      }
    })();
  }, [authed]); // ← incluye slogan

  // fallback profesores/usuarios
  useEffect(() => {
    if (!authed) return;

    const pick = (...vals) => {
      for (const v of vals) {
        const s = (v ?? "").toString().trim();
        if (s && !/^\(sin/i.test(s)) return s;
      }
      return vals.find(Boolean) || "";
    };
    const normHabs = (x) => (Array.isArray(x) ? x.join(", ") : (x ?? ""));

    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid) return;

        // 1) profesores/{uid}
        try {
          const pref = doc(db, "profesores", uid);
          const psnap = await getDoc(pref);
          if (psnap.exists()) {
            const p = psnap.data() || {};
            setClaseActual((prev) => ({
              ...(prev || {}),
              unidad: pick(prev?.unidad, p.unidad, p.unidadInicial, "(sin unidad)"),
              objetivo: pick(prev?.objetivo, p.objetivo, p.objetivoInicial, "(sin objetivo)"),
              habilidades: pick(prev?.habilidades, normHabs(p.habilidades), "(sin habilidades)"),
              asignatura: pick(prev?.asignatura, asignaturaProfe, p.asignatura, "(sin asignatura)"),
              curso: pick(prev?.curso, p.curso, "(sin curso)"),
            }));
          }
        } catch (e) {
          console.warn("[Inicio] profesores read:", e?.code || e);
        }

        // 2) usuarios/{uid}
        try {
          const uref = doc(db, "usuarios", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const u = usnap.data() || {};
            setClaseActual((prev) => ({
              ...(prev || {}),
              unidad:
                (prev?.unidad && !/^\(sin/i.test(prev?.unidad))
                  ? prev?.unidad
                  : (u.unidadInicial ?? u.unidad ?? "(sin unidad)"),
              objetivo:
                (prev?.objetivo && !/^\(sin/i.test(prev?.objetivo))
                  ? prev?.objetivo
                  : (u.objetivo ?? "(sin objetivo)"),
              habilidades:
                (prev?.habilidades && !/^\(sin/i.test(prev?.habilidades))
                  ? prev?.habilidades
                  : (normHabs(u.habilidades) || "(sin habilidades)"),
              asignatura: pick(prev?.asignatura, asignaturaProfe, u.asignatura, "(sin asignatura)"),
              curso: pick(prev?.curso, u.curso, "(sin curso)"),
            }));
          }
        } catch (e) {
          console.warn("[Inicio] usuarios fallback:", e?.code || e);
        }
      } catch {}
    })();
  }, [authed, asignaturaProfe]);

  // leer clases_detalle según horarioConfig.marcas
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid) return;

        // prioridad: slot por query (?slot=f-c)
        const sQ = slotFromQuery();
        if (sQ) {
          setCurrentSlotId(sQ);
          try {
            localStorage.setItem("__lastSlotId", sQ);
          } catch {}
          const drefQ = doc(db, "clases_detalle", uid, "slots", sQ);
          const dsQ = await getDoc(drefQ);
          if (dsQ.exists()) {
            const det = dsQ.data();
            setClaseActual((prev) => ({
              ...(prev || {}),
              unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)",
              objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
              habilidades: det.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
              asignatura: det.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
            }));
          } else {
            // Fallback: leer celda del horario y sembrar detalle si falta
            try {
              const hcell = await getDoc(doc(db, "horarios", uid, "celdas", sQ));
              if (hcell.exists()) {
                const hx = hcell.data() || {};
                const payload = {
                  asignatura: hx.asignatura ?? "",
                  nivel: hx.nivel ?? "",
                  seccion: hx.seccion ?? "",
                  unidad: hx.unidad ?? "",
                  objetivo: hx.objetivo ?? "",
                  habilidades: Array.isArray(hx.habilidades)
                    ? hx.habilidades.join(", ")
                    : (hx.habilidades ?? ""),
                  updatedAt: serverTimestamp(),
                };
                if (payload.unidad || payload.objetivo || payload.habilidades) {
                  await setDoc(drefQ, payload, { merge: true });
                  setClaseActual((prev) => ({ ...(prev || {}), ...payload }));
                }
              }
            } catch {}
          }
          return; // si forcé slot, corto acá
        }

        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        const cfg = usnap.exists() ? usnap.data().horarioConfig || {} : {};
        const marcasArr = getMarcasFromConfig(cfg);
        if (marcasArr.length > 1) {
          const fila = filaDesdeMarcas(marcasArr);
          const col = colDeHoy();
          const slotId = `${fila}-${col}`;
          setCurrentSlotId(slotId);
          try {
            localStorage.setItem("__lastSlotId", slotId);
          } catch {}
          const dref = doc(db, "clases_detalle", uid, "slots", slotId);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const det = dsnap.data();
            setClaseActual((prev) => ({
              ...(prev || {}),
              unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)",
              objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
              habilidades: det.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
              asignatura: det.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
            }));
          } else {
            // intentar leer la celda del horario
            try {
              const hcell = await getDoc(doc(db, "horarios", uid, "celdas", slotId));
              if (hcell.exists()) {
                const hx = hcell.data() || {};
                setClaseActual((prev) => ({
                  ...(prev || {}),
                  asignatura: hx.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
                  unidad: hx.unidad ?? prev?.unidad ?? "(sin unidad)",
                  objetivo: hx.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
                  habilidades:
                    (Array.isArray(hx.habilidades)
                      ? hx.habilidades.join(", ")
                      : (hx.habilidades ?? "")) ||
                    prev?.habilidades ||
                    "(sin habilidades)",
                }));
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[horarioConfig.marcas → clases_detalle]", e?.code || e?.message);
      }
    })();
  }, [authed, asignaturaProfe]);

  // clase actual + planificación sugerida
  useEffect(() => {
    if (!authed) return;
    (async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (!uid) return;

      const matriz = await readHorarioMatrix(uid);
      if (!matriz) return;

      // Fallbacks (mantengo los tuyos + nocturnos)
      const bloques = [
        "08:00 - 08:45",
        "08:45 - 09:30",
        "09:30 - 09:50 (Recreo)",
        "09:50 - 10:35",
        "10:35 - 11:20",
        "11:20 - 11:30 (Recreo)",
        "11:30 - 12:15",
        "12:15 - 13:00",
        "13:00 - 13:45 (Almuerzo)",
        "13:45 - 14:30",
        "14:30 - 15:15",
        "15:15 - 15:30 (Recreo)",
        "15:30 - 16:15",
        "16:15 - 17:00",
        "17:00 - 17:45",
        "17:45 - 18:30",
        // nocturnos extra
        "19:15 - 20:00",
        "20:00 - 20:45",
        "20:45 - 21:00",
      ];
      const diasCorrectos = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

      // intentar usar marcas desde horarioConfig; si no, fallback + nocturnos
      let marcas = [
        [8, 0],
        [8, 45],
        [9, 30],
        [9, 50],
        [10, 35],
        [11, 20],
        [11, 30],
        [12, 15],
        [13, 45],
        [14, 30],
        [15, 15],
        [15, 30],
        [16, 15],
        [17, 0],
        [17, 45],
        [18, 30],
        [19, 15],
        [20, 0],
        [20, 45],
        [21, 0],
      ];
      try {
        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        const cfg = usnap.exists() ? usnap.data().horarioConfig || {} : {};
        const m2 = getMarcasFromConfig(cfg);
        if (m2.length > 1) marcas = m2;
      } catch {}

      const forcedSlot = slotFromQuery();
      let filaUsed = null;
      let colUsed = null;

      if (forcedSlot) {
        const [f, c] = forcedSlot.split("-").map((n) => Number(n));
        filaUsed = Number.isInteger(f) ? f : 0;
        colUsed = Number.isInteger(c) ? c : 0;
      } else {
        const now = FORCE_TEST_TIME ? getNowForSchedule() : nowFromQuery();
        const d = dowFromQuery() ?? now.getDay();
        const h = now.getHours(),
          m = now.getMinutes();

        let idx = marcas.findIndex(([hh, mm]) => h < hh || (h === hh && m < mm));
        if (idx === -1) idx = marcas.length - 1;
        else idx = Math.max(0, idx - 1);

        if (d >= 1 && d <= 5) {
          filaUsed = idx;
          colUsed = d - 1;
        } else {
          filaUsed = 0;
          colUsed = 0;
        }
      }

      if (
        filaUsed != null &&
        colUsed != null &&
        filaUsed >= 0 &&
        filaUsed < matriz.length &&
        colUsed >= 0 &&
        colUsed < (matriz[0]?.length || 5)
      ) {
        let found = null,
          foundIdx = filaUsed;

        // si no está forzado, busca primera clase válida hacia abajo
        if (!forcedSlot) {
          for (let k = filaUsed; k < matriz.length; k++) {
            const c = matriz[k][colUsed];
            if (c && (c.asignatura || c.nivel || c.seccion)) {
              found = c;
              foundIdx = k;
              break;
            }
          }
        } else {
          found = matriz[filaUsed][colUsed];
          foundIdx = filaUsed;
        }

        const clase = found;
        const slotIdCalc = slotIdFrom(foundIdx, colUsed);
        setCurrentSlotId(slotIdCalc);
        try {
          localStorage.setItem("__lastSlotId", slotIdCalc);
        } catch {}

        if (clase?.asignatura) {
          const habilidadesTxt = Array.isArray(clase.habilidades)
            ? clase.habilidades.join(", ")
            : (clase.habilidades ?? "");
          setClaseActual({
            ...clase,
            unidad: clase.unidad ?? "(sin unidad)",
            objetivo: clase.objetivo ?? "(sin objetivo)",
            habilidades: habilidadesTxt ?? "(sin habilidades)",
            bloque: bloques[foundIdx],
            dia: diasCorrectos[colUsed],
            asignatura: clase.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
          });

          try {
            const yearWeek = getYearWeek();
            const pref = doc(db, "planificaciones_sugeridas", uid, yearWeek, slotIdCalc);
            const ps = await getDoc(pref);
            setPlanSug(ps.exists() ? ps.data() : null);
          } catch (e) {
            console.warn("[planificaciones_sugeridas] read:", e?.code);
          }

          try {
            const detalleRef = doc(db, "clases_detalle", uid, "slots", slotIdCalc);
            const detalleSnap = await getDoc(detalleRef);

            if (detalleSnap.exists()) {
              const det = detalleSnap.data();
              setClaseActual((prev) => ({
                ...(prev || {}),
                unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)",
                objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
                habilidades: det.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
                asignatura: det.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
              }));
            } else {
              // si el detalle NO existe y la celda del horario trae campos,
              // sembramos automáticamente en clases_detalle
              try {
                const payload = {
                  asignatura: clase.asignatura ?? "",
                  nivel: clase.nivel ?? "",
                  seccion: clase.seccion ?? "",
                  unidad: clase.unidad ?? "",
                  objetivo: clase.objetivo ?? "",
                  habilidades: habilidadesTxt ?? "",
                  updatedAt: serverTimestamp(),
                };
                const hasDetail = payload.unidad || payload.objetivo || payload.habilidades;
                if (hasDetail) {
                  await setDoc(detalleRef, payload, { merge: true });
                } else {
                  // último intento: leer doc horarios/celdas/{slot}
                  try {
                    const hcell = await getDoc(doc(db, "horarios", uid, "celdas", slotIdCalc));
                    if (hcell.exists()) {
                      const hx = hcell.data() || {};
                      const p2 = {
                        asignatura: hx.asignatura ?? "",
                        nivel: hx.nivel ?? "",
                        seccion: hx.seccion ?? "",
                        unidad: hx.unidad ?? "",
                        objetivo: hx.objetivo ?? "",
                        habilidades: Array.isArray(hx.habilidades)
                          ? hx.habilidades.join(", ")
                          : (hx.habilidades ?? ""),
                        updatedAt: serverTimestamp(),
                      };
                      if (p2.unidad || p2.objetivo || p2.habilidades) {
                        await setDoc(detalleRef, p2, { merge: true });
                        setClaseActual((prev) => ({ ...(prev || {}), ...p2 }));
                      }
                    }
                  } catch {}
                }
              } catch (e) {
                console.warn("[auto seed clases_detalle desde horario]", e?.code || e?.message);
              }
            }
          } catch (e) {
            console.warn("[clases_detalle] read:", e?.code);
          }
        }
      }
    })();
  }, [authed, asignaturaProfe]);

  // escuchar palabras SOLO de la sala
  const [palabrasAgg, setPalabrasAgg] = useState([]); // [{text, value}]
  useEffect(() => {
    if (!salaCode) return; // aún no montó sala
    const colRef = collection(db, "salas", salaCode, "palabras");
    let qRef = colRef;
    try {
      qRef = query(colRef, orderBy("timestamp"));
    } catch {}
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap
          .docs
          .map((d) => d.data())
          .filter((x) => (x.texto || "").trim().length > 0);

        // últimos envíos (los 5 más recientes)
        const last = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            ts: d.data()?.timestamp?.toMillis?.() || 0,
          }))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5);
        setUltimos(last);

        // agregación por palabra (lower + trim)
        const map = new Map();
        rows.forEach((x) => {
          const key = String(x.texto || "").trim().toLowerCase();
          if (!key) return;
          map.set(key, (map.get(key) || 0) + 1);
        });
        const agg = Array.from(map.entries()).map(([text, count]) => ({
          text,
          value: count,
        }));
        setPalabrasAgg(agg);

        try {
          window.__lastCloud = agg; // debug
          setTimeout(() => {
            setPalabrasAgg(
              (Array.isArray(agg) ? agg : []).map((x) => ({
                ...x,
                value: Number.isFinite(+x.value) ? +x.value : 1,
              }))
            );
          }, 0);
        } catch {}
      },
      (e) => console.warn("[salas/palabras] onSnapshot:", e?.code || e?.message)
    );
    return () => unsub();
  }, [salaCode]);

  // ✅ ASISTENCIA: escuchar presentes
  useEffect(() => {
    if (!salaCode) return;
    const colRef = collection(db, "salas", salaCode, "presentes");
    let qRef = colRef;
    try {
      qRef = query(colRef, orderBy("ts", "desc"));
    } catch {}
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            ts:
              d.data()?.ts?.toMillis?.() ||
              d.data()?.timestamp?.toMillis?.() ||
              0,
          }))
          .sort((a, b) => b.ts - a.ts);
        setPresentes(rows);
      },
      (e) => console.warn("[presentes] onSnapshot:", e?.code || e?.message)
    );
    return () => unsub();
  }, [salaCode]);

  // guarda pregunta (debounce)
  const debounceRef = useRef(null);
  const onChangePregunta = (val) => {
    setPreguntaClase(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "preguntaClase", "actual"),
          { texto: val, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.error("Error guardando pregunta:", e?.code);
      }
    }, 400);
  };

  // ====== WordCloud config (se mantiene para legacy) ======
  const palette = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#0ea5e9",
    "#10b981",
    "#f43f5e",
    "#f97316",
    "#84cc16",
  ];
  const fontSizeMapper = (w) => {
    const base = 18; // mínimo
    const step = 10; // incremento por ocurrencia
    const max = 80; // tope
    return Math.min(max, base + (w.value - 1) * step);
  };
  const rotate = () => 0;
  const cloudData = useMemo(() => palabrasAgg, [palabrasAgg]);

  // === agrupar por palabra (fallback antiguo) ===
  const cloudDataGrouped = useMemo(() => {
    const map = new Map();
    for (const w of palabras || []) {
      const key = (w.text || "").trim().toLowerCase();
      if (!key) continue;
      const v = Number(w.value || 1);
      map.set(key, (map.get(key) || 0) + (isFinite(v) ? v : 1));
    }
    return Array.from(map.entries()).map(([text, value]) => ({ text, value }));
  }, [palabras]);
  const maxValCloud = useMemo(
    () =>
      cloudDataGrouped.reduce(
        (m, w) => Math.max(m, Number(w.value || 0)),
        1
      ),
    [cloudDataGrouped]
  );
  const fontSizeMapper2 = (w) => {
    const v = Number(w.value || 0);
    const size = 16 + 44 * (v / (maxValCloud || 1)); // 16..60
    return Math.max(16, Math.min(60, Math.round(size)));
  };

  // normaliza datos para react-d3-cloud (legacy)
  const cloudDataForWC = useMemo(
    () =>
      (cloudData || []).map((w, i) => ({
        text: String(w.text || "").trim(),
        value: Number.isFinite(+w.value) && +w.value > 0 ? +w.value : 1,
        key: `${String(w.text || "").trim()}_${i}`,
      })),
    [cloudData]
  );

  // tamaño responsive del SVG de la nube
  const cloudWrapRef = useRef(null);
  const [cloudSize, setCloudSize] = useState({ w: 800, h: 420 });
  useEffect(() => {
    const el = cloudWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.max(320, Math.floor(entries[0].contentRect.width - 24));
      const h = Math.max(220, Math.floor(w * 0.52));
      setCloudSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // decidir modo de nube automáticamente
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cloudMode");
      if (!stored || stored === "auto") {
        const ok = supportsSvgTextBBox() && !isProblematicUA();
        const mode = ok ? "svg" : "html";
        localStorage.setItem("cloudMode", mode);
        setCloudMode(mode);
      } else {
        setCloudMode(stored);
      }
    } catch {
      setCloudMode(supportsSvgTextBBox() && !isProblematicUA() ? "svg" : "html");
    }
  }, []);

  // Utilidad de seed (se mantiene)
  useEffect(() => {
    window.seedPruebaLunes = async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid) return alert("Sin uid");
        const slotId = "0-0";
        await setDoc(
          doc(db, "clases_detalle", uid, "slots", slotId),
          {
            unidad: "Números y operaciones",
            objetivo: "Reconocer y aplicar propiedades de los números enteros.",
            habilidades:
              "Razonamiento y resolución de problemas; comunicación matemática.",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        alert("Seed de detalle creado en clases_detalle/{uid}/slots/0-0");
      } catch (e) {
        console.error(e);
        alert("No se pudo crear el seed de prueba");
      }
    };
  }, []);

  // Auto-completar detalle desde currículo si hay codUnidad
  useEffect(() => {
    if (!authed || !currentSlotId) return;
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid) return;

        const dref = doc(db, "clases_detalle", uid, "slots", currentSlotId);
        const dsnap = await getDoc(dref);
        const det = dsnap.exists() ? dsnap.data() : {};
        const needs =
          !(det?.unidad && String(det.unidad).trim()) ||
          !(det?.objetivo && String(det.objetivo).trim()) ||
          !(det?.habilidades && String(det.habilidades).trim());

        if (!needs) return;

        const cod =
          det?.codUnidad ||
          claseVigente?.codUnidad ||
          planSug?.codUnidad ||
          null;

        if (!cod) return;

        const curSnap = await getDoc(doc(db, "curriculo", cod));
        if (!curSnap.exists()) return;

        const c = curSnap.data();
        const payload = {
          codUnidad: cod,
          unidad: det.unidad ?? c.titulo ?? "Unidad",
          objetivo:
            det.objetivo ??
            (Array.isArray(c.objetivos) ? c.objetivos[0] : "") ??
            "",
          habilidades:
            det.habilidades ??
            (Array.isArray(c.habilidades)
              ? c.habilidades.join("; ")
              : "") ??
            "",
          updatedAt: serverTimestamp(),
        };

        await setDoc(dref, payload, { merge: true });
        setClaseActual((prev) => ({ ...(prev || {}), ...payload }));
      } catch (e) {
        console.warn("[autofill curriculo → clases_detalle]", e?.code || e?.message);
      }
    })();
  }, [authed, currentSlotId, claseVigente, planSug]);

  // NUEVO: Si el objetivo está vacío o "(sin objetivo)", intenta obtener el primer OA
  useEffect(() => {
    if (!authed) return;

    const texto = String(claseActual?.objetivo || "").trim();
    const objetivoFaltante = !texto || /^\(sin/i.test(texto);

    if (!objetivoFaltante) return;

    (async () => {
      try {
        const asignatura =
          claseActual?.asignatura || asignaturaProfe || "";
        const curso = claseActual?.curso || claseVigente?.curso || "";
        const nivel =
          claseActual?.nivel ||
          nivelDesdeCurso(curso) ||
          claseVigente?.nivel ||
          "";

        const unidad = claseActual?.unidad || claseVigente?.unidad || "";
        if (!asignatura || !nivel || !unidad) return;

        const primerOA = await getPrimerOA(
          asignatura,
          nivel,
          claseVigente?.codUnidad || null,
          unidad
        );

        if (!primerOA) return;

        // Actualiza estado
        setClaseActual((prev) => ({ ...(prev || {}), objetivo: primerOA }));

        // Persiste en el slot actual
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (uid && currentSlotId) {
          await setDoc(
            doc(db, "clases_detalle", uid, "slots", currentSlotId),
            { objetivo: primerOA, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      } catch (e) {
        console.warn("[getPrimerOA autofill]", e?.code || e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authed,
    currentSlotId,
    asignaturaProfe,
    claseVigente?.codUnidad,
    claseVigente?.unidad,
    claseVigente?.nivel,
    claseActual?.objetivo,
    claseActual?.curso,
    claseActual?.nivel,
    claseActual?.unidad,
    claseActual?.asignatura,
  ]);

  // modo seguro
  if (SAFE_MODE) {
    return (
      <div style={page}>
        <ICDebugBadge
          show={DEBUG_ON}
          data={{ SAFE_MODE, DISABLE_CLOUD, mounted: true }}
        />
        <div style={{ ...card, maxWidth: 960, margin: "20px auto" }}>
          <b>InicioClase</b> montó en <b>modo seguro</b>.<br />
          Quita <code>?safe=1</code> o usa <code>?nocloud=1</code> para aislar la nube si fuese necesario.
        </div>
      </div>
    );
  }

  /* HELPER DE HABILIDADES (chips) */
  const habilidadesList = useMemo(() => {
    const raw =
      (claseActual?.habilidades ?? null) ??
      (curriculo?.habilidades ?? null);

    if (!raw) return [];

    // Array: strings u objetos { codigo, descripcion }
    if (Array.isArray(raw)) {
      return raw
        .map((x) =>
          typeof x === "string"
            ? x.trim()
            : x?.codigo
            ? x.descripcion
              ? `${x.codigo}: ${x.descripcion}`
              : x.codigo
            : x?.descripcion || ""
        )
        .filter(Boolean);
    }
    // String: "H1, H4" o texto con separadores
    if (typeof raw === "string") {
      return raw
        .split(/[,;|\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [];
  }, [claseActual, curriculo]);

  // ✅ ASISTENCIA: helper de hora legible
  const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString() : "");

  // NUEVO: data para Nube “Mentimeter”
  const cloudMentData = useMemo(() => buildCloud(palabrasAgg), [palabrasAgg]);

  return (
    <GlobalBoundary>
      <ICDebugBadge
        show={DEBUG_ON}
        data={{
          SAFE_MODE,
          DISABLE_CLOUD,
          authed,
          isAnon,
          salaCode: salaCode || "(none)",
          cloudMode,
          palabras: (Array.isArray(cloudMentData) && cloudMentData.length) || 0,
          BYPASS_NAV, // ⬅️ visible en debug
        }}
      />

      <div style={page}>
        {/* ✅ NUEVO: aviso de pago recibido */}
        {paidOk && (
          <div
            style={{
              ...card,
              marginBottom: "1rem",
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #10b981",
            }}
          >
            <b>✅ ¡Pago recibido!</b> Tu plan quedó activo.
          </div>
        )}

        {/* Banner de clase vigente */}
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
            {claseVigente.fila != null && claseVigente.col != null && (
              <div style={{ fontSize: 13, color: "#475569" }}>
                Bloque #{claseVigente.fila} — Día #{claseVigente.col} (L=0)
              </div>
            )}
            {claseVigente.unidad && (
              <div style={{ marginTop: 6 }}>
                <b>Unidad:</b> {claseVigente.unidad}
                {claseVigente.evaluacion ? " — (Evaluación)" : ""}
              </div>
            )}
            {(claseVigente.objetivo || claseVigente.habilidades) && (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                {claseVigente.objetivo && (
                  <span>
                    <b>Objetivo:</b> {claseVigente.objetivo} —{" "}
                  </span>
                )}
                {claseVigente.habilidades && (
                  <span>
                    <b>Habilidades:</b> {claseVigente.habilidades}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ ...row("1rem"), marginBottom: "1rem" }}>
          <div style={{ ...card }}>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>
              Inicio
            </div>
            <div style={{ color: COLORS.textMuted, marginBottom: 8 }}>
              {horaActual}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>
                {formatMMSS(remaining.m, remaining.s)}
              </div>
              <button
                onClick={resetCountdown}
                style={btnTiny}
                title="Reiniciar a 10:00"
              >
                ↺
              </button>
            </div>

            {/* ✅ NUEVO: Cronómetro Global */}
            <div style={{ marginTop: 8 }}>
              <CronometroGlobal
                slotId={currentSlotId}
                phase="inicio"
                defaultMinutes={10}
                onFinish={() => {
                  if (BYPASS_NAV) return; // ⬅️ NUEVO: no navegar si bypass
                  if (chronoDone) return;
                  setChronoDone(true);
                  const key = makeCountKey(currentSlotId || "0-0");
                  const endStr =
                    localStorage.getItem(key) ||
                    localStorage.getItem(COUNT_KEY) ||
                    String(Date.now());
                  const endMs = Number(endStr);
                  try {
                    localStorage.setItem("__lastSlotId", currentSlotId || "0-0");
                  } catch {}
                  const ficha = makeFicha();
                  navigate("/desarrollo", {
                    state: {
                      slotId: currentSlotId || "0-0",
                      endMs,
                      clase: claseActual || null,
                      ficha,
                    },
                  });
                }}
              />
            </div>
          </div>

          <div style={{ ...card }}>
            <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 6 }}>
              Desarrollo de la clase
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Unidad:</strong> {claseActual?.unidad ?? "(sin unidad)"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Objetivo:</strong> {claseActual?.objetivo ?? "(sin objetivo)"}
            </div>
            <div>
              <strong>Habilidades:</strong>{" "}
              {claseActual?.habilidades ?? "(sin habilidades)"}
            </div>

            {/* Chips visuales de habilidades */}
            {habilidadesList.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                {habilidadesList.map((h, i) => (
                  <span
                    key={`${h}_${i}`}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}

            {planSug && (
              <div style={{ marginTop: 10 }}>
                <div>
                  <strong>Sugerencias del catálogo:</strong>
                </div>
                {(planSug.fuentes?.length || 0) === 0 && (
                  <div style={{ color: COLORS.textMuted }}>
                    No hay sugerencias registradas.
                  </div>
                )}
                {planSug.fuentes?.length > 0 && (
                  <ul style={{ marginTop: 6 }}>
                    {planSug.fuentes.map((f, i) => (
                      <li key={i}>
                        {f.tipo ? <strong>{f.tipo}:</strong> : null}{" "}
                        {f.url ? (
                          <a href={f.url} target="_blank" rel="noreferrer">
                            {f.url}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {planSug.programaUrl && (
                  <div style={{ marginTop: 6 }}>
                    <a href={planSug.programaUrl} target="_blank" rel="noreferrer">
                      Ver Programa de Estudio
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              ...card,
              display: "flex",
              flexDirection: "column",
              gap: ".6rem",
            }}
          >
            <div style={{ display: "flex", gap: ".5rem" }}>
              <button style={btnWhite} title="Acción 1">
                🧩
              </button>
              <button style={btnWhite} title="Acción 2">
                🎓
              </button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800 }}>{nombre}</div>
              {/* NUEVO: Slogan visible y configurable */}
              <div style={{ color: COLORS.textMuted, fontStyle: "italic", marginTop: 2 }}>
                {slogan || DEFAULT_SLOGAN}
              </div>
              <div style={{ color: COLORS.textMuted }}>
                {claseActual?.asignatura ??
                  asignaturaProfe ??
                  "(sin asignatura)"}
              </div>
            </div>
          </div>
        </div>

        {/* OA + Habilidades desde curriculo/{codUnidad} */}
        {cargandoCurriculo ? (
          <div style={{ ...card, marginBottom: "1rem", color: COLORS.textMuted }}>
            Cargando currículo MINEDUC…
          </div>
        ) : curriculo ? (
          <div style={{ ...card, marginBottom: "1rem" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Objetivos de Aprendizaje
            </div>
            {curriculo.objetivos?.length ? (
              <ul style={{ marginTop: 6 }}>
                {curriculo.objetivos.map((oa, i) => (
                  <li key={i}>{oa}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: COLORS.textMuted }}>
                (Sin objetivos cargados)
              </div>
            )}
            <div
              style={{
                fontWeight: 800,
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              Habilidades
            </div>
            {curriculo.habilidades?.length ? (
              <ul style={{ marginTop: 6 }}>
                {curriculo.habilidades.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: COLORS.textMuted }}>
                (Sin habilidades cargadas)
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...card, marginBottom: "1rem", color: COLORS.textMuted }}>
            No se encontró información curricular para esta unidad.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "1rem",
          }}
        >
          <div style={card} ref={cloudWrapRef}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Nube de palabras</h3>

            {DISABLE_CLOUD ? (
              <div style={{ color: COLORS.textMuted, padding: "1rem 0" }}>
                (Nube desactivada con <code>?nocloud=1</code> para pruebas)
              </div>
            ) : (
              <>
                {cloudMentData.length === 0 ? (
                  <div style={{ color: COLORS.textMuted, padding: "1rem 0" }}>
                    Aún no hay palabras. Pide a tus estudiantes que escaneen el
                    QR y envíen una palabra.
                  </div>
                ) : LEGACY_CLOUD ? (
                  // Renderer anterior (por si quieres comparar con ?legacycloud=1)
                  <div style={{ width: "100%", overflow: "hidden" }}>
                    <CloudBoundary
                      fallback={
                        <CanvasCloud
                          data={cloudDataForWC}
                          palette={palette}
                          width={cloudSize.w}
                          height={cloudSize.h}
                          fontSize={fontSizeMapper}
                        />
                      }
                    >
                      <WordCloud
                        data={cloudDataForWC}
                        font="Segoe UI, sans-serif"
                        fontSizeMapper={fontSizeMapper}
                        rotate={0}
                        padding={2}
                        width={cloudSize.w}
                        height={cloudSize.h}
                        fill={(w, i) => palette[i % palette.length]}
                        spiral="archimedean"
                      />
                    </CloudBoundary>
                  </div>
                ) : (
                  // NUEVO renderer “tipo Mentimeter”
                  <NubeDePalabras
                    items={cloudMentData}
                    palette="menti"     // "menti" | "pastel" | "warm" | "cool"
                    minFont={20}
                    maxFont={88}
                    animate
                    darkBg={false}
                  />
                )}
              </>
            )}
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                ...card,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <h4 style={{ marginTop: 0 }}>Escanea para participar</h4>
              <div
                style={{
                  background: COLORS.white,
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <QRCode
                  value={participaURL || makeUrl("/participa")}
                  size={200}
                />
              </div>
              <code
                style={{
                  fontSize: 12,
                  marginTop: 8,
                  color: COLORS.textMuted,
                }}
              >
                {participaURL}
              </code>
              {salaCode && (
                <div
                  style={{
                    marginTop: 8,
                    fontWeight: 800,
                    textAlign: "center",
                  }}
                >
                  Código: <span>{salaCode}</span>
                  <button
                    style={{ ...btnTiny, marginLeft: 8 }}
                    onClick={() => {
                      navigator.clipboard.writeText(participaURL || makeUrl("/participa"));
                    }}
                  >
                    Copiar
                  </button>
                </div>
              )}
            </div>

            {/* ✅ ASISTENCIA */}
            <div style={card}>
              <h4 style={{ marginTop: 0 }}>Asistencia</h4>
              <div style={{ marginBottom: 6 }}>
                Presentes: <b>{presentes.length}</b>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1rem",
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {presentes.length === 0 && (
                  <li style={{ color: COLORS.textMuted }}>
                    (Aún nadie ha escaneado)
                  </li>
                )}
                {presentes.map((p) => (
                  <li key={p.id}>
                    #{p.numeroLista || "?"} — {fmtTime(p.ts)}
                  </li>
                ))}
              </ul>
            </div>

            <div style={card}>
              <h4 style={{ marginTop: 0 }}>Últimos envíos</h4>
              <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                {ultimos.length === 0 && (
                  <li style={{ color: COLORS.textMuted }}>
                    Aún no hay respuestas
                  </li>
                )}
                {ultimos.map((p) => (
                  <li key={p.id}>
                    #{p.numeroLista || "?"} — {p.texto}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div style={{ ...card, marginTop: "1rem", textAlign: "center" }}>
          <em style={{ color: COLORS.textMuted }}>
            Espacio reservado para funciones futuras
          </em>
        </div>

        {/* ================== BOTONES FINALES ================== */}
        <div
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
          }}
        >
          {/* Ir directo a Desarrollo */}
          <button
            onClick={() => {
              const key = makeCountKey(currentSlotId || "0-0");
              const endStr =
                localStorage.getItem(key) ||
                localStorage.getItem(COUNT_KEY);
              const endMs = endStr ? Number(endStr) : 0;

              try {
                localStorage.setItem(
                  "__lastSlotId",
                  currentSlotId || "0-0"
                );
              } catch {}

              const ficha = makeFicha();

              navigate("/desarrollo", {
                state: {
                  slotId: currentSlotId || "0-0",
                  endMs,
                  clase: claseActual || null,
                  ficha,
                  nombre, // le pasamos el nombre
                },
              });
            }}
            style={btnWhite}
          >
            Ir a Desarrollo
          </button>

          {/* Volver al Inicio (pantalla profe / tablero) */}
          <button
            onClick={() => {
              // limpiamos contadores para que no queden pegados
              clearAllCountdowns();

              // recordamos slot actual
              try {
                localStorage.setItem(
                  "__lastSlotId",
                  currentSlotId || "0-0"
                );
              } catch {}

              // navegar a la ruta principal de profe, NO a /home landing
              const homePath = getInicioClasePath();
              navigate(homePath, {
                replace: true,
                state: {
                  from: "inicio",
                  resetTimers: true,
                },
              });
            }}
            style={btnWhite}
          >
            Volver al Inicio
          </button>

          {/* Editar horario */}
          <button
            onClick={() => navigate("/horario/editar")}
            style={btnWhite}
          >
            Editar horario
          </button>
        </div>
      </div>
    </GlobalBoundary>
  );
}

export default InicioClase;
export { InicioClase };
