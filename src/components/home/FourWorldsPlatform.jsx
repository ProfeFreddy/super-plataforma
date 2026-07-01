import React from "react";

export default function FourWorldsPlatform() {
  const worlds = [
    {
      icon: "🏫",
      title: "Educación Escolar",
      tag: "Activo",
      text: "Desde Educación Básica hasta Cuarto Medio. La IA reconoce horario, curso, asignatura y objetivo curricular.",
      items: ["Currículum", "QR", "Evidencias", "IA", "Gincana"],
      accent: "#0891b2",
    },
    {
      icon: "🎓",
      title: "Universidades",
      tag: "Próximamente",
      text: "Clases superiores, proyectos, evaluación formativa, investigación docente y seguimiento académico.",
      items: ["Planificación", "Resultados", "Rúbricas", "Recursos", "Analítica"],
      accent: "#7c3aed",
    },
    {
      icon: "🏢",
      title: "Empresas",
      tag: "Próximamente",
      text: "Capacitación corporativa con IA, gamificación, evidencias, rutas de aprendizaje e informes.",
      items: ["Cursos", "Equipos", "Certificación", "Seguimiento", "Reportes"],
      accent: "#ea580c",
    },
    {
      icon: "🎮",
      title: "Gincana Nexus",
      tag: "Motor gamificado",
      text: "La educación convertida en aventura: misiones, cooperación, rankings, recompensas e IA educativa.",
      items: ["Niveles", "Retos", "Ranking", "Skins", "Recompensas"],
      accent: "#16a34a",
    },
  ];

  return (
    <section style={wrap}>
      <div style={header}>
        <span style={pill}>Visión global</span>
        <h2 style={title}>
          Una plataforma.
          <br />
          Cuatro mundos.
        </h2>
        <p style={lead}>
          PragmaProfe nació para transformar la educación escolar, pero su
          tecnología puede organizar, enseñar, evaluar y generar evidencias en
          cualquier entorno de aprendizaje.
        </p>
      </div>

      <div style={grid}>
        {worlds.map((w) => (
          <article
            key={w.title}
            style={{ ...card, borderTop: `7px solid ${w.accent}` }}
          >
            <div style={topRow}>
              <div style={icon}>{w.icon}</div>
              <span style={{ ...tag, color: w.accent }}>{w.tag}</span>
            </div>

            <h3 style={cardTitle}>{w.title}</h3>
            <p style={cardText}>{w.text}</p>

            <div style={itemsGrid}>
              {w.items.map((item) => (
                <span key={item} style={chip}>
                  ✓ {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div style={visionBox}>
        <h3 style={visionTitle}>
          Hoy comenzamos con Educación Escolar.
          <br />
          Mañana será la forma en que el mundo aprende.
        </h3>

        <div style={roadmap}>
          <Road year="Hoy" label="Escuelas" value="45%" />
          <Road year="2027" label="Universidades" value="65%" />
          <Road year="2028" label="Empresas" value="82%" />
          <Road year="Futuro" label="Mundo" value="100%" />
        </div>
      </div>
    </section>
  );
}

function Road({ year, label, value }) {
  return (
    <div style={roadItem}>
      <div style={roadTop}>
        <strong>{year}</strong>
        <span>{label}</span>
      </div>
      <div style={bar}>
        <div style={{ ...barFill, width: value }} />
      </div>
    </div>
  );
}

const wrap = {
  marginTop: 18,
  padding: 28,
  borderRadius: 28,
  background: "linear-gradient(180deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 60px rgba(15,23,42,.12)",
};

const header = {
  maxWidth: 900,
  margin: "0 auto",
  textAlign: "center",
};

const pill = {
  display: "inline-flex",
  padding: "7px 13px",
  borderRadius: 999,
  background: "#ecfeff",
  color: "#0891b2",
  fontWeight: 950,
  marginBottom: 12,
};

const title = {
  margin: 0,
  color: "#0f172a",
  fontSize: "clamp(34px,5vw,64px)",
  lineHeight: 0.95,
  letterSpacing: "-1.8px",
  textAlign: "center",
};

const lead = {
  marginTop: 16,
  color: "#475569",
  fontSize: 18,
  lineHeight: 1.55,
  maxWidth: 900,
  marginLeft: "auto",
  marginRight: "auto",
  textAlign: "center",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
  marginTop: 26,
};

const card = {
  minHeight: 330,
  borderRadius: 26,
  padding: 22,
  background:
    "radial-gradient(circle at top right, rgba(14,165,233,.10), transparent 35%), #ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 18px 45px rgba(15,23,42,.10)",
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const icon = {
  width: 64,
  height: 64,
  borderRadius: 20,
  background: "#f8fafc",
  display: "grid",
  placeItems: "center",
  fontSize: 34,
  boxShadow: "inset 0 0 0 1px #e5e7eb",
};

const tag = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 999,
  padding: "7px 11px",
  fontWeight: 950,
  fontSize: 13,
};

const cardTitle = {
  margin: "22px 0 10px",
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.05,
};

const cardText = {
  color: "#475569",
  lineHeight: 1.5,
  fontSize: 16,
};

const itemsGrid = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 18,
};

const chip = {
  background: "#ecfeff",
  color: "#0e7490",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 850,
  fontSize: 14,
};

const visionBox = {
  marginTop: 22,
  padding: 22,
  borderRadius: 24,
  background: "linear-gradient(135deg,#0f172a,#0e7490)",
  color: "#ffffff",
};

const visionTitle = {
  margin: 0,
  fontSize: "clamp(24px,3vw,38px)",
  lineHeight: 1.1,
  textAlign: "center",
};

const roadmap = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 20,
};

const roadItem = {
  background: "rgba(255,255,255,.10)",
  border: "1px solid rgba(255,255,255,.18)",
  borderRadius: 18,
  padding: 14,
};

const roadTop = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
  color: "#e0f2fe",
};

const bar = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,.18)",
  overflow: "hidden",
};

const barFill = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg,#22c55e,#06b6d4)",
};