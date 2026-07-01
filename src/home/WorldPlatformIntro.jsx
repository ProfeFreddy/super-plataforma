import React from "react";

const COLORS = {
  textDark: "#0f172a",
  text: "#1f2937",
  muted: "#475569",
  border: "#e5e7eb",
};

const card = {
  background: "#ffffff",
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(2,6,23,.10)",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
};

export default function WorldPlatformIntro() {
  return (
    <section style={{ ...card, padding: 22, marginTop: 18 }}>

      {/* Cabecera centrada */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "6px 12px",
            borderRadius: 999,
            background: "#ecfeff",
            color: "#0e7490",
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          Sistema operativo educativo
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(32px, 5vw, 58px)",
            lineHeight: 1,
            color: COLORS.textDark,
            letterSpacing: "-1.5px",
            textAlign: "center",
          }}
        >
          La plataforma que prepara la clase correcta
          <br />
          antes de que el profesor llegue al aula.
        </h1>

        <p
          style={{
            marginTop: 18,
            marginLeft: "auto",
            marginRight: "auto",
            maxWidth: 920,
            fontSize: 18,
            lineHeight: 1.6,
            color: COLORS.muted,
            textAlign: "center",
          }}
        >
          PragmaProfe organiza automáticamente toda la jornada docente:
          reconoce el horario, identifica el curso, carga el objetivo
          curricular y deja lista una experiencia completa para enseñar,
          participar y evaluar.
        </p>
      </div>

      <div style={{ ...grid, marginTop: 28 }}>
        <Mini
          title="📅 Horario inteligente"
          text="El profesor configura su semana una sola vez."
        />

        <Mini
          title="🧠 Clase automática"
          text="La plataforma detecta qué clase corresponde según el día y la hora."
        />

        <Mini
          title="📱 Participación en vivo"
          text="QR, nube de palabras, carreras y respuestas en tiempo real."
        />

        <Mini
          title="🎮 Gincana Nexus"
          text="El aprendizaje convertido en aventura, retos, niveles y recompensas."
        />
      </div>

    </section>
  );
}

function Mini({ title, text }) {
  return (
    <div style={{ ...card, padding: 16, boxShadow: "none" }}>
      <div
        style={{
          fontWeight: 900,
          color: COLORS.textDark,
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: COLORS.muted,
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}