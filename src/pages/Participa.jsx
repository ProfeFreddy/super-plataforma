import React, { useEffect, useMemo, useState } from "react";
import { db, rtdb, auth } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  ref as rRef,
  push as rPush,
  set as rSet,
  onValue as rOnValue,
  serverTimestamp as rServerTimestamp,
} from "firebase/database";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { useLocation, useParams } from "react-router-dom";

/* ───────────────── PRAGMA: frase motivacional ───────────────── */
const PRAGMA_MOTTO = "De un profe para los profes — PRAGMA";

/* ───────────────── Auth: guard liviano (evita pantallas en blanco) ─────────── */
function useAnonReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const off = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth).catch(() => {});
        }
      } finally {
        if (alive) setReady(true);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return ready;
}

/* ───────────────── Helpers URL ───────────────── */
function useQuery() {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search || ""), [loc.search]);
}

function setQueryParams(obj = {}) {
  const url = new URL(window.location.href);
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  });
  window.history.replaceState({}, "", url.toString());
}

function extractSalaFromHash() {
  const h = String(window.location.hash || "");
  const m1 = h.match(/#\/sala\/([^?&#/]+)/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = h.match(/[?&](code|session|pin|p)=([^&#]+)/i);
  if (m2 && m2[2]) return m2[2];
  return "";
}

function sanitizeSalaCode(raw) {
  return String(raw || "")
    .split("?")[0]
    .split("#")
    .pop()
    .split("/")
    .pop()
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "");
}

/* 🔧 Patch robusto: acepta pin desde ruta (/sala/:code o /participa/:code),
     query (?code=, ?pin=, ?p=, ?session=) o incluso dentro del hash. */
function usePin() {
  const { code: pinParam } = useParams();
  const loc = useLocation();
  const q = new URLSearchParams(loc.search || "");

  const fromQuery =
    q.get("code") || q.get("pin") || q.get("p") || q.get("session");

  let fromHash = "";
  if (!fromQuery && loc.hash && loc.hash.includes("?")) {
    const idx = loc.hash.indexOf("?");
    const sub = loc.hash.substring(idx);
    const qh = new URLSearchParams(sub);
    fromHash =
      qh.get("code") || qh.get("pin") || qh.get("p") || qh.get("session");
  }

  return sanitizeSalaCode(pinParam || fromQuery || fromHash || "");
}

/* ───────────────── Estilos ───────────────── */
const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  text: "#0f172a",
  muted: "#475569",
  border: "#e5e7eb",
  white: "#fff",
};

const pageStyle = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  padding: 24,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  color: COLORS.white,
  boxSizing: "border-box",
};
const card = {
  background: COLORS.white,
  color: COLORS.text,
  borderRadius: 12,
  padding: "1rem",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
  border: `1px solid ${COLORS.border}`,
  maxWidth: 900,
  margin: "0 auto",
};
const input = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  outline: "none",
  fontSize: "1rem",
  boxSizing: "border-box",
};
const btn = {
  background: COLORS.white,
  color: COLORS.brandA,
  border: "1px solid " + COLORS.border,
  borderRadius: 10,
  padding: ".6rem .9rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,.08)",
};

