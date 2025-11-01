// InicioClase.jsx
import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "react-qr-code";
import WordCloud from "react-d3-cloud";
import { db } from "../firebase";
import { getClaseVigente, getYearWeek, slotIdFrom } from "../services/PlanificadorService";
import { PlanContext } from "../context/PlanContext";
import { PLAN_CAPS } from "../lib/planCaps";
import { syncSlotsFromHorario } from "../services/Slots";
import FichaClaseSticky from "../components/FichaClaseSticky";
import NubeDePalabras from "../components/NubeDePalabras";

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
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
/* ⚠️ Duplicado conservado: para evitar 'Identifier ... has already been declared',
   lo importo con un alias de espacio de nombres. */
import * as FichaClaseSticky__DUP from "../components/FichaClaseSticky";

// ➕ NUEVO: helper de nivel y servicio OA
import { nivelDesdeCurso } from "../lib/niveles";
import { getPrimerOA } from "../services/curriculoService";

// ─────────────────────────────────────────────────────────────
// PON ESTO CERCA DE TUS UTILIDADES DE CONTADOR
// ─────────────────────────────────────────────────────────────
function makeCountKey(slotId = "0-0") {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek(); // p.ej. "2025-39"
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
}
/* 🔥 NUEVO: clave por segmento OA */
function makeSegKey(slotId = "0-0", idx = 0) {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek();
  return `ic_countdown_end:${uid}:${yw}:${slotId}:seg:${idx}`;
}

// === DEBUG DE TIEMPO (solo PRUEBA) ===============================
const FORCE_TEST_TIME = false; // ✅ usa hora real
const TEST_DATETIME_ISO = "2025-08-11T08:10:00"; // Lunes 11-08-2025 08:10
function getNowForSchedule() {
  return FORCE_TEST_TIME ? new Date(TEST_DATETIME_ISO) : new Date();
}

/* ✅ Fallback seguro para el contexto (sin hooks) */
const PLAN_DEFAULTS = {
  user: null,
  plan: "FREE",
  caps: PLAN_CAPS.FREE,
  loading: false,
};

