import React from "react";

const COLORS = {
  dark: "#0f172a",
  text: "#1e293b",
  muted: "#64748b",
  cyan: "#0891b2",
  green: "#16a34a",
};

export default function FutureClassDemo() {
  return (
    <section style={wrap}>
      <div style={left}>
        <div style={leftHeader}>
          <div style={pill}>Experiencia docente inteligente</div>

          <h2 style={title}>
            El lunes a las 7:55, la clase ya te está esperando.
          </h2>

          <p style={lead}>
            PragmaProfe no solo ayuda a planificar. Reconoce tu horario,
            identifica el curso, carga el objetivo curricular y prepara una
            experiencia lista para enseñar antes de que comience la clase.
          </p>
        </div>

        <div style={bullets}>
          <Item text="Sin buscar archivos ni enlaces." />
          <Item text="Sin preparar la clase desde cero." />
          <Item text="Sin saltar entre diez plataformas." />
          <Item text="Todo listo para enseñar, participar y guardar evidencias." />
        </div>
      </div>

      <div style={screen}>
        <div style={screenTop}>
          <span style={dotGreen}></span>
          <span style={dotYellow}></span>
          <span style={dotRed}></span>
          <span style={screenTitle}>PragmaProfe · Clase inteligente</span>
        </div>

        <div style={screenBody}>
          <div style={timeBlock}>
            <div style={time}>07:55</div>
            <div style={day}>Lunes · Jornada de mañana</div>
          </div>

          <div style={classCard}>
            <div style={miniLabel}>Clase detectada automáticamente</div>
            <h3 style={classTitle}>2° Medio B · Matemática</h3>
            <p style={objective}>
              OA04 · Función cuadrática: tipos de funciones, comportamiento y
              representación.
            </p>

            <div style={statusGrid}>
              <Status text="Horario reconocido" />
              <Status text="Objetivo cargado" />
              <Status text="Recursos listos" />
              <Status text="QR generado" />
              <Status text="Nube preparada" />
              <Status text="Gincana Nexus disponible" />
            </div>

            <button style={mainButton}>Entrar a la clase</button>
          </div>

          <div style={nextClass}>
            <strong>09:50</strong>
            <span>1° Medio B · Homotecia · Cambio automático</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Item({ text }) {
  return (
    <div style={item}>
      <span style={check}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function Status({ text }) {
  return (
    <div style={status}>
      <span style={statusDot}>✓</span>
      <span>{text}</span>
    </div>
  );
}

const wrap = {
  marginTop: 18,
  padding: 26,
  borderRadius: 28,
  background:
    "radial-gradient(circle at top left, #e0f2fe 0, #ffffff 38%, #f8fafc 100%)",
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 60px rgba(15,23,42,.14)",
  display: "grid",
  gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.1fr)",
  gap: 26,
  alignItems: "center",
};

const left = {
  minWidth: 0,
};

const leftHeader = {
  textAlign: "center",
  maxWidth: 720,
  marginLeft: "auto",
  marginRight: "auto",
};

const pill = {
  display: "inline-flex",
  padding: "7px 13px",
  borderRadius: 999,
  background: "#ecfeff",
  color: COLORS.cyan,
  fontWeight: 950,
  marginBottom: 14,
};

const title = {
  margin: 0,
  color: COLORS.dark,
  fontSize: "clamp(30px, 4vw, 52px)",
  lineHeight: 1.03,
  letterSpacing: "-1.3px",
  textAlign: "center",
};

const lead = {
  marginTop: 16,
  color: COLORS.muted,
  fontSize: 18,
  lineHeight: 1.55,
  textAlign: "center",
  marginLeft: "auto",
  marginRight: "auto",
};

const bullets = {
  display: "grid",
  gap: 10,
  marginTop: 18,
};

const item = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  color: COLORS.text,
  fontWeight: 750,
};

const check = {
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "#dcfce7",
  color: COLORS.green,
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  flex: "0 0 auto",
};

const screen = {
  borderRadius: 24,
  overflow: "hidden",
  background: "#020617",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(2,6,23,.35)",
  border: "1px solid rgba(255,255,255,.12)",
};

const screenTop = {
  height: 44,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 16px",
  background: "rgba(15,23,42,.95)",
  borderBottom: "1px solid rgba(255,255,255,.10)",
};

const dotGreen = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#22c55e",
};

const dotYellow = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#facc15",
};

const dotRed = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#ef4444",
};

const screenTitle = {
  marginLeft: 8,
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 800,
};

const screenBody = {
  padding: 22,
  background:
    "radial-gradient(circle at top right, rgba(34,211,238,.20), transparent 38%), linear-gradient(180deg,#020617,#0f172a)",
};

const timeBlock = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "end",
  marginBottom: 16,
};

const time = {
  fontSize: 52,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-2px",
};

const day = {
  color: "#93c5fd",
  fontWeight: 850,
};

const classCard = {
  background: "rgba(255,255,255,.08)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 22,
  padding: 20,
  backdropFilter: "blur(12px)",
};

const miniLabel = {
  color: "#67e8f9",
  fontWeight: 950,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const classTitle = {
  margin: "10px 0 6px",
  fontSize: 28,
  lineHeight: 1.1,
};

const objective = {
  color: "#cbd5e1",
  lineHeight: 1.45,
};

const statusGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
  marginTop: 16,
};

const status = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 11px",
  borderRadius: 14,
  background: "rgba(255,255,255,.08)",
  color: "#e0f2fe",
  fontWeight: 800,
};

const statusDot = {
  color: "#86efac",
  fontWeight: 950,
};

const mainButton = {
  marginTop: 18,
  width: "100%",
  border: "0",
  borderRadius: 16,
  padding: "14px 18px",
  background: "linear-gradient(90deg,#22c55e,#06b6d4)",
  color: "#ffffff",
  fontWeight: 950,
  fontSize: 16,
  cursor: "pointer",
};

const nextClass = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#cbd5e1",
};