/* ───────────────── Utils ───────────────── */
function getDeviceId() {
  try {
    const k = "ic_device_id";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

/* Avatares determinísticos por deviceId (sin elección de usuario todavía) */
const AVATARS = ["🦄", "🐸", "🐱", "🐶", "🐼", "🐧", "🐢", "🐙", "🐻", "🦊"];
function getAvatarForDevice(deviceId) {
  const id = deviceId || "anon";
  let acc = 0;
  for (let i = 0; i < id.length; i++) {
    acc += id.charCodeAt(i);
  }
  return AVATARS[acc % AVATARS.length];
}

/* ───────────────── Componente ───────────────── */
export default function Participa() {
  const ready = useAnonReady(); // <- clave
  const q = useQuery();
  const pinFromRoute = usePin();

  const sessionParam = q.get("session") || "";
  const sessionId = useMemo(
    () => sanitizeSalaCode(sessionParam),
    [sessionParam]
  );
  const hasSessionParam = !!sessionId;

  const rawMode = (q.get("m") || "").toLowerCase();
  const mode =
    rawMode === "asis"
      ? "asis"
      : rawMode === "quiz" || hasSessionParam
      ? "quiz" // ⬅️ modo QUIZ activo si viene ?m=quiz o ?session=
      : "cloud";

  const initialCodeRaw =
    pinFromRoute ||
    q.get("code") ||
    q.get("pin") ||
    q.get("p") ||
    q.get("session") ||
    q.get("sala") ||
    extractSalaFromHash() ||
    "";
  const initialCode = sanitizeSalaCode(initialCodeRaw);
  const initialSlot = q.get("slot") || "";
  const initialYW = q.get("yw") || "";

  const [salaCode, setSalaCode] = useState(initialCode);
  const [slotId, setSlotId] = useState(initialSlot);
  const [yearWeek, setYearWeek] = useState(initialYW);

  /* Sincroniza cambios de la ruta /sala/:code o /participa/:code en caliente */
  useEffect(() => {
    if (pinFromRoute && pinFromRoute !== salaCode) {
      setSalaCode(pinFromRoute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinFromRoute]);

  useEffect(() => {
    const cleaned = sanitizeSalaCode(salaCode);
    if (cleaned !== salaCode) setSalaCode(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pregunta en vivo (modo nube de palabras)
  const [pregunta, setPregunta] = useState("");
  useEffect(() => {
    const ref = doc(db, "preguntaClase", "actual");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setPregunta((snap.exists() && (snap.data()?.texto || "")) || "");
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Prefills (nombre / lista guardados por sala)
  const storageKey = useMemo(() => `part:${salaCode || "nocode"}`, [salaCode]);
  const [numeroLista, setNumeroLista] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return raw.numeroLista || "";
    } catch {
      return "";
    }
  });
  const [nombre, setNombre] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return raw.nombre || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      const data = { numeroLista, nombre };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {}
  }, [numeroLista, nombre, storageKey]);

  // Estado envío / feedback
  const [textWord, setTextWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const canSendWord = salaCode.trim().length > 0 && textWord.trim().length > 0;
  const canSendAsis =
    salaCode.trim().length > 0 && Number.isFinite(parseInt(numeroLista, 10));

  // Últimos (FS principal + fallbacks RTDB rooms/words y legacy salas/palabras)
  const [ultimos, setUltimos] = useState([]);
  useEffect(() => {
    if (!salaCode) return;

    const colRef = collection(db, "salas", salaCode, "palabras");
    let qRef = colRef;
    try {
      qRef = query(colRef, orderBy("timestamp"));
    } catch {}
    const unsubFS = onSnapshot(
      qRef,
      (snap) => {
        const arr = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            ts: d.data()?.timestamp?.toMillis?.() || 0,
          }))
          .filter((x) => (x.texto || "").trim().length > 0)
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5);
        setUltimos(arr);
      },
      () => {}
    );

    // RTDB estándar
    const rPathStd = rRef(rtdb, `rooms/${salaCode}/words`);
    const unsubRT1 = rOnValue(rPathStd, (snap) => {
      const val = snap.val() || {};
      const rows = Object.entries(val).map(([id, v]) => ({
        id,
        texto: v?.texto || v?.t || v?.text || "",
        numeroLista: v?.numeroLista || null,
        ts: typeof v?.ts === "number" ? v.ts : 0,
      }));
      if (rows.length && ultimos.length === 0) {
        setUltimos(
          rows
            .filter((x) => (x.texto || "").trim())
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 5)
        );
      }
    });

    // RTDB legacy (compat)
    const rPathLegacy = rRef(rtdb, `salas/${salaCode}/palabras`);
    const unsubRT2 = rOnValue(rPathLegacy, (snap) => {
      const val = snap.val() || {};
      const rows = Object.entries(val).map(([id, v]) => ({
        id,
        texto: v?.texto || v?.t || v?.text || "",
        numeroLista: v?.numeroLista || null,
        ts: typeof v?.ts === "number" ? v.ts : 0,
      }));
      if (rows.length && ultimos.length === 0) {
        setUltimos(
          rows
            .filter((x) => (x.texto || "").trim())
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 5)
        );
      }
    });

    return () => {
      unsubFS();
      unsubRT1();
      unsubRT2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaCode]);

  // Mantener también el session en la URL para que mode=quiz no se pierda
  useEffect(() => {
    setQueryParams({
      code: salaCode || null,
      m: mode === "asis" ? "asis" : null,
      slot: slotId || null,
      yw: yearWeek || null,
      session: sessionId || null,
    });
  }, [salaCode, mode, slotId, yearWeek, sessionId]);

  // Anti-spam 8s (para nube de palabras)
  const canSendNow = () => {
    const k = `lastSend:${salaCode}`;
    const last = Number(localStorage.getItem(k) || 0);
    return Date.now() - last > 8000;
  };
  const markSend = () => {
    try {
      localStorage.setItem(`lastSend:${salaCode}`, String(Date.now()));
    } catch {}
  };

  const enviarPalabra = async () => {
    if (!canSendWord) return;
    if (!canSendNow()) {
      setMsg({
        type: "warn",
        text: "Espera unos segundos antes de enviar otra palabra.",
      });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const clean = String(textWord || "").trim();
      const payloadFS = {
        texto: clean,
        numeroLista: Number.isFinite(+numeroLista) ? +numeroLista : null,
        nombre: (nombre || "").trim() || null,
        deviceId: getDeviceId(),
        slotId: slotId || null,
        yw: yearWeek || null,
        timestamp: serverTimestamp(),
      };
      const refFS = doc(collection(db, "salas", salaCode, "palabras"));
      await setDoc(refFS, payloadFS, { merge: true });

      const payloadRT = {
        texto: clean,
        numeroLista: Number.isFinite(+numeroLista) ? +numeroLista : null,
        nombre: (nombre || "").trim() || null,
        deviceId: getDeviceId(),
        slotId: slotId || null,
        yw: yearWeek || null,
        ts: Date.now(),
        serverTs: rServerTimestamp(),
      };

      // RTDB estándar
      try {
        const refRT1 = rRef(rtdb, `rooms/${salaCode}/words`);
        await rSet(rPush(refRT1), payloadRT);
      } catch {}
      // RTDB legacy (compatibilidad)
      try {
        const refRT2 = rRef(rtdb, `salas/${salaCode}/palabras`);
        await rSet(rPush(refRT2), payloadRT);
      } catch {}

      setTextWord("");
      markSend();
      setMsg({ type: "ok", text: "¡Enviado! Gracias por participar." });
    } catch {
      setMsg({
        type: "err",
        text: "No se pudo enviar. Revisa tu conexión e inténtalo otra vez.",
      });
    } finally {
      setLoading(false);
    }
  };

  const marcarAsistencia = async () => {
    if (!(salaCode && Number.isFinite(parseInt(numeroLista, 10)))) {
      setMsg({
        type: "warn",
        text: "Ingresa tu número de lista (y tu nombre si es posible).",
      });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const payloadCommon = {
        numeroLista: parseInt(numeroLista, 10),
        nombre: (nombre || "").trim() || null,
        slotId: slotId || null,
        yw: yearWeek || null,
        source: "web",
        deviceId: getDeviceId(),
      };
      const refAsis = doc(collection(db, "salas", salaCode, "asistencia"));
      await setDoc(
        refAsis,
        { ...payloadCommon, ts: serverTimestamp(), timestamp: serverTimestamp() },
        { merge: true }
      );
      const refPres = doc(collection(db, "salas", salaCode, "presentes"));
      await setDoc(
        refPres,
        { ...payloadCommon, ts: serverTimestamp(), timestamp: serverTimestamp() },
        { merge: true }
      );
      const presRT = rRef(rtdb, `salas/${salaCode}/presentes`);
      await rSet(rPush(presRT), {
        ...payloadCommon,
        ts: Date.now(),
        serverTs: rServerTimestamp(),
      });

      setMsg({ type: "ok", text: "¡Listo! Tu asistencia ha sido registrada." });
    } catch {
      setMsg({
        type: "err",
        text: "No pudimos registrar tu asistencia. Inténtalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ───────────────── QUIZ Carrera PRAGMA (modo Kahoot) ───────────────── */
  const [quizMeta, setQuizMeta] = useState(null);
  const [quizAnswer, setQuizAnswer] = useState(null); // { rondaKey, idx, correcta }
  const [quizSending, setQuizSending] = useState(false);

  // Registrar/actualizar participante con avatar cuando está en modo quiz
  useEffect(() => {
    if (mode !== "quiz") return;
    const code = sessionId || salaCode;
    if (!code) return;

    const pid = getDeviceId();
    const avatar = getAvatarForDevice(pid);

    const payloadPart = {
      pid,
      deviceId: pid,
      nombre: (nombre || "").trim() || null,
      numeroLista: Number.isFinite(+numeroLista) ? +numeroLista : null,
      salaCode: salaCode || null,
      session: sessionId || null,
      avatar,
      updatedAt: serverTimestamp(),
    };

    const refPart = doc(db, "carrera", "actual", "participantes", pid);
    setDoc(refPart, payloadPart, { merge: true }).catch(() => {});
  }, [mode, salaCode, sessionId, nombre, numeroLista]);

  // Escucha el estado de la carrera solo en modo quiz
  useEffect(() => {
    if (mode !== "quiz") {
      setQuizMeta(null);
      return;
    }

    // 🔗 Nueva integración: usamos la carrera global en
    // colección "carrera/actual/meta/pregunta" (igual que CierreClase)
    const ref = doc(db, "carrera", "actual", "meta", "pregunta");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setQuizMeta(null);
          return;
        }
        const d = snap.data() || {};
        const startAt = d.startAt;
        const startAtMs = startAt?.toMillis?.() || null;

        let estado = "esperando";
        if (!d.texto) {
          estado = "esperando";
        } else if (d.activa) {
          estado = "pregunta";
        } else {
          estado = "resultados";
        }

        setQuizMeta({
          pregunta: d.texto || "",
          opciones: Array.isArray(d.opciones) ? d.opciones.slice(0, 4) : [],
          estado,
          correctIndex: typeof d.correcta === "number" ? d.correcta : null,
          startAtMs,
          rondaKey: startAtMs || 0,
        });
      },
      () => {
        setQuizMeta(null);
      }
    );
    return () => unsub();
  }, [mode]);

  // Cuando cambia la ronda (clave = startAtMs), limpiamos respuesta local
  useEffect(() => {
    if (!quizMeta) return;
    const key = `quizAnswer:${sessionId || salaCode}:${quizMeta.rondaKey || 0}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setQuizAnswer(parsed);
      } else {
        setQuizAnswer(null);
      }
    } catch {
      setQuizAnswer(null);
    }
  }, [quizMeta, salaCode, sessionId]);

  const marcarRespuestaLocal = (info) => {
    if (!quizMeta) return;
    const key = `quizAnswer:${sessionId || salaCode}:${quizMeta.rondaKey || 0}`;
    try {
      localStorage.setItem(key, JSON.stringify(info));
    } catch {}
    setQuizAnswer(info);
  };

  const responderOpcion = async (idx) => {
    if (!quizMeta || quizMeta.estado !== "pregunta") return;
    if (!salaCode && !sessionId) return;
    if (quizSending) return;

    const rondaKey = quizMeta.rondaKey || quizMeta.startAtMs || 0;
    const yaRespondioEstaRonda =
      quizAnswer && quizAnswer.rondaKey === rondaKey;
    if (yaRespondioEstaRonda) {
      setMsg({
        type: "warn",
        text: "Ya enviaste tu respuesta en esta ronda.",
      });
      return;
    }

    setQuizSending(true);
    setMsg(null);
    try {
      const now = Date.now();
      const startMs = quizMeta.startAtMs || null;
      const latencyMs = startMs ? Math.max(0, now - startMs) : null;

      const opciones = Array.isArray(quizMeta.opciones)
        ? quizMeta.opciones
        : [];
      const answerStr =
        opciones[idx] !== undefined && opciones[idx] !== null
          ? String(opciones[idx])
          : String(idx);

      const correcta =
        typeof quizMeta.correctIndex === "number" &&
        quizMeta.correctIndex === idx;

      const pid = getDeviceId();
      const avatar = getAvatarForDevice(pid);

      const payload = {
        // Identificación participante
        pid,
        deviceId: pid,
        avatar,
        nombre: (nombre || "").trim() || null,
        numeroLista: Number.isFinite(+numeroLista) ? +numeroLista : null,

        // Contexto de la carrera
        salaCode: salaCode || null,
        session: sessionId || salaCode || null,
        slotId: slotId || null,
        yw: yearWeek || null,

        // Info de la ronda
        rondaKey,
        rondaKeyStr: String(rondaKey),
        idx, // índice de opción elegida
        opcionIndex: idx,
        answerIndex: idx,

        // Respuesta en texto y banderas
        answer: answerStr,
        respuesta: answerStr,
        correcta,
        esCorrecta: correcta,
        correctIndex:
          typeof quizMeta.correctIndex === "number"
            ? quizMeta.correctIndex
            : null,

        // Tiempos
        latencyMs: latencyMs ?? null,
        createdAt: serverTimestamp(),
      };

      // 🔗 Enviamos a la misma colección que lee y puntúa CierreClase
      const refResp = doc(
        collection(db, "carrera", "actual", "respuestas")
      );
      await setDoc(refResp, payload, { merge: true });

      marcarRespuestaLocal({
        rondaKey,
        idx,
        correcta,
      });

      setMsg({
        type: "ok",
        text: correcta
          ? "✅ ¡Respuesta correcta! Espera los resultados de la ronda."
          : "Respuesta enviada. Espera los resultados de la ronda.",
      });
    } catch {
      setMsg({
        type: "err",
        text: "No pudimos enviar tu respuesta. Inténtalo nuevamente.",
      });
    } finally {
      setQuizSending(false);
    }
  };

  /* ───────────────── Render ───────────────── */
  if (!ready) {
    return (
      <div style={pageStyle}>
        <div style={{ ...card, textAlign: "center" }}>
          Iniciando… (autenticando de forma anónima)
        </div>
      </div>
    );
  }

  const contentHeader = (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,255,255,.5)",
        display: "grid",
        gap: 8,
      }}
    >
      {/* Frase PRAGMA */}
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
        {PRAGMA_MOTTO}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Código de sala
          </div>
          <input
            style={input}
            placeholder="Ej: 3WL8UX"
            value={salaCode}
            onChange={(e) => setSalaCode(sanitizeSalaCode(e.target.value))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}># de lista</div>
          <input
            style={input}
            placeholder="Ej: 12"
            inputMode="numeric"
            value={numeroLista}
            onChange={(e) => setNumeroLista(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Tu nombre (opcional)
          </div>
          <input
            style={input}
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Slot (opcional)
          </div>
          <input
            style={input}
            placeholder="0-0"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Año-Semana (opcional)
          </div>
          <input
            style={input}
            placeholder="YYYY-WW"
            value={yearWeek}
            onChange={(e) => setYearWeek(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // Mensaje minimal si falta código
  const MissingCode = (
    <div style={{ ...card, textAlign: "left" }}>
      <h2 style={{ marginTop: 0 }}>Falta el código de sala</h2>
      <p>
        Puedes abrir con <code>/participa?session=3WL8UX</code> o con{" "}
        <code>#/sala/3WL8UX</code> y el código quedará pre-llenado.
      </p>
    </div>
  );

  const QuizUI = (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>🏁 Carrera PRAGMA</h2>
      <p style={{ color: COLORS.muted, marginTop: 0 }}>
        Responde rápido desde tu celular. El profesor controla las rondas.
      </p>

      {!quizMeta ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#f8fafc",
            border: `1px dashed ${COLORS.border}`,
          }}
        >
          Esperando a que el profesor inicie la carrera…
        </div>
      ) : quizMeta.estado === "esperando" ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#f8fafc",
            border: `1px dashed ${COLORS.border}`,
          }}
        >
          El profesor todavía no ha lanzado la pregunta de esta ronda.
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderLeft: "4px solid " + COLORS.brandA,
              background: "#f8fafc",
              borderRadius: 8,
              color: COLORS.text,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: COLORS.muted,
                marginBottom: 2,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Pregunta de la carrera</span>
              <span>Ronda en curso</span>
            </div>
            <div style={{ fontWeight: 700 }}>
              {quizMeta.pregunta || "Esperando pregunta…"}
            </div>
          </div>

          {quizMeta.estado === "pregunta" && quizMeta.opciones.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {quizMeta.opciones.map((opt, idx) => {
                const isSelected =
                  quizAnswer &&
                  quizAnswer.rondaKey === (quizMeta.rondaKey || 0) &&
                  quizAnswer.idx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => responderOpcion(idx)}
                    disabled={quizSending || !salaCode}
                    style={{
                      ...btn,
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: isSelected ? "#e0f2fe" : COLORS.white,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "999px",
                        border: "1px solid " + COLORS.border,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {["A", "B", "C", "D"][idx] || "?"}
                    </span>
                    <span>{opt || "(sin texto)"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {quizMeta.estado === "resultados" && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#ecfdf3",
                border: "1px solid #bbf7d0",
                color: "#166534",
              }}
            >
              El profesor está mostrando los resultados de la ronda. Prepárate
              para la siguiente pregunta.
            </div>
          )}
        </>
      )}
    </div>
  );

  const CloudUI = (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>💬 Responde</h2>

      <div
        style={{
          marginBottom: 10,
          padding: "8px 10px",
          borderLeft: "4px solid " + COLORS.brandA,
          background: "#f8fafc",
          borderRadius: 8,
          color: COLORS.text,
        }}
      >
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 2 }}>
          Pregunta del profesor
        </div>
        <div style={{ fontWeight: 700 }}>
          {pregunta || "¿Cuál palabra representa mejor la última clase?"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <input
          style={input}
          placeholder="Escribe una palabra…"
          value={textWord}
          onChange={(e) => setTextWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviarPalabra();
          }}
        />
        <button
          disabled={!canSendWord || loading || !salaCode}
          onClick={enviarPalabra}
          style={{
            ...btn,
            background:
              !canSendWord || loading || !salaCode ? "#f1f5f9" : COLORS.white,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Últimos envíos</div>
        {/* lista compacta */}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(ultimos || []).map((r) => (
            <li key={r.id}>
              {r.texto}{" "}
              <span style={{ color: COLORS.muted }}>
                {r.numeroLista ? `( #${r.numeroLista} )` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const AsistenciaUI = (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>🟢 Asistencia</h2>
      <p style={{ color: COLORS.muted, marginTop: 0 }}>
        Presiona el botón para registrar tu asistencia. Asegúrate de haber
        ingresado tu <b>número de lista</b>.
      </p>
      <button
        disabled={!canSendAsis || loading || !salaCode}
        onClick={marcarAsistencia}
        style={{
          ...btn,
          background:
            !canSendAsis || loading || !salaCode ? "#f1f5f9" : COLORS.white,
        }}
      >
        {loading ? "Marcando..." : "Estoy presente"}
      </button>
      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 12 }}>
        Consejo: guarda el código de la sala para no escribirlo cada vez.
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={{ ...card, marginBottom: 16 }}>
        <h1 style={{ marginTop: 0 }}>Participa</h1>
        <p style={{ marginTop: 4, color: COLORS.muted }}>
          Vista de participación.
        </p>

        {contentHeader}

        {msg && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border:
                msg.type === "ok"
                  ? "1px solid #bbf7d0"
                  : msg.type === "warn"
                  ? "1px solid #fde68a"
                  : "1px solid #fecaca",
              background:
                msg.type === "ok"
                  ? "rgba(16,185,129,.08)"
                  : msg.type === "warn"
                  ? "rgba(245,158,11,.08)"
                  : "rgba(239,68,68,.08)",
              color:
                msg.type === "ok"
                  ? "#065f46"
                  : msg.type === "warn"
                  ? "#92400e"
                  : "#7f1d1d",
            }}
          >
            {msg.text}
          </div>
        )}
      </div>

      {!salaCode
        ? MissingCode
        : mode === "asis"
        ? AsistenciaUI
        : mode === "quiz"
        ? QuizUI
        : CloudUI}

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: COLORS.muted }}>
          Código de dispositivo: <code>{getDeviceId().slice(0, 8)}</code>
        </div>
      </div>
    </div>
  );
}
