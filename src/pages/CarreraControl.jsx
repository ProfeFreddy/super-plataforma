// src/pages/CarreraControl.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const COLORS = {
  brandA: "#2563eb",
  brandB: "#38bdf8",
  text: "#0f172a",
  muted: "#475569",
  border: "#e5e7eb",
  white: "#fff",
};

const pageStyle = {
  minHeight: "100vh",
  background: `radial-gradient(circle at top, ${COLORS.brandB}, ${COLORS.brandA})`,
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
  boxShadow: "0 6px 18px rgba(16,24,40,.10), 0 2px 8px rgba(15,23,42,.08)",
  border: `1px solid ${COLORS.border}`,
  maxWidth: 1080,
  margin: "0 auto",
};

const input = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  outline: "none",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const btn = {
  borderRadius: 999,
  padding: "0.55rem 1.1rem",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.9rem",
};

function useSearchParams() {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search || ""), [loc.search]);
}

function sanitizeCode(raw) {
  return String(raw || "")
    .split("?")[0]
    .split("#")
    .pop()
    .split("/")
    .pop()
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "");
}

export default function CarreraControl() {
  const q = useSearchParams();
  const initialCode = sanitizeCode(q.get("session") || q.get("code") || "");

  const [sessionId, setSessionId] = useState(initialCode);
  const [pregunta, setPregunta] = useState("");
  const [opciones, setOpciones] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [estado, setEstado] = useState("esperando");
  const [ronda, setRonda] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // 🔥 IA
  const [iaContexto, setIaContexto] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  // Escucha estado de la carrera
  useEffect(() => {
    if (!sessionId) {
      setEstado("esperando");
      setRonda(0);
      setAnswers([]);
      return;
    }
    const ref = doc(db, "carreras", sessionId);
    const unsubDoc = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() || {};
        setPregunta(d.pregunta || "");
        setOpciones(
          Array.isArray(d.opciones) ? d.opciones.slice(0, 4) : ["", "", "", ""]
        );
        setCorrectIndex(
          typeof d.correctIndex === "number" ? d.correctIndex : 0
        );
        setEstado(d.estado || "esperando");
        setRonda(typeof d.ronda === "number" ? d.ronda : 0);
      },
      () => {}
    );

    // Respuestas para ranking
    const respCol = collection(db, "carreras", sessionId, "respuestas");
    const qResp = query(respCol, orderBy("ts"));
    const unsubResp = onSnapshot(
      qResp,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAnswers(arr);
      },
      () => {
        setAnswers([]);
      }
    );

    return () => {
      unsubDoc();
      unsubResp();
    };
  }, [sessionId]);

  const ranking = useMemo(() => {
    const map = new Map();
    for (const a of answers) {
      const key =
        a.numeroLista != null
          ? `#${a.numeroLista}`
          : (a.nombre && a.nombre.trim()) ||
            (a.deviceId || "").slice(0, 6) ||
            "?";
      if (!map.has(key)) {
        map.set(key, {
          key,
          nombre: a.nombre || null,
          correctas: 0,
          total: 0,
          puntos: 0,
        });
      }
      const row = map.get(key);
      row.total += 1;
      if (a.correcta) {
        row.correctas += 1;
        row.puntos += 1000; // simple: 1000 puntos por acierto
      }
    }
    return Array.from(map.values()).sort((a, b) => b.puntos - a.puntos);
  }, [answers]);

  const respuestasRondaActual = useMemo(() => {
    if (!ronda) return [];
    return answers.filter((a) => (a.ronda || 0) === ronda);
  }, [answers, ronda]);

  const lanzarPregunta = async () => {
    if (!sessionId) {
      setMsg({
        type: "warn",
        text: "Primero define el código de sesión (PIN) de la carrera.",
      });
      return;
    }
    if (!pregunta.trim()) {
      setMsg({ type: "warn", text: "Escribe la pregunta antes de lanzar la ronda." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const ref = doc(db, "carreras", sessionId);
      const nuevaRonda = (ronda || 0) + 1;
      await setDoc(
        ref,
        {
          pregunta: pregunta.trim(),
          opciones: opciones.map((o) => o.trim()),
          correctIndex: correctIndex ?? 0,
          estado: "pregunta",
          ronda: nuevaRonda,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setRonda(nuevaRonda);
      setMsg({
        type: "ok",
        text: `Ronda #${nuevaRonda} lanzada. Los estudiantes ya pueden responder.`,
      });
    } catch (err) {
      console.error(err);
      setMsg({
        type: "err",
        text: "No se pudo lanzar la ronda. Revisa tu conexión.",
      });
    } finally {
      setSaving(false);
    }
  };

  const mostrarResultados = async () => {
    if (!sessionId) return;
    setSaving(true);
    setMsg(null);
    try {
      const ref = doc(db, "carreras", sessionId);
      await setDoc(
        ref,
        {
          estado: "resultados",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMsg({
        type: "ok",
        text: "Mostrando resultados de la ronda en las pantallas conectadas.",
      });
    } catch (err) {
      console.error(err);
      setMsg({
        type: "err",
        text: "No se pudieron actualizar los resultados.",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetearCarrera = async () => {
    if (!sessionId) return;
    setSaving(true);
    setMsg(null);
    try {
      const ref = doc(db, "carreras", sessionId);
      await setDoc(
        ref,
        {
          estado: "esperando",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMsg({
        type: "ok",
        text: "Carrera en estado 'esperando'. Puedes preparar la siguiente pregunta.",
      });
    } catch (err) {
      console.error(err);
      setMsg({
        type: "err",
        text: "No se pudo resetear la carrera.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOptionChange = (idx, value) => {
    setOpciones((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  /* ───────────────── IA: genera pregunta + opciones ───────────────── */
  const generarConIA = async () => {
    if (!sessionId) {
      setMsg({
        type: "warn",
        text: "Define primero el código de sesión (PIN) para la carrera.",
      });
      return;
    }
    if (!iaContexto.trim()) {
      setMsg({
        type: "warn",
        text: "Escribe un contexto (objetivo, contenido de la clase, etc.) para que la IA pueda generar la pregunta.",
      });
      return;
    }
    setIaLoading(true);
    setMsg(null);
    try {
      const resp = await fetch(
        // ⬇️ CAMBIA ESTA URL POR LA DE TU BACKEND / CLOUD RUN
        "https://TU_BACKEND/ia-carrera",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            contexto: iaContexto,
            idioma: "es",
          }),
        }
      );

      if (!resp.ok) {
        throw new Error("Respuesta no OK del backend");
      }
      const data = await resp.json();

      if (!data || !data.pregunta || !Array.isArray(data.opciones)) {
        throw new Error("Formato inválido devuelto por la IA");
      }

      setPregunta(data.pregunta || "");
      const ops = data.opciones.slice(0, 4);
      while (ops.length < 4) ops.push("");
      setOpciones(ops);
      setCorrectIndex(
        typeof data.correctIndex === "number" ? data.correctIndex : 0
      );

      setMsg({
        type: "ok",
        text: "Pregunta generada por IA. Revisa y pulsa ‘Lanzar nueva pregunta’.",
      });
    } catch (err) {
      console.error(err);
      setMsg({
        type: "err",
        text: "No se pudo generar la pregunta con IA. Revisa la URL del backend o tu conexión.",
      });
    } finally {
      setIaLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={{ ...card, marginBottom: 16 }}>
        <h1 style={{ marginTop: 0 }}>Control de Carrera PRAGMA</h1>
        <p style={{ marginTop: 4, color: COLORS.muted }}>
          Ventana solo para el profesor. Desde aquí controlas las preguntas tipo Kahoot.
        </p>

        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(241,245,249,.8)",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              Código de sesión (PIN)
            </div>
            <input
              style={input}
              placeholder="Ej: 3WL8UX"
              value={sessionId}
              onChange={(e) => setSessionId(sanitizeCode(e.target.value))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Ronda actual</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              {ronda ? `#${ronda}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Estado</div>
            <div style={{ fontWeight: 600 }}>
              {estado === "pregunta"
                ? "Pregunta abierta"
                : estado === "resultados"
                ? "Mostrando resultados"
                : "Esperando"}
            </div>
          </div>
        </div>

        {/* 🔥 CONTEXTO PARA LA IA */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Contexto para la IA
          </div>
          <textarea
            style={{ ...input, minHeight: 70, resize: "vertical" }}
            placeholder="Pega aquí objetivo, habilidades, resumen del contenido o un párrafo de tu PPT. La IA usará esto para crear una pregunta de opción múltiple."
            value={iaContexto}
            onChange={(e) => setIaContexto(e.target.value)}
          />
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              onClick={generarConIA}
              disabled={iaLoading || !sessionId}
              style={{
                ...btn,
                background:
                  iaLoading || !sessionId
                    ? "rgba(148,163,184,.4)"
                    : "linear-gradient(to right,#f97316,#e11d48)",
                color: COLORS.white,
              }}
            >
              {iaLoading ? "Generando…" : "Generar pregunta con IA"}
            </button>
            <span style={{ fontSize: 12, color: COLORS.muted }}>
              La IA solo rellena la pregunta y las 4 opciones. Tú decides cuándo
              lanzarla.
            </span>
          </div>
        </div>

        {/* Pregunta y opciones (manual o IA) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Pregunta
          </div>
          <textarea
            style={{ ...input, minHeight: 70, resize: "vertical" }}
            placeholder="Escribe aquí la pregunta de la carrera… (o usa ‘Generar pregunta con IA’ arriba)"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {["A", "B", "C", "D"].map((label, idx) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span>Opción {label}</span>
                <label
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="radio"
                    name="correctIndex"
                    checked={correctIndex === idx}
                    onChange={() => setCorrectIndex(idx)}
                  />
                  <span style={{ fontSize: 11 }}>Correcta</span>
                </label>
              </div>
              <input
                style={input}
                placeholder={`Texto de la opción ${label}`}
                value={opciones[idx] || ""}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={lanzarPregunta}
            disabled={saving || !sessionId}
            style={{
              ...btn,
              background:
                saving || !sessionId
                  ? "rgba(148,163,184,.4)"
                  : "linear-gradient(to right,#22c55e,#16a34a)",
              color: COLORS.white,
            }}
          >
            {saving ? "Guardando..." : "Lanzar nueva pregunta"}
          </button>
          <button
            onClick={mostrarResultados}
            disabled={saving || !sessionId}
            style={{
              ...btn,
              background: "rgba(56,189,248,.12)",
              color: "#0284c7",
              border: "1px solid rgba(125,211,252,.8)",
            }}
          >
            Mostrar resultados
          </button>
          <button
            onClick={resetearCarrera}
            disabled={saving || !sessionId}
            style={{
              ...btn,
              background: "rgba(248,250,252,.9)",
              color: COLORS.muted,
              border: "1px solid " + COLORS.border,
            }}
          >
            Poner en “esperando”
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 12,
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

      <div style={{ ...card, marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Ranking (simple)</h2>
        <p style={{ marginTop: 0, color: COLORS.muted }}>
          Suma 1000 puntos por cada respuesta correcta. Se ordena de mayor a menor
          puntaje.
        </p>
        {ranking.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Aún no hay respuestas registradas en esta carrera.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: 6,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  Pos.
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: 6,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  Nombre / Código
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: 6,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  Correctas
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: 6,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  Preguntas
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: 6,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  Puntos
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 20).map((r, idx) => (
                <tr key={r.key}>
                  <td style={{ padding: 6 }}>{idx + 1}</td>
                  <td style={{ padding: 6 }}>
                    {r.nombre ? `${r.nombre} (${r.key})` : r.key}
                  </td>
                  <td style={{ padding: 6, textAlign: "center" }}>
                    {r.correctas}
                  </td>
                  <td style={{ padding: 6, textAlign: "center" }}>{r.total}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{r.puntos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
          Respuestas en la ronda actual #{ronda || 0}:{" "}
          <b>{respuestasRondaActual.length}</b>
        </div>
      </div>
    </div>
  );
}

