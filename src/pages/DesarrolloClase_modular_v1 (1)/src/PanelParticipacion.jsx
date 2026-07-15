// src/components/desarrollo/PanelParticipacion.jsx
import React from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 20, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };

export default function PanelParticipacion({ clase, conectados, ultimoEnvio, notaDocente, setNotaDocente }) {
  return (
    <section style={card}>
      <div style={{ fontWeight: 950, color: "#16a34a" }}>📡 Participación y evidencia viva</div>
      <h2 style={{ margin: "6px 0 12px", fontSize: 24 }}>Pulso del curso</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat value={conectados} label="Conectados" />
        <Stat value={ultimoEnvio || "—"} label="Último envío" />
      </div>
      <div style={{ marginTop: 14, padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16 }}>
        <strong>Pregunta para levantar participación:</strong>
        <p style={{ margin: "8px 0 0" }}>¿Qué parte del objetivo de hoy ya entiendes y qué parte todavía necesitas practicar?</p>
      </div>
      <label style={{ display: "block", marginTop: 14, fontWeight: 900 }}>Nota docente rápida</label>
      <textarea value={notaDocente} onChange={(e) => setNotaDocente(e.target.value)} placeholder={`Observación sobre ${clase.curso} durante el desarrollo...`} rows={5} style={{ width: "100%", marginTop: 8, resize: "vertical", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, fontFamily: "inherit" }} />
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ border: "1px solid #dbeafe", borderRadius: 16, padding: 12, textAlign: "center", background: "#f8fafc" }}>
      <div style={{ fontSize: 24, fontWeight: 950 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#475569", fontWeight: 900 }}>{label}</div>
    </div>
  );
}
