import React from "react";

export default function EcosystemPlatform() {
  const modules = [
    { icon: "🤖", title: "IA", pos: "topLeft" },
    { icon: "📚", title: "Currículum", pos: "topRight" },
    { icon: "🕒", title: "Horario", pos: "midLeft" },
    { icon: "📂", title: "Recursos", pos: "midRight" },
    { icon: "🎮", title: "Gincana", pos: "lowLeft" },
    { icon: "📱", title: "QR", pos: "lowRight" },
    { icon: "☁️", title: "Nube", pos: "bottomLeft" },
    { icon: "📊", title: "Analítica", pos: "bottomRight" },
    { icon: "📄", title: "Evidencias", pos: "deepLeft" },
    { icon: "📈", title: "Informes", pos: "deepRight" },
  ];

  return (
    <section style={wrap}>
      <div style={header}>
        <span style={pill}>Todo conectado</span>
        <h2 style={title}>Todo trabaja como un solo sistema.</h2>
        <p style={lead}>
          No cambias entre aplicaciones. PragmaProfe conecta inteligencia
          artificial, currículo, recursos, participación, evaluación y
          gamificación en una única experiencia educativa.
        </p>
      </div>

      <div style={ecosystem}>
        <div style={lineHorizontal}></div>
        <div style={lineVertical}></div>
        <div style={lineDiagA}></div>
        <div style={lineDiagB}></div>

        <div style={center}>
          <div style={centerLogo}>✦</div>
          <div style={centerTitle}>PRAGMAPROFE</div>
          <div style={centerText}>El centro de toda la experiencia</div>
        </div>

        {modules.map((m) => (
          <div key={m.title} style={{ ...node, ...positions[m.pos] }}>
            <div style={nodeIcon}>{m.icon}</div>
            <div style={nodeTitle}>{m.title}</div>
          </div>
        ))}
      </div>

      <div style={soonGrid}>
        <Soon title="Google Classroom" />
        <Soon title="Microsoft Teams" />
        <Soon title="Moodle" />
      </div>
    </section>
  );
}

function Soon({ title }) {
  return (
    <div style={soon}>
      <span>{title}</span>
      <strong>Próximamente</strong>
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
  maxWidth: 880,
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
  fontSize: "clamp(30px,4vw,52px)",
  lineHeight: 1.05,
  letterSpacing: "-1.2px",
  textAlign: "center",
};

const lead = {
  marginTop: 14,
  color: "#475569",
  fontSize: 18,
  lineHeight: 1.55,
  maxWidth: 900,
  marginLeft: "auto",
  marginRight: "auto",
  textAlign: "center",
};

const ecosystem = {
  position: "relative",
  minHeight: 620,
  marginTop: 28,
  borderRadius: 28,
  background:
    "radial-gradient(circle at center, #e0f2fe 0, #f8fafc 34%, #ffffff 70%)",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const center = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#0f172a,#0891b2)",
  color: "#ffffff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  boxShadow: "0 30px 80px rgba(8,145,178,.35)",
  zIndex: 3,
};

const centerLogo = {
  fontSize: 44,
  marginBottom: 8,
};

const centerTitle = {
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: ".08em",
};

const centerText = {
  marginTop: 8,
  color: "#cffafe",
  fontWeight: 800,
};

const node = {
  position: "absolute",
  width: 170,
  minHeight: 112,
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  boxShadow: "0 18px 40px rgba(15,23,42,.12)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 4,
};

const nodeIcon = {
  fontSize: 34,
  marginBottom: 8,
};

const nodeTitle = {
  fontWeight: 950,
  color: "#0f172a",
  fontSize: 17,
};

const positions = {
  topLeft: { left: "23%", top: "8%" },
  topRight: { right: "23%", top: "8%" },
  midLeft: { left: "7%", top: "33%" },
  midRight: { right: "7%", top: "33%" },
  lowLeft: { left: "16%", top: "58%" },
  lowRight: { right: "16%", top: "58%" },
  bottomLeft: { left: "31%", bottom: "5%" },
  bottomRight: { right: "31%", bottom: "5%" },
  deepLeft: { left: "5%", bottom: "10%" },
  deepRight: { right: "5%", bottom: "10%" },
};

const lineBase = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "78%",
  height: 2,
  background: "linear-gradient(90deg,transparent,#7dd3fc,transparent)",
  transformOrigin: "center",
  zIndex: 1,
};

const lineHorizontal = { ...lineBase, transform: "translate(-50%, -50%)" };

const lineVertical = {
  ...lineBase,
  transform: "translate(-50%, -50%) rotate(90deg)",
};

const lineDiagA = {
  ...lineBase,
  transform: "translate(-50%, -50%) rotate(32deg)",
};

const lineDiagB = {
  ...lineBase,
  transform: "translate(-50%, -50%) rotate(-32deg)",
};

const soonGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const soon = {
  padding: 15,
  borderRadius: 18,
  background: "#f1f5f9",
  border: "1px dashed #cbd5e1",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#475569",
};