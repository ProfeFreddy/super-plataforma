// src/pages/CierreClase.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import QRCode from "react-qr-code";

import { auth, db } from "../firebase";
import CronometroGlobal from "../components/CronometroGlobal";
import DesarrolloHeader from "../components/desarrollo/DesarrolloHeader";
import {
  claseEsValida,
  construirUrlGincana,
  leerSesionClase,
  limpiarSesionClase,
  normalizeClase,
} from "../services/ClaseActivaService";

const COLORS = {
  bg1: "#0e7490",
  bg2: "#67e8f9",
  ink: "#0f172a",
  muted: "#475569",
  card: "#ffffff",
  border: "#dbeafe",
  soft: "#f0f9ff",
  accent: "#0284c7",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
  violet: "#7c3aed",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, ${COLORS.bg1}, ${COLORS.bg2})`,
  color: COLORS.ink,
  padding: "2rem",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const shell = { maxWidth: 1280, margin: "0 auto" };

function clean(v, fallback = "") {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  if (/^\(sin /i.test(s)) return fallback;
  if (/^sin /i.test(s)) return fallback;
  if (/undefined|null/i.test(s)) return fallback;
  return s;
}

function isMissing(v) {
  const s = String(v ?? "").trim();
  return !s || /^\(sin /i.test(s) || /^sin /i.test(s) || /undefined|null/i.test(s);
}

function readJsonLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || null;
  } catch {
    return null;
  }
}

function getInitialClase(location) {
  const fromState = location?.state?.clase || location?.state?.specialData || null;
  const pragma = readJsonLS("__pragmaClaseActual");
  const cierre = readJsonLS("bridge:cierreClase");
  const desarrollo = readJsonLS("bridge:desarrolloClase");
  return fromState || cierre || desarrollo || pragma || {};
}

function getSalaCode(initial) {
  try {
    return (
      clean(initial.salaCode, "") ||
      clean(localStorage.getItem("salaCode"), "") ||
      clean(localStorage.getItem("__salaCode"), "") ||
      "00000"
    );
  } catch {
    return "00000";
  }
}

function useAuthSafe() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(auth.currentUser || null);

  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) {
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUser(cred.user || null);
          try {
            if (cred.user?.uid) localStorage.setItem("uid", cred.user.uid);
          } catch {}
        } else {
          setUser(u);
          try {
            if (u?.uid) localStorage.setItem("uid", u.uid);
          } catch {}
        }
      } catch (err) {
        console.warn("[CierreClase] Auth anónima no disponible:", err?.message || err);
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    });
    const t = setTimeout(() => alive && setReady(true), 1800);
    return () => {
      alive = false;
      clearTimeout(t);
      unsub && unsub();
    };
  }, []);

  return { ready, user };
}

function cardStyle(extra = {}) {
  return {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 26,
    padding: 22,
    boxShadow: "0 18px 38px rgba(15,23,42,.10)",
    ...extra,
  };
}

function sectionTitle(icon, title, subtitle) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>{icon} {title}</h2>
      {subtitle ? <p style={{ margin: "6px 0 0", color: COLORS.muted, fontWeight: 650 }}>{subtitle}</p> : null}
    </div>
  );
}

function makeTicketQuestions(clase) {
  const tema = clean(clase.unidad, "el tema de la clase");
  const objetivo = clean(clase.objetivo, "el objetivo trabajado");
  return [
    `Explica con tus palabras qué aprendiste hoy sobre ${tema}.`,
    `¿Cómo se relaciona el objetivo de la clase con un ejemplo real o cotidiano?`,
    `Resuelve o describe una aplicación breve de: ${objetivo}`,
  ];
}

function makeResumenDocente(clase, conectados, respuestas) {
  const n = Number(conectados || 0);
  const r = Number(respuestas || 0);
  return `Clase cerrada con evidencia real: se trabajó ${clase.unidad}, asociado a ${clase.oa}, con foco en ${clase.habilidades}. Participación registrada: ${n} conectado(s) y ${r} envío(s).`;
}

function safeGincanaUrl(clase) {
  const params = new URLSearchParams();
  if (clase.curso) params.set("curso", clase.curso);
  if (clase.asignatura) params.set("asignatura", clase.asignatura);
  if (clase.unidad) params.set("unidad", clase.unidad);
  if (clase.oa) params.set("oa", clase.oa);
  if (clase.salaCode) params.set("sala", clase.salaCode);
  return `https://juego.pragmaprofe.com/#/gincana?${params.toString()}`;
}

