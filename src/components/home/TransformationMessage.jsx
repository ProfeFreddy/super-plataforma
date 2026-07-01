import React from "react";

export default function TransformationMessage() {
  return (
    <section style={wrap}>
      <div style={header}>
        <div style={badge}>La transformación</div>

        <h2 style={title}>
          El profesor deja de preparar clases repetitivas.
          <br />
          Enseñar vuelve a ser enseñar.
        </h2>

        <p style={lead}>
          PragmaProfe no nació para sumar otra herramienta más al día docente.
          Nació para cambiar la forma en que se prepara, inicia, vive y registra
          una clase.
        </p>
      </div>

      <div style={grid}>
        <TransformCard
          before="Antes"
          after="Ahora"
          textBefore="El profesor busca archivos, enlaces, objetivos y recursos."
          textAfter="La plataforma reconoce la clase y deja todo listo antes de comenzar."
        />

        <TransformCard
          before="Tiempo perdido"
          after="Tiempo recuperado"
          textBefore="Minutos valiosos se van en tareas repetitivas."
          textAfter="Cada minuto recuperado vuelve al estudiante."
        />

        <TransformCard
          before="Herramientas dispersas"
          after="Un solo sistema"
          textBefore="IA, QR, evidencias, recursos y participación viven separados."
          textAfter="PragmaProfe conecta todo en una misma experiencia educativa."
        />
      </div>

      <div style={quote}>
        <span style={quoteMark}>“</span>
        <p>
          Cuando la tecnología hace el trabajo repetitivo, el profesor vuelve a
          hacer el trabajo que ninguna IA puede reemplazar: enseñar, inspirar y
          acompañar.
        </p>
      </div>
    </section>
  );
}

function TransformCard({ before, after, textBefore, textAfter }) {
  return (
    <article style={card}>
      <div style={labelBefore}>{before}</div>
      <p style={beforeText}>{textBefore}</p>

      <div style={arrow}>↓</div>

      <div style={labelAfter}>{after}</div>
      <p style={afterText}>{textAfter}</p>
    </article>
  );
}

const wrap = {
  marginTop: 18,
  padding: 30,
  borderRadius: 28,
  background: "linear-gradient(135deg,#0f172a,#0e7490)",
  color: "#ffffff",
  boxShadow: "0 24px 60px rgba(15,23,42,.18)",
  border: "1px solid rgba(255,255,255,.14)",
};

const header = {
  maxWidth: 950,
  margin: "0 auto",
  textAlign: "center",
};

const badge = {
  display: "inline-flex",
  padding: "7px 13px",
  borderRadius: 999,
  background: "rgba(255,255,255,.12)",
  color: "#a5f3fc",
  fontWeight: 950,
  marginBottom: 14,
};

const title = {
  margin: 0,
  fontSize: "clamp(34px,5vw,64px)",
  lineHeight: 0.98,
  letterSpacing: "-1.8px",
  textAlign: "center",
};

const lead = {
  marginTop: 18,
  maxWidth: 900,
  fontSize: 19,
  lineHeight: 1.55,
  color: "#dbeafe",
  marginLeft: "auto",
  marginRight: "auto",
  textAlign: "center",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 26,
};

const card = {
  padding: 20,
  borderRadius: 22,
  background: "rgba(255,255,255,.10)",
  border: "1px solid rgba(255,255,255,.18)",
  boxShadow: "0 18px 40px rgba(2,6,23,.18)",
};

const labelBefore = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(248,113,113,.18)",
  color: "#fecaca",
  fontWeight: 950,
  marginBottom: 8,
};

const labelAfter = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,.18)",
  color: "#bbf7d0",
  fontWeight: 950,
  marginBottom: 8,
};

const beforeText = {
  color: "#cbd5e1",
  lineHeight: 1.45,
  margin: "6px 0 0",
};

const afterText = {
  color: "#ffffff",
  fontWeight: 850,
  lineHeight: 1.45,
  margin: "6px 0 0",
};

const arrow = {
  fontSize: 28,
  color: "#67e8f9",
  margin: "12px 0",
  fontWeight: 950,
};

const quote = {
  marginTop: 24,
  padding: 22,
  borderRadius: 22,
  background: "rgba(255,255,255,.12)",
  border: "1px solid rgba(255,255,255,.16)",
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
};

const quoteMark = {
  fontSize: 58,
  lineHeight: 0.9,
  color: "#67e8f9",
  fontWeight: 950,
};