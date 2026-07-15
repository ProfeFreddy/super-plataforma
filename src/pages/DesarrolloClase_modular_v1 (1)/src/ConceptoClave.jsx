// src/components/desarrollo/ConceptoClave.jsx
import React, { useMemo, useState } from "react";

const card = { background: "#fff", border: "1px solid #dbeafe", borderRadius: 24, padding: 22, boxShadow: "0 18px 38px rgba(15,23,42,.10)" };
const muted = { color: "#475569" };

function conceptoBase(clase) {
  const tema = clase.unidad || clase.objetivo || "el tema de la clase";
  const objetivo = clase.objetivo || "comprender el objetivo propuesto";
  const asig = (clase.asignatura || "").toLowerCase();

  if (asig.includes("mat") && /cuadr[aá]tica|par[aá]bola/i.test(`${tema} ${objetivo}`)) {
    return {
      definicion: "Una función cuadrática es una relación matemática de la forma f(x)=ax²+bx+c, con a distinto de cero. Su gráfico es una parábola y el valor de a modifica su apertura y orientación.",
      simple: "Piensa en una parábola como una curva que puede abrirse más o menos. Si el número a crece en valor absoluto, la curva se hace más estrecha.",
      normal: "El coeficiente a controla la concavidad y la apertura: si a es positivo abre hacia arriba; si es negativo abre hacia abajo; si su valor absoluto es mayor, la parábola se estrecha.",
      avanzado: "La transformación vertical f(x)=ax² conserva el vértice en el origen, pero aplica una dilatación o contracción vertical que altera la tasa de cambio y la forma global del gráfico.",
      error: "Confundir el signo de a con la apertura: el signo indica hacia dónde abre; el valor absoluto indica qué tan abierta o cerrada es.",
    };
  }

  if (asig.includes("mat") && /trigonom/i.test(`${tema} ${objetivo}`)) {
    return {
      definicion: "Las razones trigonométricas relacionan ángulos con proporciones entre lados de triángulos rectángulos y también con coordenadas en el círculo unitario.",
      simple: "Seno y coseno ayudan a ubicar puntos según un ángulo. Son como coordenadas para moverse alrededor de un círculo.",
      normal: "En el círculo unitario, el coseno corresponde a la coordenada x y el seno a la coordenada y del punto asociado a un ángulo.",
      avanzado: "La interpretación circular permite extender las razones trigonométricas más allá de triángulos rectángulos y modelar fenómenos periódicos.",
      error: "Creer que seno y coseno solo sirven para triángulos: también describen rotaciones, ondas y movimientos periódicos.",
    };
  }

  return {
    definicion: `En esta etapa, el concepto central es ${tema}. La clase busca que los estudiantes puedan ${objetivo.toLowerCase()}, conectando la explicación formal con ejemplos, práctica y evidencia de aprendizaje.`,
    simple: "Primero lo entendemos con palabras cercanas y un ejemplo cotidiano.",
    normal: "Luego lo formalizamos usando vocabulario propio de la asignatura y criterios claros.",
    avanzado: "Finalmente lo aplicamos en un caso nuevo, comparando estrategias, argumentos o representaciones.",
    error: "Quedarse solo con la definición y no llevarla a una aplicación concreta.",
  };
}

export default function ConceptoClave({ clase }) {
  const base = useMemo(() => conceptoBase(clase), [clase]);
  const [nivel, setNivel] = useState("normal");

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, color: "#0284c7" }}>📘 Concepto clave automático</div>
          <h2 style={{ margin: "6px 0 4px", fontSize: 30 }}>Introducción formal del tema</h2>
          <p style={{ ...muted, margin: 0 }}>Lista para que el profesor la diga apenas comienza el desarrollo.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["simple", "Simple"], ["normal", "Normal"], ["avanzado", "Avanzado"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setNivel(k)} style={{ border: "1px solid #bae6fd", borderRadius: 999, padding: "9px 12px", fontWeight: 900, background: nivel === k ? "#0f172a" : "#f0f9ff", color: nivel === k ? "#fff" : "#0369a1", cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, background: "linear-gradient(135deg, #f8fafc, #e0f2fe)", borderRadius: 20, border: "1px solid #dbeafe" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 22 }}>Definición docente</h3>
        <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0 }}>{base.definicion}</p>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 16, border: "1px solid #dbeafe", borderRadius: 18 }}>
          <h3 style={{ marginTop: 0 }}>🧭 Explicación {nivel}</h3>
          <p style={{ marginBottom: 0, lineHeight: 1.55 }}>{base[nivel]}</p>
        </div>
        <div style={{ padding: 16, border: "1px solid #fed7aa", borderRadius: 18, background: "#fff7ed" }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Error común</h3>
          <p style={{ marginBottom: 0, lineHeight: 1.55 }}>{base.error}</p>
        </div>
      </div>
    </section>
  );
}