function CierreRightPanel({ clase, conectados, respuestas }) {
  const gincanaUrl = clase?.gincanaUrl || safeGincanaUrl(clase);
  return (
    <div style={cardStyle()}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>🎯 Evaluación final</h2>
        <p style={{ margin: "8px 0 16px", color: COLORS.muted, fontWeight: 700 }}>
          Cierra la clase con evidencia y luego evalúa jugando.
        </p>
        <CronometroGlobal minutos={10} label="Cronómetro de cierre" />
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: COLORS.soft, borderRadius: 18, padding: 14, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{conectados}</div>
          <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 900 }}>Conectados</div>
        </div>
        <div style={{ background: COLORS.soft, borderRadius: 18, padding: 14, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{respuestas}</div>
          <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 900 }}>Evidencias</div>
        </div>
      </div>

      <div style={{ marginTop: 18, background: "linear-gradient(135deg,#fef3c7,#fff7ed)", border: "1px solid #fed7aa", borderRadius: 22, padding: 16 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>🕹️ GincanaNexus</div>
        <p style={{ margin: "8px 0 14px", color: COLORS.muted, fontWeight: 650 }}>
          Usa el juego para transformar el cierre en evaluación activa.
        </p>
        <a
          href={gincanaUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: "14px 16px",
            fontWeight: 950,
            boxShadow: "0 14px 28px rgba(15,23,42,.22)",
          }}
        >
          🚀 Evaluar con GincanaNexus
        </a>
      </div>
    </div>
  );
}

