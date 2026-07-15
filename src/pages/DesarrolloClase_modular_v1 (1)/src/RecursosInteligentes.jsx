// src/components/desarrollo/RecursosInteligentes.jsx
import React, { useMemo, useState } from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 22, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };

function query(clase) {
  return encodeURIComponent(`${clase.asignatura || "educación"} ${clase.unidad || ""} ${clase.objetivo || ""}`.trim());
}

export default function RecursosInteligentes({ clase }) {
  const q = useMemo(() => query(clase), [clase]);
  const [url, setUrl] = useState("");

  const recursos = [
    { icon: "🎥", title: "YouTube docente", desc: "Buscar una explicación corta para apoyar la clase.", url: `https://www.youtube.com/results?search_query=${q}` },
    { icon: "📚", title: "Wikipedia / referencia", desc: "Usar solo como apoyo conceptual, no como planificación completa.", url: `https://es.wikipedia.org/wiki/Special:Search?search=${q}` },
    { icon: "📈", title: "GeoGebra", desc: "Crear o buscar una demostración interactiva.", url: `https://www.geogebra.org/search/${q}` },
    { icon: "📊", title: "Desmos", desc: "Graficar, probar valores y discutir patrones.", url: `https://www.desmos.com/calculator?lang=es` },
    { icon: "🧪", title: "PhET simuladores", desc: "Simulaciones para ciencias y matemática.", url: `https://phet.colorado.edu/es/simulations/filter?subjects=math&type=html,prototype` },
    { icon: "🤖", title: "Prompt IA", desc: "Generar una explicación adaptada al curso.", url: null },
  ];

  const prompt = `Actúa como profesor experto. Explica el objetivo "${clase.objetivo}" para ${clase.curso} en ${clase.asignatura}. Entrega: definición formal, analogía simple, ejemplo paso a paso, error común y 3 preguntas rápidas.`;

  return (
    <section style={card}>
      <div style={{ fontWeight: 950, color: "#7c3aed" }}>🧰 Recursos inteligentes</div>
      <h2 style={{ margin: "6px 0 12px", fontSize: 28 }}>Herramientas con propósito</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {recursos.map((r) => (
          <button key={r.title} type="button" onClick={() => r.url ? window.open(r.url, "_blank", "noopener,noreferrer") : navigator.clipboard?.writeText(prompt).then(() => alert("Prompt IA copiado ✅"))} style={{ textAlign: "left", border: "1px solid #dbeafe", borderRadius: 18, background: "#f8fafc", padding: 16, cursor: "pointer" }}>
            <div style={{ fontSize: 26 }}>{r.icon}</div>
            <div style={{ fontWeight: 950, fontSize: 17 }}>{r.title}</div>
            <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.35 }}>{r.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: 16, background: "#f0f9ff", borderRadius: 18, border: "1px solid #bae6fd" }}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>🔗 Recurso propio o PDF</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega aquí un enlace de apoyo, PDF, video o simulador" style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 12, padding: 12 }} />
          <button type="button" disabled={!url} onClick={() => window.open(url, "_blank", "noopener,noreferrer")} style={{ border: 0, borderRadius: 12, padding: "0 14px", fontWeight: 950, background: url ? "#0284c7" : "#cbd5e1", color: "white", cursor: url ? "pointer" : "not-allowed" }}>Abrir</button>
        </div>
      </div>
    </section>
  );
}
