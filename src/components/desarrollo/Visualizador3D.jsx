// src/components/desarrollo/Visualizador3D.jsx
import React, { useMemo } from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 22, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };

function visual(clase) {
  const t = `${clase.asignatura || ""} ${clase.unidad || ""} ${clase.objetivo || ""}`;
  if (/cuadr[aá]tica|par[aá]bola/i.test(t)) return { type: "parabola", title: "Parábola interactiva", desc: "Muestra cómo cambia la apertura al variar el coeficiente a." };
  if (/circunferencia|círculo|circulo/i.test(t)) return { type: "circle", title: "Circunferencia / círculo", desc: "Representa radio, centro, diámetro y movimiento angular." };
  if (/trigonom/i.test(t)) return { type: "trig", title: "Círculo unitario", desc: "Conecta ángulo, seno, coseno y coordenadas." };
  return { type: "generic", title: "Visualizador conceptual", desc: "Espacio preparado para modelos 3D, simuladores y escenas interactivas según el objetivo." };
}

export default function Visualizador3D({ clase }) {
  const v = useMemo(() => visual(clase), [clase]);
  return (
    <section style={card}>
      <div style={{ fontWeight: 950, color: "#0891b2" }}>🧊 Visualizador 3D / interactivo</div>
      <h2 style={{ margin: "6px 0 12px", fontSize: 28 }}>{v.title}</h2>
      <p style={{ color: "#475569", marginTop: 0 }}>{v.desc}</p>
      <div style={{ minHeight: 280, border: "1px solid #bae6fd", borderRadius: 22, background: "radial-gradient(circle at 50% 35%, #e0f2fe, #f8fafc)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {v.type === "parabola" && <ParabolaDemo />}
        {v.type === "trig" && <TrigDemo />}
        {v.type === "circle" && <CircleDemo />}
        {v.type === "generic" && <GenericDemo />}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => window.open("/pitagoras-3d.html", "_blank", "noopener,noreferrer")} style={btn()}>Abrir laboratorio 3D</button>
        <button type="button" onClick={() => window.open("/api/shape/generate", "_blank", "noopener,noreferrer")} style={btn("ghost")}>Generador 3D</button>
      </div>
    </section>
  );
}

function btn(kind) {
  return { border: "1px solid #bae6fd", borderRadius: 14, padding: "11px 14px", fontWeight: 950, background: kind === "ghost" ? "#fff" : "#0284c7", color: kind === "ghost" ? "#0369a1" : "#fff", cursor: "pointer" };
}

function ParabolaDemo() {
  return (
    <svg viewBox="0 0 520 260" width="100%" height="260" role="img" aria-label="parábolas">
      <line x1="40" y1="210" x2="480" y2="210" stroke="#94a3b8" strokeWidth="2" />
      <line x1="260" y1="20" x2="260" y2="230" stroke="#94a3b8" strokeWidth="2" />
      <path d="M80 40 Q260 380 440 40" fill="none" stroke="#0284c7" strokeWidth="6" />
      <path d="M150 35 Q260 300 370 35" fill="none" stroke="#7c3aed" strokeWidth="5" opacity=".85" />
      <path d="M40 120 Q260 290 480 120" fill="none" stroke="#16a34a" strokeWidth="5" opacity=".85" />
      <text x="60" y="235" fontSize="16" fontWeight="700" fill="#334155">Más abierta</text>
      <text x="340" y="235" fontSize="16" fontWeight="700" fill="#334155">Más cerrada</text>
    </svg>
  );
}

function TrigDemo() {
  return (
    <svg viewBox="0 0 360 260" width="100%" height="260" role="img" aria-label="círculo unitario">
      <circle cx="180" cy="130" r="90" fill="none" stroke="#0284c7" strokeWidth="5" />
      <line x1="55" y1="130" x2="305" y2="130" stroke="#94a3b8" strokeWidth="2" />
      <line x1="180" y1="25" x2="180" y2="235" stroke="#94a3b8" strokeWidth="2" />
      <line x1="180" y1="130" x2="245" y2="70" stroke="#7c3aed" strokeWidth="5" />
      <circle cx="245" cy="70" r="8" fill="#f97316" />
      <text x="252" y="68" fontSize="16" fontWeight="800" fill="#0f172a">(cos θ, sen θ)</text>
      <text x="195" y="108" fontSize="18" fontWeight="900" fill="#7c3aed">θ</text>
    </svg>
  );
}

function CircleDemo() {
  return (
    <svg viewBox="0 0 360 260" width="100%" height="260" role="img" aria-label="circunferencia">
      <circle cx="180" cy="130" r="90" fill="none" stroke="#0284c7" strokeWidth="6" />
      <circle cx="180" cy="130" r="6" fill="#0f172a" />
      <line x1="180" y1="130" x2="270" y2="130" stroke="#16a34a" strokeWidth="5" />
      <text x="210" y="120" fontSize="18" fontWeight="900" fill="#166534">radio</text>
    </svg>
  );
}

function GenericDemo() {
  return <div style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 58 }}>🧠🧊</div><h3>Modelo visual listo para conectar</h3><p style={{ color: "#475569" }}>Aquí puedes integrar GLB, A-Frame, simuladores o escenas por objetivo.</p></div>;
}