function ResumenClase({ clase, conectados, respuestas }) {
  const resumen = makeResumenDocente(clase, conectados, respuestas);
  return (
    <section style={cardStyle()}>
      {sectionTitle("📌", "Resumen automático de la clase", "Una síntesis lista para explicar, guardar o mostrar al jurado.")}
      <div style={{ background: "linear-gradient(135deg,#f8fafc,#e0f2fe)", borderRadius: 20, padding: 18, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, fontWeight: 750 }}>{resumen}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <MiniMetric label="Unidad" value={clase.unidad} />
        <MiniMetric label="Objetivo" value={clase.oa} />
        <MiniMetric label="Habilidades" value={clase.habilidades} />
      </div>
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={{ background: COLORS.soft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
      <div style={{ color: COLORS.muted, fontSize: 12, letterSpacing: 1, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function TicketSalida({ clase }) {
  const questions = makeTicketQuestions(clase);
  return (
    <section style={cardStyle()}>
      {sectionTitle("🎟️", "Ticket de salida", "Tres preguntas para comprobar aprendizaje antes de terminar.")}
      <div style={{ display: "grid", gap: 12 }}>
        {questions.map((q, i) => (
          <div key={q} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12, alignItems: "center", background: COLORS.soft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 999, background: "#0f172a", color: "white", display: "grid", placeItems: "center", fontWeight: 950 }}>{i + 1}</div>
            <div style={{ fontWeight: 850, lineHeight: 1.4 }}>{q}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvaluarConGincana({ clase }) {
  const gincanaUrl = clase?.gincanaUrl || safeGincanaUrl(clase);
  return (
    <section style={cardStyle({ background: "linear-gradient(135deg,#111827,#312e81)", color: "white", border: "1px solid rgba(255,255,255,.18)" })}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 22, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,.12)", padding: "6px 12px", borderRadius: 999, fontWeight: 950, marginBottom: 12 }}>
            🕹️ Evaluación gamificada
          </div>
          <h2 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1.03 }}>Evaluar con GincanaNexus</h2>
          <p style={{ margin: "12px 0 18px", color: "#ddd6fe", fontSize: 18, lineHeight: 1.5 }}>
            Convierte el cierre en una misión: los estudiantes responden, compiten, colaboran y dejan evidencia. Aquí PragmaProfe deja de ser plataforma y se vuelve experiencia.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a href={gincanaUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: "#fbbf24", color: "#111827", padding: "14px 18px", borderRadius: 16, fontWeight: 950 }}>
              🚀 Abrir GincanaNexus
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(gincanaUrl).catch(() => {})}
              style={{ border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.12)", color: "white", padding: "14px 18px", borderRadius: 16, fontWeight: 950, cursor: "pointer" }}
            >
              🔗 Copiar enlace
            </button>
          </div>
        </div>
        <div style={{ background: "white", padding: 16, borderRadius: 20, textAlign: "center" }}>
          <QRCode value={gincanaUrl} size={180} />
          <div style={{ color: COLORS.ink, fontWeight: 900, marginTop: 10, fontSize: 13 }}>QR del juego</div>
        </div>
      </div>
    </section>
  );
}

function EvidenciasFinales({ conectados, respuestas, ultimoEnvio, salaCode }) {
  return (
    <section style={cardStyle()}>
      {sectionTitle("📊", "Evidencias finales", "Participación, nube final y respuestas listas para respaldar el aprendizaje.")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <MiniMetric label="Sala" value={salaCode || "00000"} />
        <MiniMetric label="Conectados" value={String(conectados || 0)} />
        <MiniMetric label="Respuestas" value={String(respuestas || 0)} />
      </div>
      <div style={{ marginTop: 14, background: COLORS.soft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 16, minHeight: 90 }}>
        <div style={{ color: COLORS.muted, fontWeight: 900, marginBottom: 6 }}>Última evidencia recibida</div>
        <div style={{ fontWeight: 850 }}>{ultimoEnvio || "Aún no hay evidencias finales. Puedes cerrar con el ticket de salida o abrir GincanaNexus."}</div>
      </div>
    </section>
  );
}

function MensajeDocente({ clase }) {
  return (
    <section style={cardStyle({ background: "linear-gradient(135deg,#ecfeff,#f0fdf4)" })}>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>✅ Clase cerrada con evidencia real</h2>
      <p style={{ margin: "10px 0 0", color: COLORS.muted, fontSize: 18, lineHeight: 1.55, fontWeight: 700 }}>
        El profesor no termina la clase “al ojo”. Termina con objetivo trabajado, preguntas de salida, participación registrada y una evaluación gamificada lista para activar en GincanaNexus.
      </p>
      <div style={{ marginTop: 14, display: "inline-flex", padding: "10px 14px", borderRadius: 999, background: "white", border: `1px solid ${COLORS.border}`, fontWeight: 950 }}>
        {clase.asignatura} · {clase.curso} · {clase.unidad}
      </div>
    </section>
  );
}

export default function CierreClase({ duracion = 10 }) {
  const navigate = useNavigate();
  const location = useLocation();

  const initial = useMemo(
    () => normalizeClase(location.state?.clase || leerSesionClase() || {}),
    [location.state]
  );

  const [clase, setClase] = useState(initial);
  const [conectados, setConectados] = useState(0);
  const [respuestas, setRespuestas] = useState(0);
  const [ultimoEnvio, setUltimoEnvio] = useState("");
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    setClase(normalizeClase(location.state?.clase || leerSesionClase() || {}));
  }, [location.key, location.state]);

  useEffect(() => {
    if (!claseEsValida(clase) || !clase.salaCode) return undefined;

    const unsubAsistencia = onSnapshot(
      collection(db, "salas", clase.salaCode, "asistencia"),
      (snap) => setConectados(snap.size),
      (e) => console.warn("[Cierre asistencia]", e?.code || e)
    );

    const unsubPalabras = onSnapshot(
      collection(db, "salas", clase.salaCode, "palabras"),
      (snap) => {
        setRespuestas(snap.size);
        const last = snap.docs.at(-1)?.data?.() || null;
        setUltimoEnvio(last?.texto || last?.text || "");
      },
      (e) => console.warn("[Cierre evidencias]", e?.code || e)
    );

    return () => {
      unsubAsistencia();
      unsubPalabras();
    };
  }, [clase.salaCode]);

  const gincanaUrl = useMemo(
    () => (claseEsValida(clase) ? construirUrlGincana(clase) : ""),
    [clase]
  );

  const cerrarClase = async () => {
    if (!claseEsValida(clase) || clase.soloDemo) return;
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid) return;

    try {
      setCerrando(true);
      const id = clase.sessionId || `${Date.now()}`;
      await setDoc(
        doc(db, "cierres_clase", uid, "items", id),
        {
          clase,
          conectados,
          respuestas,
          tieneEvidencia: respuestas > 0,
          resumen: makeResumenDocente(clase, conectados, respuestas),
          closedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("[CierreClase]", e?.code || e);
    } finally {
      setCerrando(false);
    }
  };

  const nuevaClase = () => {
    limpiarSesionClase();
    navigate("/InicioClase", { replace: true });
  };

  if (!claseEsValida(clase)) {
    return (
      <main style={{ ...page, display: "grid", placeItems: "center" }}>
        <div style={{ ...cardStyle(), maxWidth: 700, textAlign: "center" }}>
          <h1>No hay una clase válida para cerrar</h1>
          <p style={{ color: COLORS.muted }}>
            Cierre no recuperará datos antiguos. Vuelve a InicioClase y abre la clase vigente.
          </p>
          <button
            type="button"
            onClick={() => navigate("/InicioClase")}
            style={{ border: 0, borderRadius: 16, padding: "14px 18px", background: "#0284c7", color: "white", fontWeight: 950, cursor: "pointer" }}
          >
            Volver a InicioClase
          </button>
        </div>
      </main>
    );
  }

  const rightSlot = (
    <CierreRightPanel clase={clase} conectados={conectados} respuestas={respuestas} />
  );

  return (
    <div style={page}>
      <main style={shell}>
        {clase.soloDemo ? (
          <div style={{ marginBottom: 14, borderRadius: 16, padding: 14, background: COLORS.violet, color: "white", fontWeight: 950, textAlign: "center" }}>
            🧪 SOLO DEMO · Este cierre no modifica datos reales
          </div>
        ) : null}

        <DesarrolloHeader clase={clase} fase="cierre" rightSlot={rightSlot} />

        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <ResumenClase clase={clase} conectados={conectados} respuestas={respuestas} />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
            <TicketSalida clase={clase} />
            <EvidenciasFinales
              conectados={conectados}
              respuestas={respuestas}
              ultimoEnvio={ultimoEnvio}
              salaCode={clase.salaCode}
            />
          </div>

          <EvaluarConGincana clase={{ ...clase, gincanaUrl }} />
          <MensajeDocente clase={clase} />

          <section style={{ ...cardStyle(), background: respuestas > 0 ? "#ecfdf5" : "#fff7ed" }}>
            <h2>{respuestas > 0 ? "✅ Clase lista para cerrar con evidencia real" : "🟡 Clase lista para cerrar, sin evidencia final"}</h2>
            <p>
              {respuestas > 0
                ? "La sesión cuenta con respuestas registradas."
                : "No se afirmará que existe evidencia hasta recibir respuestas reales."}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate("/desarrollo", { state: { clase } })}
                style={{ border: `1px solid ${COLORS.border}`, background: "white", color: COLORS.accent, padding: "12px 16px", borderRadius: 14, fontWeight: 950, cursor: "pointer" }}
              >
                ← Volver a Desarrollo
              </button>

              {!clase.soloDemo ? (
                <button
                  type="button"
                  onClick={cerrarClase}
                  disabled={cerrando}
                  style={{ border: 0, background: respuestas > 0 ? COLORS.green : COLORS.amber, color: "white", padding: "12px 18px", borderRadius: 14, fontWeight: 950, cursor: "pointer" }}
                >
                  {cerrando ? "Guardando…" : "Guardar cierre"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={nuevaClase}
                style={{ border: `1px solid ${COLORS.border}`, background: "white", color: COLORS.accent, padding: "12px 16px", borderRadius: 14, fontWeight: 950, cursor: "pointer" }}
              >
                Nueva clase / volver al inicio
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}