// ====== estilos (alineados con Home: #2193b0 – #6dd5ed) ======
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
const input = {
  width: "100%",
  padding: "0.75rem 1rem",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  outline: "none",
  fontSize: "1rem",
  boxSizing: "border-box",
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
const formatMMSS = (m, s) => `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

// ------------------------------------------------------------
// MODO PRUEBA: forzar hora/día vía query (?at=HH:MM&dow=1..5)
// ------------------------------------------------------------
function nowFromQuery() {
  const q = new URLSearchParams(window.location.search);
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
  const q = new URLSearchParams(window.location.search);
  const v = Number(q.get("dow"));
  return v >= 1 && v <= 5 ? v : null;
}
/* ✅ NUEVO: permitir forzar slot vía query (?slot=fila-col) */
function slotFromQuery() {
  try {
    const q = new URLSearchParams(window.location.search || "");
    const s = q.get("slot");
    if (!s) return null;
    const [f, c] = s.split("-").map((n) => Number(n));
    if (Number.isInteger(f) && Number.isInteger(c)) return `${f}-${c}`;
  } catch (e) {}
  return null;
}

// 🔁 Reconstruye la matriz de horario desde rutas nuevas/legacy, con fallback
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

// 🔢 helpers para calcular el slot actual usando horarioConfig.marcas
const colDeHoy = () => {
  const qDow = dowFromQuery();
  const d =
    qDow != null
      ? qDow
      : (FORCE_TEST_TIME ? getNowForSchedule().getDay() : new Date().getDay());
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
/* 🧩 NUEVO HELPER: acepta varios formatos de horarioConfig */
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
    const startTimes = cfg.bloquesGenerados.map((b) => String(b).split(" - ")[0]);
    const lastEnd = String(cfg.bloquesGenerados.at(-1)).split(" - ")[1];
    return [...startTimes, lastEnd].map((s) => {
      const [h, m] = s.split(":").map((n) => Number(n) || 0);
      return [h, m];
    });
  }
  return [];
}

// ========= NUEVO: sala/código para la nube de palabras =========
const randCode = () => String(Math.floor(10000 + Math.random() * 90000)); // 5 dígitos

// ========= NUEVO: helpers de fiabilidad del cloud =========
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
  } catch (e) {
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
    } catch (e) {}
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error("[WordCloud SVG] error:", err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// 🧯 NUEVO: ErrorBoundary global para evitar pantallas en blanco
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
            <h3 style={{ margin: "0 0 8px" }}>
              Se produjo un error al dibujar la pantalla
            </h3>
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
              Detalle:{" "}
              {String(this.state.err?.message || this.state.err) ||
                "(sin mensaje)"}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Componente fallback HTML (palabras coloridas, crecimiento por frecuencia)
// ⬇️ Acepta onEditHorario para no depender de variables fuera de scope
function HtmlCloud({ data, palette, fontSize, onEditHorario }) {
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
      {/* ✅ Botón Modificar horario (con handler pasado por props) */}
      <button
        onClick={onEditHorario}
        style={{
          ...btnTiny,
          width: "100%",
          justifyContent: "center",
          display: "inline-flex",
          marginTop: 6,
        }}
        title="Modificar o completar todo tu horario"
      >
        🗓️ Modificar horario
      </button>
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
            // ✨ más contraste en fallback HTML
            textShadow:
              "0 1px 0 rgba(0,0,0,.15), 0 2px 6px rgba(0,0,0,.12)",
          }}
          title={`${w.text} ×${w.value}`}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}

/* ========= NUEVO: CanvasCloud =========
   Dibuja una nube centrada con disposición en espiral (tipo Mentimeter).
   Se usa cuando 'cloudMode' cae a "html" para evitar el fallback en fila. */
function CanvasCloud({ data, palette, width, height, fontSize, onEditHorario }) {
  const ref = useRef(null);

  // ✅ FIX: define un 'authed' local para que no marque no-undef
  const authed = !!(auth.currentUser?.uid || localStorage.getItem("uid"));

  useEffect(() => {
    if (!authed) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid) return;

    if (window.__slotsSyncedForUid === uid) return;

    (async () => {
      try {
        await syncSlotsFromHorario(uid, { overwrite: false }); // crea lo que falte, no pisa lo ya escrito
        window.__slotsSyncedForUid = uid;
        console.log("✅ slots sincronizados desde el horario");
      } catch (e) {
        console.warn("syncSlotsFromHorario error:", e);
      }
    })();
  }, [authed]);

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
        py = centerY,
        rect;

      // buscar posición libre sobre la espiral
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
        const th = size * 0.9; // aprox alto
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

      // ✨ contraste en canvas
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.globalAlpha = 0.98;
      ctx.fillText(text, px, py);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (found) placed.push(rect);
    });
  }, [data, palette, width, height, fontSize]);

  return (
    <div>
      <button
        onClick={onEditHorario}
        style={{ ...btnTiny, marginBottom: 8 }}
        title="Modificar o completar todo tu horario"
      >
        🗓️ Modificar horario
      </button>
      <canvas ref={ref} style={{ display: "block", width, height }} />
    </div>
  );
}

/* 🧪 NUEVO: overlay de debug para confirmar montaje de InicioClase */
function ICDebugBadge({ show, data }) {
  if (!show) return null;
  const row = (k, v) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ opacity: 0.75 }}>{k}</span>
      <b>{String(v)}</b>
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
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>InicioClase · debug</div>
      <div style={{ display: "grid", gap: 4 }}>
        {Object.entries(data).map(([k, v]) => row(k, v))}
      </div>
    </div>
  );
}

function InicioClase() {
  const navigate = useNavigate();
  const location = useLocation();

  const { ready: authReady, user: authUser, isAnon: isAnonLight } = useAuthReadyLight();
React.useEffect(() => {
    if (authReady) {
      setAuthed(!!authUser);
      setIsAnon(!!isAnonLight);
      if (authUser?.uid && localStorage.getItem("uid") !== authUser.uid) {
        localStorage.setItem("uid", authUser.uid);
      }
    }
  }, [authReady, authUser, isAnonLight]);

  // ... (el resto de tus useState/useEffect existentes)

  // 🧪 NUEVO: flags por query para pruebas
  const __qs = new URLSearchParams(window.location.search || "");
  const SAFE_MODE = __qs.get("safe") === "1";
  const DISABLE_CLOUD = __qs.get("nocloud") === "1";
  const DEBUG_ON = __qs.get("debug") === "1";

  // 🎛️ PRESET (incluye "showtime" para más contraste/rotación agresiva)
  const PRESET =
    __qs.get("preset") ||
    localStorage.getItem("ic_preset") ||
    "default";

  /* ✅ Uso correcto del contexto DENTRO del componente, con fallback */
  const {
    user = PLAN_DEFAULTS.user,
    plan = PLAN_DEFAULTS.plan,
    caps = PLAN_DEFAULTS.caps,
    loading = PLAN_DEFAULTS.loading,
  } = useContext(PlanContext) || PLAN_DEFAULTS;

  const [currentSlotId, setCurrentSlotId] = useState("0-0");
  const [authed, setAuthed] = useState(false);
  const [nombre, setNombre] = useState("Profesor");
  const [asignaturaProfe, setAsignaturaProfe] = useState("");
  const [horaActual, setHoraActual] = useState("");
  const [claseActual, setClaseActual] = useState(null);
  const [planSug, setPlanSug] = useState(null);
  const [preguntaClase, setPreguntaClase] = useState(
    "¿Cuál palabra representa mejor la última clase?"
  );
  const [ultimos, setUltimos] = useState([]);

  // ADICIONAL: clase vigente segun plan semanal
  const [claseVigente, setClaseVigente] = useState(null);

  // Sala / Código y URL para estudiantes
  const [salaCode, setSalaCode] = useState(localStorage.getItem("salaCode") || "");
  const [participaURL, setParticipaURL] = useState("");

  // 🔄 Para mantener tu bloque opcional más abajo:
  const [palabras, setPalabras] = useState([]);

  // === NUEVO: modo de render del cloud ===
  const [cloudMode, setCloudMode] = useState("auto");

  // === Currículo (OA + Habilidades) para la clase vigente
  const [curriculo, setCurriculo] = useState(null);
  const [cargandoCurriculo, setCargandoCurriculo] = useState(true);

  // ✅ NUEVO: OA plan / índice actual
  const [oaPlan, setOaPlan] = useState(null); // [{texto?, titulo?, durMin?, done?}, ...]
  const [oaIndex, setOaIndex] = useState(0);

  // ✅ NUEVO: desactivar login anónimo aquí (sin borrar tu código)
  const ALLOW_ANON = false;

  // ✅ NUEVO: ir a horario en modo edición (ahora SÍ dentro del componente)
  const irAHorario = () => {
    try {
      navigate("/horario", { state: { edit: true, from: "/InicioClase" } });
    } catch {
      window.location.assign("/horario");
    }
  };

  // ✅ tomar slot forzado o recordado apenas monta
  useEffect(() => {
    const s = slotFromQuery() || localStorage.getItem("__lastSlotId");
    if (s) setCurrentSlotId(s);
  }, []);

  // === Auth al montar ===
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        if (ALLOW_ANON) {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            console.error("Anon sign-in:", e);
          }
        } else {
          try {
            navigate("/login?next=/inicio", { replace: true });
          } catch {
            window.location.assign("/login?next=/inicio");
          }
        }
        return;
      } else {
        setAuthed(true);
        const stored = localStorage.getItem("uid");
        if (stored !== u.uid) localStorage.setItem("uid", u.uid);
      }
    });
    return () => unsub();
  }, [navigate]);

  // 🔁 NUEVO: si vengo de postLogin(), priorizo lo que trae en state
  useEffect(() => {
    const st = location?.state || null;
    if (!st) return;

    try {
      const prof = st.profesor || {};
      if (prof?.nombre) setNombre(prof.nombre);

      const cls = st.clase || null;
      if (cls) {
        setClaseActual((prev) => {
          const hTxt = Array.isArray(cls?.habilidades)
            ? cls.habilidades.join(", ")
            : (cls?.habilidades ?? prev?.habilidades ?? "(sin habilidades)");
          return {
            ...(prev || {}),
            unidad: cls?.unidad ?? prev?.unidad ?? "(sin unidad)",
            objetivo: cls?.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
            habilidades: hTxt,
            asignatura: cls?.asignatura ?? prev?.asignatura ?? asignaturaProfe ?? "(sin asignatura)",
            nivel: cls?.nivel ?? prev?.nivel ?? "",
            seccion: cls?.seccion ?? prev?.seccion ?? "",
          };
        });
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ADICIONAL: leer clase vigente y reflejar en UI (sin borrar tu flujo)
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
              res.asignatura ??
              prev?.asignatura ??
              asignaturaProfe ??
              "(sin asignatura)",
          }));
        }
      } catch (e) {
        console.error("[Inicio] getClaseVigente:", e);
      }
    })();
  }, [asignaturaProfe]);

  // 🔎 Cargar currículo (OA + Habilidades) cuando cambie la clase vigente
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

  // reloj
  useEffect(() => {
    setHoraActual(new Date().toLocaleTimeString());
    const id = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // =========================
  // ✅ CRONÓMETRO CORREGIDO
  // =========================
  const [remaining, setRemaining] = useState({ m: 10, s: 0 });

  // ➕ NUEVO: helpers de duración/objetivo actual
  const currentOA = useMemo(
    () =>
      Array.isArray(oaPlan) && oaPlan.length > 0
        ? oaPlan[Math.min(oaIndex ?? 0, oaPlan.length - 1)] || null
        : null,
    [oaPlan, oaIndex]
  );
  const nextOA = useMemo(() => {
    if (!Array.isArray(oaPlan) || oaPlan.length) return null;
    const idx = Math.min((oaIndex ?? 0) + 1, oaPlan.length - 1);
    return idx > oaPlan.length - 1 ? null : oaPlan[idx] || null;
  }, [oaPlan, oaIndex]);
  const activeDurMin = useMemo(() => {
    if (currentOA && Number.isFinite(+currentOA.durMin) && +currentOA.durMin > 0) {
      return Math.floor(+currentOA.durMin);
    }
    return 10; // fallback
  }, [currentOA]);

  // ✅ Nuevo efecto: controla el countdown por SLOT o por SEGMENTO OA
  useEffect(() => {
    if (!currentSlotId) return;

    let endStr = null;
    let endMs = 0;
    let key = null;

    if (Array.isArray(oaPlan) && oaPlan.length > 0) {
      key = makeSegKey(currentSlotId, oaIndex || 0);
      endStr = localStorage.getItem(key);
      if (!endStr) {
        const endTime = Date.now() + activeDurMin * 60 * 1000;
        localStorage.setItem(key, String(endTime));
        endStr = String(endTime);
      }
    } else {
      key = makeCountKey(currentSlotId);
      endStr = localStorage.getItem(key) || localStorage.getItem(COUNT_KEY);
      if (!endStr) {
        const endTime = Date.now() + 10 * 60 * 1000; // 10 min
        localStorage.setItem(key, String(endTime));
        localStorage.setItem(COUNT_KEY, String(endTime)); // compat
        endStr = String(endTime);
      }
    }

    endMs = Number(endStr);
    const tick = () => setRemaining(getRemaining(endMs));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentSlotId, oaPlan, oaIndex, activeDurMin]);

  // 🔄 Reinicio manual
  const resetCountdown = () => {
    const dur = Array.isArray(oaPlan) && oaPlan.length > 0 ? activeDurMin : 10;
    const endTime = Date.now() + dur * 60 * 1000;
    if (Array.isArray(oaPlan) && oaPlan.length > 0) {
      const keySeg = makeSegKey(currentSlotId || "0-0", oaIndex || 0);
      localStorage.setItem(keySeg, String(endTime));
    } else {
      const key = makeCountKey(currentSlotId || "0-0");
      localStorage.setItem(key, String(endTime));
      localStorage.setItem(COUNT_KEY, String(endTime));
    }
    setRemaining(getRemaining(endTime));
  };

  // 🧾 Bridge para Desarrollo
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
      nivel: claseActual?.nivel ?? "",
      seccion: claseActual?.seccion ?? "",
      bloque: claseActual?.bloque ?? "",
      dia: claseActual?.dia ?? "",
      codUnidad: claseVigente?.codUnidad ?? planSug?.codUnidad ?? "",
      programaUrl: planSug?.programaUrl ?? "",
      fuentes: Array.isArray(planSug?.fuentes) ? planSug.fuentes : [],
      planId: planSug?.planId ?? "",
      oaPlan: Array.isArray(oaPlan) ? oaPlan : [],
      oaIndex: Number.isInteger(oaIndex) ? oaIndex : 0,
      updatedAt: Date.now(),
    };
  };
  function persistClaseForDesarrollo({ ficha, slotId, endMs }) {
    try {
      const payload = {
        ficha: ficha || makeFicha(),
        slotId: slotId || currentSlotId || "0-0",
        endMs: typeof endMs === "number" ? endMs : Date.now(),
        from: "inicio",
        ts: Date.now(),
      };
      localStorage.setItem("bridge:desarrolloClase", JSON.stringify(payload));
    } catch (_) {}
  }

  // 🚦 Autoavance OA o navegación a Desarrollo
  useEffect(() => {
    if (remaining.m !== 0 || remaining.s !== 0) return;

    (async () => {
      if (Array.isArray(oaPlan) && oaPlan.length > 0 && (oaIndex || 0) < oaPlan.length - 1) {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        const nextIndex = (oaIndex || 0) + 1;

        try {
          if (uid && currentSlotId) {
            const dref = doc(db, "clases_detalle", uid, "slots", currentSlotId);
            await setDoc(
              dref,
              {
                oaIndex: nextIndex,
                [`oaPlan.${oaIndex}.done`]: true,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (e) {
          console.warn("[OA autoavance] persist:", e?.code || e?.message);
        }

        setOaIndex(nextIndex);

        const durNext =
          Number.isFinite(+oaPlan[nextIndex]?.durMin) && +oaPlan[nextIndex].durMin > 0
            ? Math.floor(+oaPlan[nextIndex].durMin)
            : 10;
        const endTime = Date.now() + durNext * 60 * 1000;
        const kNext = makeSegKey(currentSlotId || "0-0", nextIndex);
        try {
          localStorage.setItem(kNext, String(endTime));
        } catch (e) {}
        setRemaining(getRemaining(endTime));
        return;
      }

      const key =
        Array.isArray(oaPlan) && oaPlan.length > 0
          ? makeSegKey(currentSlotId || "0-0", oaIndex || 0)
          : makeCountKey(currentSlotId || "0-0");

      const endStr =
        localStorage.getItem(key) || localStorage.getItem(COUNT_KEY) || String(Date.now());
      const endMs = Number(endStr);
      try {
        localStorage.setItem("__lastSlotId", currentSlotId || "0-0");
      } catch (e) {}

      const ficha = makeFicha();
      persistClaseForDesarrollo({ ficha, slotId: currentSlotId || "0-0", endMs });
      navigate("/desarrollo", {
        state: {
          slotId: currentSlotId || "0-0",
          endMs,
          clase: claseActual || null,
          ficha,
          oaPlan: Array.isArray(oaPlan) ? oaPlan : [],
          oaIndex: Number.isInteger(oaIndex) ? oaIndex : 0,
        },
      });
    })();
  }, [remaining, navigate, currentSlotId, claseActual, oaPlan, oaIndex]);

  // ========= SALA: crear/asegurar + URL QR =========
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

      const hostOverride = localStorage.getItem("hostOverride");
      const base =
        hostOverride && /^https?:\/\/.*/.test(hostOverride)
          ? hostOverride
          : window.location.origin;
      setParticipaURL(`${base}/participa?code=${code}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

        const hostOverride = localStorage.getItem("hostOverride");
        const base =
          hostOverride && /^https?:\/\/.*/.test(hostOverride)
            ? hostOverride
            : window.location.origin;
        setParticipaURL(`${base}/participa?code=${code}`);

        window.__salaInitDone = true;
      } catch (e) {
        console.warn("[sala][authed] setDoc:", e?.code || e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, salaCode]);

  // nombre profe + pregunta (solo si autenticado)
  useEffect(() => {
    if (!authed) return;
    (async () => {
      const uid = auth.currentUser?.uid || localStorage.getItem("uid");
      if (uid) {
        try {
          const uref = doc(db, "usuarios", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const u = usnap.data();
            if (u?.nombre) setNombre(u.nombre);
            if (u?.asignatura) setAsignaturaProfe(u.asignatura);
          }
        } catch (e) {
          console.warn("[usuarios] read nombre:", e?.code);
        }
      }
      try {
        const u = auth.currentUser;
        if (u && (!nombre || /^\s*Profesor/i.test(nombre))) {
          const byAuth = u.displayName || (u.email ? u.email.split("@")[0] : "");
          if (byAuth) setNombre(byAuth);
        }
      } catch (_) {}

      try {
        const pref = doc(db, "preguntaClase", "actual");
        const psnap = await getDoc(pref);
        if (psnap.exists() && psnap.data()?.texto)
          setPreguntaClase(psnap.data().texto);
      } catch (e) {
        console.warn("[preguntaClase] read:", e?.code);
      }
    })();
  }, [authed, nombre]);

  // Fallback uniforme desde profesores/ y usuarios/
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
              unidad: (prev?.unidad && !/^\(sin/i.test(prev?.unidad)) ? prev?.unidad : (u.unidadInicial ?? u.unidad ?? "(sin unidad)"),
              objetivo: (prev?.objetivo && !/^\(sin/i.test(prev?.objetivo)) ? prev?.objetivo : (u.objetivo ?? "(sin objetivo)"),
              habilidades: (prev?.habilidades && !/^\(sin/i.test(prev?.habilidades)) ? prev?.habilidades : (normHabs(u.habilidades) || "(sin habilidades)"),
              asignatura: pick(prev?.asignatura, asignaturaProfe, u.asignatura, "(sin asignatura)"),
              curso: pick(prev?.curso, u.curso, "(sin curso)"),
            }));
          }
        } catch (e) {
          console.warn("[Inicio] usuarios fallback:", e?.code || e);
        }
      } catch (e) {}
    })();
  }, [authed, asignaturaProfe]);

  // si hay horarioConfig.marcas -> clases_detalle/{uid}/slots/{fila}-{col}
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid) return;

        // ✅ prioridad: slot por query
        const sQ = slotFromQuery();
        if (sQ) {
          setCurrentSlotId(sQ);
          try { localStorage.setItem("__lastSlotId", sQ); } catch (e) {}
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
            if (Array.isArray(det.oaPlan)) setOaPlan(det.oaPlan);
            if (Number.isInteger(det.oaIndex)) setOaIndex(det.oaIndex);
          } else {
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
                  habilidades: Array.isArray(hx.habilidades) ? hx.habilidades.join(", ") : (hx.habilidades ?? ""),
                  updatedAt: serverTimestamp(),
                };
                if (payload.unidad || payload.objetivo || payload.habilidades) {
                  await setDoc(drefQ, payload, { merge: true });
                  setClaseActual((prev) => ({ ...(prev || {}), ...payload }));
                }
              }
            } catch (e) {}
          }
          return;
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
          try { localStorage.setItem("__lastSlotId", slotId); } catch (e) {}
          const dref = doc(db, "clases_detalle", uid, "slots", slotId);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const det = dsnap.data();
            setClaseActual((prev) => ({
              ...(prev || {}),
              unidad: det.unidad ?? prev?.unidad ?? "(sin unidad)",
              objetivo: det.objetivo ?? prev?.objetivo ?? "(sin objetivo)",
              habilidades:
                det.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
              asignatura:
                det.asignatura ??
                prev?.asignatura ??
                asignaturaProfe ??
                "(sin asignatura)",
            }));
            if (Array.isArray(det.oaPlan)) setOaPlan(det.oaPlan);
            if (Number.isInteger(det.oaIndex)) setOaIndex(det.oaIndex);
          } else {
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
                    (Array.isArray(hx.habilidades) ? hx.habilidades.join(", ") : (hx.habilidades ?? "")) ||
                    prev?.habilidades ||
                    "(sin habilidades)",
                }));
              }
            } catch (e) {}
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
      ];
      const diasCorrectos = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

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
      ];
      try {
        const uref = doc(db, "usuarios", uid);
        const usnap = await getDoc(uref);
        const cfg = usnap.exists() ? usnap.data().horarioConfig || {} : {};
        const m2 = getMarcasFromConfig(cfg);
        if (m2.length > 1) marcas = m2;
      } catch (e) {}

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
        try { localStorage.setItem("__lastSlotId", slotIdCalc); } catch (e) {}

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
                habilidades:
                  det.habilidades ?? prev?.habilidades ?? "(sin habilidades)",
                asignatura:
                  det.asignatura ??
                  prev?.asignatura ??
                  asignaturaProfe ??
                  "(sin asignatura)",
              }));
              if (Array.isArray(det.oaPlan)) setOaPlan(det.oaPlan);
              if (Number.isInteger(det.oaIndex)) setOaIndex(det.oaIndex);
            } else {
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
                const hasDetail = (payload.unidad || payload.objetivo || payload.habilidades);
                if (hasDetail) {
                  await setDoc(detalleRef, payload, { merge: true });
                } else {
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
                        habilidades: Array.isArray(hx.habilidades) ? hx.habilidades.join(", ") : (hx.habilidades ?? ""),
                        updatedAt: serverTimestamp(),
                      };
                      if (p2.unidad || p2.objetivo || p2.habilidades) {
                        await setDoc(detalleRef, p2, { merge: true });
                        setClaseActual((prev) => ({ ...(prev || {}), ...p2 }));
                      }
                    }
                  } catch (e) {}
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

  // ========= Palabras =========
  const [palabrasAgg, setPalabrasAgg] = useState([]); // [{text, value}]
  useEffect(() => {
    if (!salaCode) return;
    const colRef = collection(db, "salas", salaCode, "palabras");
    let qRef = colRef;
    try {
      qRef = query(colRef, orderBy("timestamp"));
    } catch (e) {}
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap
          .docs
          .map((d) => d.data())
          .filter((x) => (x.texto || "").trim().length > 0);

        const last = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            ts: d.data()?.timestamp?.toMillis?.() || 0,
          }))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5);
        setUltimos(last);

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
          window.__lastCloud = agg;
          setTimeout(() => {
            setPalabrasAgg(
              (Array.isArray(agg) ? agg : []).map((x) => ({
                ...x,
                value: Number.isFinite(+x.value) ? +x.value : 1,
              }))
            );
          }, 0);
        } catch (e) {}
      },
      (e) => console.warn("[salas/palabras] onSnapshot:", e?.code || e?.message)
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

  // ====== WordCloud: tamaño segun frecuencia + colores ======
  // 🎨 Paleta ajustable por PRESET
  const paletteDefault = [
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
  const paletteShowtime = [
    "#ffffff", "#ffd60a", "#00e5ff", "#ff4d6d", "#7bff00",
    "#ff9f1c", "#8eecf5", "#c77dff", "#72efdd", "#f72585"
  ];
  const palette = PRESET === "showtime" ? paletteShowtime : paletteDefault;

  // 🅰️ Tamaño + rotación agresiva en showtime
  const fontSizeMapper = (w) => {
    if (PRESET === "showtime") {
      const base = 24;
      const step = 14;
      const max = 110;
      return Math.min(max, base + (w.value - 1) * step);
    }
    const base = 18;
    const step = 10;
    const max = 80;
    return Math.min(max, base + (w.value - 1) * step);
  };
  const rotate = () => {
    if (PRESET === "showtime") {
      const angles = [-90, -60, -30, 0, 30, 60, 90];
      return angles[Math.floor(Math.random() * angles.length)];
    }
    return 0;
  };

  const cloudData = useMemo(() => palabrasAgg, [palabrasAgg]);

  // === NUEVO: agrupar por palabra (con tu estado palabras opcional)
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
    () => cloudDataGrouped.reduce((m, w) => Math.max(m, Number(w.value || 0)), 1),
    [cloudDataGrouped]
  );
  const fontSizeMapper2 = (w) => {
    const v = Number(w.value || 0);
    const size = 16 + 44 * (v / (maxValCloud || 1));
    return Math.max(16, Math.min(60, Math.round(size)));
  };

  // ======== NORMALIZACIÓN para react-d3-cloud ========
  const cloudDataForWC = useMemo(
    () =>
      (cloudData || []).map((w, i) => ({
        text: String(w.text || "").trim(),
        value: Number.isFinite(+w.value) && +w.value > 0 ? +w.value : 1,
        key: `${String(w.text || "").trim()}_${i}`,
      })),
    [cloudData]
  );

  // === Responsive del SVG de la nube
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

  // === decidir modo de nube automáticamente
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
    } catch (e) {
      setCloudMode(supportsSvgTextBBox() && !isProblematicUA() ? "svg" : "html");
    }
  }, []);

  // Utilidad de seed
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
        alert("✅ Seed de detalle creado en clases_detalle/{uid}/slots/0-0");
      } catch (e) {
        console.error(e);
        alert("⛔ No se pudo crear el seed de prueba");
      }
    };
  }, []);

  // 🔎 Auto-completar detalle desde currículo si faltan campos
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
          objetivo: det.objetivo ?? (Array.isArray(c.objetivos) ? c.objetivos[0] : "") ?? "",
          habilidades:
            det.habilidades ??
            (Array.isArray(c.habilidades) ? c.habilidades.join("; ") : "") ??
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

  // ✅ Rellenar objetivo con primer OA si falta
  useEffect(() => {
    if (!authed) return;

    const texto = String(claseActual?.objetivo || "").trim();
    const objetivoFaltante = !texto || /^\(sin/i.test(texto);
    if (!objetivoFaltante) return;

    (async () => {
      try {
        const asignatura = claseActual?.asignatura || asignaturaProfe || "";
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

        setClaseActual((prev) => ({ ...(prev || {}), objetivo: primerOA }));

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

  // suscripción live a oaPlan/oaIndex
  useEffect(() => {
    if (!authed || !currentSlotId) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid) return;
    const dref = doc(db, "clases_detalle", uid, "slots", currentSlotId);
    const unsub = onSnapshot(
      dref,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() || {};
        if (Array.isArray(d.oaPlan)) setOaPlan(d.oaPlan);
        if (Number.isInteger(d.oaIndex)) setOaIndex(d.oaIndex);
      },
      (e) => console.warn("[oaPlan snapshot]", e?.code || e?.message)
    );
    return () => unsub();
  }, [authed, currentSlotId]);

  // ⬅️ pega esto justo antes del guard SAFE_MODE
if (!authReady) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#334155" }}>
      Cargando sesión segura…
    </div>
  );
}


  // 🛡️ Modo seguro
  if (SAFE_MODE) {
    return (
      <div style={page}>
        <ICDebugBadge
          show={DEBUG_ON}
          data={{ SAFE_MODE, DISABLE_CLOUD, mounted: true, preset: PRESET }}
        />
        <div style={{ ...card, maxWidth: 960, margin: "20px auto" }}>
          ✅ <b>InicioClase</b> montó en <b>modo seguro</b>.<br />
          Quita <code>?safe=1</code> o usa <code>?nocloud=1</code>.
        </div>
      </div>
    );
  }

  // 🔖 Normalización chips habilidades
  const habilidadesList = useMemo(() => {
    const raw =
      (claseActual?.habilidades ?? null) ??
      (curriculo?.habilidades ?? null);

    if (!raw) return [];
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
    if (typeof raw === "string") {
      return raw
        .split(/[,;•\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [claseActual, curriculo]);

  // ➕ Acciones OA
  const handleNextOA = async () => {
    if (!Array.isArray(oaPlan) || oaPlan.length === 0) return;
    const last = (oaIndex || 0) >= oaPlan.length - 1;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid || !currentSlotId) return;

    if (last) {
      const key = makeSegKey(currentSlotId || "0-0", oaIndex || 0);
      const endStr =
        localStorage.getItem(key) || localStorage.getItem(COUNT_KEY) || String(Date.now());
      const endMs = Number(endStr);
      const ficha = makeFicha();
      persistClaseForDesarrollo({ ficha, slotId: currentSlotId || "0-0", endMs });
      navigate("/desarrollo", {
        state: { slotId: currentSlotId || "0-0", endMs, clase: claseActual || null, ficha, oaPlan, oaIndex },
      });
      return;
    }

    const nextIndex = (oaIndex || 0) + 1;
    try {
      await setDoc(
        doc(db, "clases_detalle", uid, "slots", currentSlotId),
        {
          oaIndex: nextIndex,
          [`oaPlan.${oaIndex}.done`]: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("[handleNextOA] persist:", e?.code || e?.message);
    }
    setOaIndex(nextIndex);

    const durNext =
      Number.isFinite(+oaPlan[nextIndex]?.durMin) && +oaPlan[nextIndex].durMin > 0
        ? Math.floor(+oaPlan[nextIndex].durMin)
        : 10;
    const endTime = Date.now() + durNext * 60 * 1000;
    const kNext = makeSegKey(currentSlotId || "0-0", nextIndex);
    try { localStorage.setItem(kNext, String(endTime)); } catch (e) {}
    setRemaining(getRemaining(endTime));
  };
  const handleResetOA = () => resetCountdown();

  // === ASISTENCIA =========================
  const [asistenciaRows, setAsistenciaRows] = useState([]);
  const [asistenciaDedup, setAsistenciaDedup] = useState([]);
  const [asistManualNum, setAsistManualNum] = useState("");
  const [asistManualNom, setAsistManualNom] = useState("");
  const yearWeekNow = getYearWeek();

  const totalKey = useMemo(() => {
    const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
    const curso = (claseActual?.curso || claseVigente?.curso || "general").toString();
    return `ic_asist_total:${uid}:${curso}`;
  }, [claseActual?.curso, claseVigente?.curso]);
  const [totalEsperado, setTotalEsperado] = useState(() => {
    const s = localStorage.getItem("ic_asist_total_default") || "0";
    return Number.isFinite(+s) ? +s : 0;
  });
  useEffect(() => {
    const v = localStorage.getItem(totalKey);
    if (v != null) {
      const n = Number(v);
      if (Number.isFinite(n)) setTotalEsperado(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalKey]);

  const participaURLAsistencia = useMemo(() => {
    if (!participaURL) return "";
    const params = new URLSearchParams();
    params.set("code", salaCode || "");
    params.set("m", "asis");
    params.set("slot", currentSlotId || "0-0");
    params.set("yw", yearWeekNow);
    return `${(participaURL.split("?")[0])}?${params.toString()}`;
  }, [participaURL, salaCode, currentSlotId, yearWeekNow]);

  useEffect(() => {
    if (!salaCode) return;
    const colRef = collection(db, "salas", salaCode, "asistencia");
    let qRef = colRef;
    try {
      qRef = query(colRef, orderBy("timestamp"));
    } catch (e) {}
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const now = Date.now();
        const SIX_H = 6 * 60 * 60 * 1000;

        const rows = snap.docs
          .map((d) => {
            const x = d.data() || {};
            const ts =
              x?.timestamp?.toMillis?.() ??
              x?.ts?.toMillis?.() ??
              0;
            return {
              id: d.id,
              ...x,
              _ts: ts,
            };
          })
          .filter((x) => {
            const okYW = !x.yw || String(x.yw) === String(yearWeekNow);
            const okSlot = !x.slotId || String(x.slotId) === String(currentSlotId);
            const recent = x._ts ? now - x._ts < SIX_H : true;
            return (okYW && okSlot) || (!x.yw && !x.slotId && recent);
          });

        setAsistenciaRows(rows);

        const map = new Map();
        for (const r of rows) {
          const key =
            (r.uidAlumno && String(r.uidAlumno)) ||
            (Number.isFinite(+r.numeroLista) ? `n${+r.numeroLista}` : null) ||
            r.id;
          if (!key) continue;
          const prev = map.get(key);
          if (!prev || (r._ts || 0) > (prev._ts || 0)) map.set(key, r);
        }
        setAsistenciaDedup(Array.from(map.values()).sort((a, b) => (a.numeroLista || 9999) - (b.numeroLista || 9999)));
      },
      (e) => console.warn("[salas/asistencia] onSnapshot:", e?.code || e?.message)
    );
    return () => unsub();
  }, [salaCode, currentSlotId, yearWeekNow]);

  useEffect(() => {
    (async () => {
      try {
        const uid = auth.currentUser?.uid || localStorage.getItem("uid");
        if (!uid || !currentSlotId) return;
        await setDoc(
          doc(db, "clases_detalle", uid, "slots", currentSlotId),
          {
            asistenciaCount: asistenciaDedup.length,
            lastAsistenciaAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("[asistencia → resumen clases_detalle]", e?.code || e?.message);
      }
    })();
  }, [asistenciaDedup.length, currentSlotId]);

  const marcarAsistenciaManual = async () => {
    try {
      if (!salaCode) return;
      const num = parseInt(String(asistManualNum).trim(), 10);
      if (!Number.isFinite(num)) return;
      const payload = {
        numeroLista: num,
        nombre: String(asistManualNom || "").trim() || null,
        slotId: currentSlotId || "0-0",
        yw: yearWeekNow,
        source: "manual",
        timestamp: serverTimestamp(),
      };
      const ref = doc(collection(db, "salas", salaCode, "asistencia"));
      await setDoc(ref, payload, { merge: true });
      setAsistManualNum("");
      setAsistManualNom("");
    } catch (e) {
      console.warn("[asistencia manual] setDoc:", e?.code || e?.message);
    }
  };

  const exportAsistenciaCSV = () => {
    try {
      const header = ["numeroLista", "nombre", "slotId", "yw", "source", "ts"];
      const lines = asistenciaDedup.map((r) =>
        [
          r.numeroLista ?? "",
          (r.nombre ?? "").toString().replace(/"/g, '""'),
          r.slotId ?? "",
          r.yw ?? "",
          r.source ?? "",
          r._ts ? new Date(r._ts).toISOString() : "",
        ].map((v) => `"${String(v)}"`).join(",")
      );
      const csv = [header.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencia_${yearWeekNow}_${currentSlotId}_${salaCode}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.warn("[export CSV] error:", e);
    }
  };

  return (
    <GlobalBoundary>
      <ICDebugBadge
        show={DEBUG_ON}
        data={{
          SAFE_MODE,
          DISABLE_CLOUD,
          authed,
          salaCode: salaCode || "(none)",
          cloudMode,
          preset: PRESET,
          palabras: (Array.isArray(cloudData) && cloudData.length) || 0,
          oaLen: Array.isArray(oaPlan) ? oaPlan.length : 0,
          oaIndex: oaIndex ?? 0,
        }}
      />

      <div style={page}>
        {/* Banner clase vigente */}
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
                Bloque #{claseVigente.fila} · Día #{claseVigente.col} (L=0)
              </div>
            )}
            {claseVigente.unidad && (
              <div style={{ marginTop: 6 }}>
                <b>Unidad:</b> {claseVigente.unidad}
                {claseVigente.evaluacion ? " · (Evaluación)" : ""}
              </div>
            )}
            {(claseVigente.objetivo || claseVigente.habilidades) && (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                {claseVigente.objetivo && (
                  <span>
                    <b>Objetivo:</b> {claseVigente.objetivo} ·{" "}
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
              🕒 {horaActual}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>
                {formatMMSS(remaining.m, remaining.s)}
              </div>
              <button onClick={resetCountdown} style={btnTiny} title="Reiniciar segmento">
                ♻️
              </button>
              <button onClick={irAHorario} style={btnTiny} title="Editar horario">
                🗓️
              </button>
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

            {Array.isArray(oaPlan) && oaPlan.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px dashed ${COLORS.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    OA actual {Math.min((oaIndex ?? 0) + 1, oaPlan.length)} / {oaPlan.length}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleResetOA} style={btnTiny} title="Reiniciar tiempo del objetivo">
                      ⟳ Reiniciar objetivo
                    </button>
                    <button onClick={handleNextOA} style={btnTiny} title="Avanzar al siguiente objetivo">
                      ▶ Siguiente objetivo
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  <strong>Actual:</strong>{" "}
                  {(currentOA?.titulo || currentOA?.texto || "(sin texto)")}
                  {Number.isFinite(+currentOA?.durMin) && +currentOA.durMin > 0 ? (
                    <em style={{ color: COLORS.textMuted }}> · {Math.floor(+currentOA.durMin)} min</em>
                  ) : null}
                </div>
                {(() => {
                  if (!Array.isArray(oaPlan) || oaPlan.length === 0) return null;
                  const idx = Math.min((oaIndex ?? 0) + 1, oaPlan.length - 1);
                  const next = idx > oaPlan.length - 1 ? null : oaPlan[idx];
                  return next ? (
                    <div style={{ marginTop: 4, color: COLORS.textMuted }}>
                      <strong>Siguiente:</strong> {next?.titulo || next?.texto}
                      {Number.isFinite(+next?.durMin) && +next.durMin > 0 ? (
                        <em> · {Math.floor(+next.durMin)} min</em>
                      ) : null}
                    </div>
                  ) : null;
                })()}
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

          <div style={{ ...card, display: "flex", flexDirection: "column", gap: ".6rem" }}>
            <div style={{ display: "flex", gap: ".5rem" }}>
              <button style={btnWhite}>🧑‍🏫</button>
              <button style={btnWhite}>🎓</button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800 }}>{nombre}</div>
              <div style={{ color: COLORS.textMuted }}>
                {claseActual?.asignatura ?? asignaturaProfe ?? "(sin asignatura)"}
              </div>
            </div>
          </div>
        </div>

        {/* 📘 OA + Habilidades desde curriculo/{codUnidad} */}
        {cargandoCurriculo ? (
          <div style={{ ...card, marginBottom: "1rem", color: COLORS.textMuted }}>
            Cargando currículo MINEDUC…
          </div>
        ) : curriculo ? (
          <div style={{ ...card, marginBottom: "1rem" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Objetivos de Aprendizaje</div>
            {curriculo.objetivos?.length ? (
              <ul style={{ marginTop: 6 }}>
                {curriculo.objetivos.map((oa, i) => (
                  <li key={i}>{oa}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: COLORS.textMuted }}>(Sin objetivos cargados)</div>
            )}
            <div style={{ fontWeight: 800, marginTop: 12, marginBottom: 6 }}>
              Habilidades
            </div>
            {curriculo.habilidades?.length ? (
              <ul style={{ marginTop: 6 }}>
                {curriculo.habilidades.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: COLORS.textMuted }}>(Sin habilidades cargadas)</div>
            )}
          </div>
        ) : (
          <div style={{ ...card, marginBottom: "1rem", color: COLORS.textMuted }}>
            No se encontró información curricular para esta unidad.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
          <div style={card} ref={cloudWrapRef}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              💬 Nube de palabras
              {PRESET === "showtime" ? " · SHOWTIME" : ""}
            </h3>

            {/* Opcional: muestra también tu componente propio si lo necesitas */}
            {/* <div className="nube-container"><NubeDePalabras words={palabras} /></div> */}

            {DISABLE_CLOUD ? (
              <div style={{ color: COLORS.textMuted, padding: "1rem 0" }}>
                (Nube desactivada con <code>?nocloud=1</code>)
              </div>
            ) : (
              <>
                {cloudData.length === 0 ? (
                  <div style={{ color: COLORS.textMuted, padding: "1rem 0" }}>
                    Aún no hay palabras. Pide a tus estudiantes que escaneen el QR y
                    envíen una palabra.
                  </div>
                ) : (
                  <div style={{ width: "100%", overflow: "hidden" }}>
                    {cloudMode === "html" ? (
                      <CanvasCloud
                        data={cloudDataForWC}
                        palette={palette}
                        width={cloudSize.w}
                        height={cloudSize.h}
                        fontSize={fontSizeMapper}
                        onEditHorario={irAHorario}
                      />
                    ) : (
                      <CloudBoundary
                        fallback={
                          <CanvasCloud
                            data={cloudDataForWC}
                            palette={palette}
                            width={cloudSize.w}
                            height={cloudSize.h}
                            fontSize={fontSizeMapper}
                            onEditHorario={irAHorario}
                          />
                        }
                      >
                        <WordCloud
                          data={cloudDataForWC}
                          font="Segoe UI, sans-serif"
                          fontSizeMapper={fontSizeMapper}
                          rotate={rotate}
                          padding={2}
                          width={cloudSize.w}
                          height={cloudSize.h}
                          fill={(w, i) => palette[i % palette.length]}
                          spiral="archimedean"
                        />
                      </CloudBoundary>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                ...card,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <h4 style={{ marginTop: 0 }}>🔗 Escanea para participar</h4>
              <div
                style={{
                  background: COLORS.white,
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <QRCode value={participaURL || window.location.origin} size={200} />
              </div>
              <code style={{ fontSize: 12, marginTop: 8, color: COLORS.textMuted }}>
                {participaURL}
              </code>
              {salaCode && (
                <div style={{ marginTop: 8, fontWeight: 800 }}>
                  Código: <span>{salaCode}</span>
                  <button
                    style={{ ...btnTiny, marginLeft: 8 }}
                    onClick={() => {
                      navigator.clipboard.writeText(participaURL);
                    }}
                  >
                    📋 Copiar
                  </button>
                </div>
              )}

              {/* === ASISTENCIA: link directo al modo asistencia === */}
              {salaCode && (
                <div style={{ marginTop: 12, textAlign: "center" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>🟢 Modo asistencia</div>
                  <div
                    style={{
                      background: COLORS.white,
                      padding: 10,
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <QRCode value={participaURLAsistencia || window.location.origin} size={160} />
                  </div>
                  <code style={{ fontSize: 12, marginTop: 6, color: COLORS.textMuted, display: "block" }}>
                    {participaURLAsistencia}
                  </code>
                  <button
                    style={{ ...btnTiny, marginTop: 6 }}
                    onClick={() => navigator.clipboard.writeText(participaURLAsistencia)}
                  >
                    📋 Copiar asistencia
                  </button>
                </div>
              )}
            </div>

            <div style={card}>
              <h4 style={{ marginTop: 0 }}>📝 Últimos envíos</h4>
              <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                {ultimos.length === 0 && (
                  <li style={{ color: COLORS.textMuted }}>Aún no hay respuestas</li>
                )}
                {ultimos.map((p) => (
                  <li key={p.id}>
                    #{p.numeroLista || "?"} — {p.texto}
                  </li>
                ))}
              </ul>
            </div>

            {/* === ASISTENCIA: panel compacto === */}
            <div style={card}>
              <h4 style={{ marginTop: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>✅ Asistencia</span>
                <button onClick={exportAsistenciaCSV} style={btnTiny} title="Exportar CSV">
                  ⤓ CSV
                </button>
              </h4>

              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>
                Slot: <b>{currentSlotId}</b> · Semana: <b>{yearWeekNow}</b>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    background: "rgba(16,185,129,.08)",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: "8px 10px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#065f46" }}>Presentes</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{asistenciaDedup.length}</div>
                </div>
                <div
                  style={{
                    background: "rgba(59,130,246,.07)",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10,
                    padding: "8px 10px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#1e3a8a" }}>Total esperado</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(+totalEsperado) ? +totalEsperado : 0}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || "0", 10);
                        setTotalEsperado(Number.isFinite(n) ? n : 0);
                        try {
                          localStorage.setItem(totalKey, String(Number.isFinite(n) ? n : 0));
                          localStorage.setItem("ic_asist_total_default", String(Number.isFinite(n) ? n : 0));
                        } catch (_) {}
                      }}
                      style={{ ...input, padding: "4px 6px", fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {Number.isFinite(+totalEsperado) && +totalEsperado > 0 && (
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
                  Cobertura:{" "}
                  <b>
                    {Math.min(100, Math.round((asistenciaDedup.length / Math.max(1, +totalEsperado)) * 100))}
                    %
                  </b>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                <input
                  placeholder="# lista"
                  value={asistManualNum}
                  onChange={(e) => setAsistManualNum(e.target.value)}
                  style={{ ...input, padding: "6px 8px" }}
                />
                <input
                  placeholder="Nombre (opcional)"
                  value={asistManualNom}
                  onChange={(e) => setAsistManualNom(e.target.value)}
                  style={{ ...input, padding: "6px 8px" }}
                />
                <button onClick={marcarAsistenciaManual} style={btnTiny} title="Marcar presente">
                  ➕ Marcar
                </button>
              </div>

              <div style={{ marginTop: 10, maxHeight: 220, overflow: "auto", borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                {asistenciaDedup.length === 0 ? (
                  <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
                    Aún no hay registros. Diles que toquen “Estoy presente” en Participa.
                  </div>
                ) : (
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ padding: "4px 0" }}>#</th>
                        <th style={{ padding: "4px 0" }}>Nombre</th>
                        <th style={{ padding: "4px 0" }}>Hora</th>
                        <th style={{ padding: "4px 0" }}>Via</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistenciaDedup.map((r) => (
                        <tr key={r.id}>
                          <td style={{ padding: "3px 0", borderTop: `1px solid ${COLORS.border}` }}>{r.numeroLista ?? ""}</td>
                          <td style={{ padding: "3px 0", borderTop: `1px solid ${COLORS.border}` }}>{r.nombre ?? ""}</td>
                          <td style={{ padding: "3px 0", borderTop: `1px solid ${COLORS.border}` }}>
                            {r._ts ? new Date(r._ts).toLocaleTimeString() : ""}
                          </td>
                          <td style={{ padding: "3px 0", borderTop: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
                            {r.source || (r.uidAlumno ? "app" : "web")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...card, marginTop: "1rem", textAlign: "center" }}>
          <em style={{ color: COLORS.textMuted }}>
            Espacio reservado para funciones futuras
          </em>
        </div>

        <div
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => {
              const key =
                Array.isArray(oaPlan) && oaPlan.length > 0
                  ? makeSegKey(currentSlotId || "0-0", oaIndex || 0)
                  : makeCountKey(currentSlotId || "0-0");
              const endStr =
                localStorage.getItem(key) || localStorage.getItem(COUNT_KEY);
              const endMs = endStr ? Number(endStr) : 0;
              try { localStorage.setItem("__lastSlotId", currentSlotId || "0-0"); } catch (e) {}
              const ficha = makeFicha();
              persistClaseForDesarrollo({ ficha, slotId: currentSlotId || "0-0", endMs });
              navigate("/desarrollo", {
                state: {
                  slotId: currentSlotId || "0-0",
                  endMs,
                  clase: claseActual || null,
                  ficha,
                  oaPlan: Array.isArray(oaPlan) ? oaPlan : [],
                  oaIndex: Number.isInteger(oaIndex) ? oaIndex : 0,
                },
              });
            }}
            style={btnWhite}
          >
            🚀 Ir a Desarrollo
          </button>
          <button onClick={irAHorario} style={btnWhite}>
            🗓️ Modificar horario
          </button>
          <button onClick={() => navigate("/home")} style={btnWhite}>
            ⬅️ Volver al Inicio
          </button>
        </div>
      </div>
    </GlobalBoundary>
  );
}

export default InicioClase;




