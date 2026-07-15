// src/components/desarrollo/HerramientasProfesor.jsx
import React from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 20, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };

export default function HerramientasProfesor({ clase, onGuardarEvidencia, saving, onGincana, onCierre }) {
  return (
    <section style={card}>
      <div style={{ fontWeight: 950, color: "#0284c7" }}>🧑‍🏫 Herramientas del profesor</div>
      <h2 style={{ margin: "6px 0 12px", fontSize: 24 }}>Acciones rápidas</h2>
      <div style={{ display: "grid", gap: 10 }}>
        <Action icon="🧾" title="Guardar evidencia" text="Registra el estado del desarrollo de esta clase." onClick={onGuardarEvidencia} disabled={saving} />
        <Action icon="🎮" title="Abrir Gincana Nexus" text="Lleva la práctica al juego con el curso activo." onClick={onGincana} />
        <Action icon="🚨" title="Emergencia pedagógica" text="Plan B: explicación corta + pregunta oral + mini desafío." onClick={() => alert("Plan B sugerido:\n1) Explica el concepto en 2 minutos.\n2) Haz una pregunta simple.\n3) Da un desafío en parejas.\n4) Guarda una evidencia rápida.")} />
        <Action icon="✅" title="Ir al cierre" text="Pasar a síntesis, nube final y evidencia de salida." onClick={onCierre} primary />
      </div>
      <div style={{ marginTop: 14, padding: 14, background: "#f8fafc", borderRadius: 16, color: "#475569", fontSize: 13 }}>
        Clase: <strong>{clase.curso}</strong> · {clase.asignatura} · {clase.unidad}
      </div>
    </section>
  );
}

function Action({ icon, title, text, onClick, primary, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ textAlign: "left", border: primary ? "0" : "1px solid #dbeafe", borderRadius: 18, padding: 14, background: primary ? "#0f172a" : "#f8fafc", color: primary ? "#fff" : "#0f172a", cursor: disabled ? "not-allowed" : "pointer" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 950 }}>{disabled ? "Guardando..." : title}</div>
          <div style={{ fontSize: 13, opacity: .8 }}>{text}</div>
        </div>
      </div>
    </button>
  );
}
