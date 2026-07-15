// src/components/desarrollo/PracticaGuiada.jsx
import React, { useMemo, useState } from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 22, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };

function makeActividad(clase) {
  const texto = `${clase.asignatura || ""} ${clase.unidad || ""} ${clase.objetivo || ""}`;
  if (/cuadr[aá]tica|par[aá]bola/i.test(texto)) {
    return {
      problema: "Compara f(x)=x², g(x)=2x² y h(x)=0,5x². ¿Cuál parábola es más cerrada y cuál es más abierta?",
      pasos: [
        "Identifica el coeficiente a de cada función.",
        "Compara el valor absoluto de a.",
        "Relaciona mayor |a| con parábola más cerrada.",
        "Concluye: g(x)=2x² es más cerrada y h(x)=0,5x² es más abierta.",
      ],
      pregunta1: "¿Qué cambia si a es negativo?",
      pregunta2: "¿Qué representa visualmente el valor absoluto de a?",
      desafio: "Crea una función cuadrática más abierta que x² y otra más cerrada que x².",
    };
  }
  if (/trigonom/i.test(texto)) {
    return {
      problema: "Ubica un ángulo en el círculo unitario y explica qué representan seno y coseno en ese punto.",
      pasos: [
        "Dibuja o imagina el círculo unitario.",
        "Marca el ángulo desde el eje x positivo.",
        "Identifica el punto del círculo asociado al ángulo.",
        "Relaciona coseno con la coordenada x y seno con la coordenada y.",
      ],
      pregunta1: "¿Qué coordenada representa el coseno?",
      pregunta2: "¿Qué pasa con seno y coseno al cambiar de cuadrante?",
      desafio: "Explica por qué sen(90°)=1 y cos(90°)=0 usando el círculo unitario.",
    };
  }
  return {
    problema: `Resuelve una situación breve relacionada con: ${clase.objetivo || "el objetivo de la clase"}.`,
    pasos: [
      "Lee el objetivo y subraya la acción principal.",
      "Identifica los datos o ideas relevantes.",
      "Aplica una estrategia de resolución o explicación.",
      "Comunica la respuesta usando vocabulario de la asignatura.",
    ],
    pregunta1: "¿Qué concepto central aparece en esta actividad?",
    pregunta2: "¿Qué evidencia mostraría que el estudiante entendió?",
    desafio: "Propón otro ejemplo donde se use la misma idea en un contexto distinto.",
  };
}

export default function PracticaGuiada({ clase }) {
  const act = useMemo(() => makeActividad(clase), [clase]);
  const [mostrar, setMostrar] = useState(false);

  return (
    <section style={card}>
      <div style={{ fontWeight: 950, color: "#16a34a" }}>🧩 Práctica guiada</div>
      <h2 style={{ margin: "6px 0 12px", fontSize: 28 }}>Del concepto a la acción</h2>
      <div style={{ padding: 18, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20 }}>
        <strong>Problema sugerido:</strong>
        <p style={{ margin: "8px 0 0", fontSize: 18, lineHeight: 1.5 }}>{act.problema}</p>
      </div>

      <button type="button" onClick={() => setMostrar((v) => !v)} style={{ marginTop: 14, border: "0", borderRadius: 14, padding: "11px 14px", fontWeight: 950, background: "#0f172a", color: "#fff", cursor: "pointer" }}>
        {mostrar ? "Ocultar guía" : "Mostrar guía paso a paso"}
      </button>

      {mostrar && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {act.pasos.map((p, i) => (
            <div key={p} style={{ display: "flex", gap: 10, alignItems: "start", padding: 12, border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: "#0284c7", color: "white", fontWeight: 950, display: "grid", placeItems: "center" }}>{i + 1}</div>
              <div>{p}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Question title="Pregunta rápida" text={act.pregunta1} />
        <Question title="Aplicación" text={act.pregunta2} />
        <Question title="Desafío" text={act.desafio} />
      </div>
    </section>
  );
}

function Question({ title, text }) {
  return (
    <div style={{ padding: 14, border: "1px solid #dbeafe", borderRadius: 18, background: "#f8fafc" }}>
      <div style={{ fontWeight: 950, color: "#0369a1", marginBottom: 6 }}>{title}</div>
      <div style={{ lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}
