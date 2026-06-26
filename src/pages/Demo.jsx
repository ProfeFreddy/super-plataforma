import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const COLORS = {
  brandA: "#0a2463",
  brandB: "#1565c0",
  brandC: "#00c853",
  accent: "#00e5ff",
  accentGreen: "#69f0ae",
  white: "#ffffff",
  textDark: "#0a0f1e",
  text: "#1a2340",
  muted: "#3d5a80",
  border: "#b2dfdb",
  cardBg: "#ffffff",
  neon: "#00e676",
  electric: "#2979ff",
};

const WORD_COLORS = [
  "#2979ff",
  "#00c853",
  "#00e5ff",
  "#ff6d00",
  "#aa00ff",
  "#00bfa5",
  "#d50000",
  "#ffd600",
  "#00b0ff",
  "#76ff03",
];

const page = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, #0a2463 0%, #1565c0 40%, #006064 100%)`,
  color: COLORS.white,
  fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif",
  position: "relative",
  overflow: "hidden",
};

const meshOverlay = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 0,
  background: `
    radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0,229,255,0.13) 0%, transparent 70%),
    radial-gradient(ellipse 50% 60% at 10% 80%, rgba(0,200,83,0.12) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 50% 50%, rgba(41,121,255,0.08) 0%, transparent 70%)
  `,
};

const container = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "24px 16px 40px",
  position: "relative",
  zIndex: 1,
};

const card = {
  background: "rgba(255,255,255,0.97)",
  color: COLORS.text,
  border: `1px solid rgba(0,229,255,0.25)`,
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(10,36,99,.18), 0 0 0 1px rgba(0,229,255,0.08)",
};

const cardDark = {
  background: "rgba(10,36,99,0.75)",
  backdropFilter: "blur(16px)",
  color: COLORS.white,
  border: `1px solid rgba(0,229,255,0.3)`,
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(0,229,255,.08)",
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #2979ff 0%, #00c853 100%)",
  color: "#fff",
  padding: "13px 22px",
  borderRadius: 14,
  border: "none",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 16,
  boxShadow: "0 4px 20px rgba(41,121,255,0.4)",
  letterSpacing: 0.3,
};

const btnGhost = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  color: "#00e5ff",
  padding: "13px 18px",
  borderRadius: 14,
  border: "1.5px solid rgba(0,229,255,0.5)",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
  backdropFilter: "blur(8px)",
};

const btnGhostDark = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(41,121,255,0.08)",
  color: "#2979ff",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1.5px solid rgba(41,121,255,0.35)",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const chip = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: 999,
  background: "linear-gradient(90deg, #00e5ff22, #00c85322)",
  color: "#006064",
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid #00e5ff55",
  letterSpacing: 1,
};

const socialProof = {
  display: "inline-block",
  marginTop: 10,
  padding: "9px 16px",
  borderRadius: 999,
  background: "linear-gradient(90deg,#e8f5e9,#e0f7fa)",
  color: "#00695c",
  border: "1px solid #80cbc4",
  fontWeight: 800,
  fontSize: 14,
};

const glowLine = {
  height: 3,
  borderRadius: 99,
  background: "linear-gradient(90deg, #2979ff, #00c853, #00e5ff)",
  marginBottom: 20,
  opacity: 0.7,
};

const wordCloudWords = [
  { text: "ecuación", size: 28, x: -8, y: -6, rotate: -4, delay: 0 },
  { text: "x", size: 38, x: 10, y: -10, rotate: 3, delay: 0.2 },
  { text: "igualdad", size: 20, x: -6, y: 6, rotate: -2, delay: 0.4 },
  { text: "despeje", size: 26, x: 8, y: -4, rotate: 2, delay: 0.6 },
  { text: "resolver", size: 22, x: -10, y: 5, rotate: -3, delay: 0.8 },
  { text: "balanza", size: 18, x: 7, y: 8, rotate: 4, delay: 1 },
  { text: "incógnita", size: 24, x: -5, y: -8, rotate: -2, delay: 1.2 },
  { text: "solución", size: 32, x: 9, y: 4, rotate: 2, delay: 1.4 },
  { text: "operaciones", size: 18, x: -7, y: 9, rotate: -4, delay: 1.6 },
];

function InfoPill({ label, value, accent }) {
  return (
    <div style={{
      background: accent ? "linear-gradient(135deg,#e8f5e9,#e0f7fa)" : "#f0f9ff",
      border: accent ? "1px solid #80cbc4" : "1px solid #b3e5fc",
      borderRadius: 12,
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: 11, color: accent ? "#00695c" : "#0277bd", fontWeight: 800, letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: COLORS.textDark, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function InfoPillDark({ label, value }) {
  return (
    <div style={{
      background: "rgba(0,229,255,0.06)",
      border: "1px solid rgba(0,229,255,0.2)",
      borderRadius: 12,
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: 11, color: "#00e5ff", fontWeight: 800, letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#fff", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function StudentWord({ text, size, x = 0, y = 0, rotate = 0, delay = 0, color }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, y: 18 }}
      animate={{
        opacity: 1,
        scale: [1, 1.08, 1],
        x: [0, x, 0],
        y: [0, y, 0],
        rotate: [0, rotate, 0],
      }}
      transition={{
        opacity: { duration: 0.45, delay },
        scale: { duration: 2.8 + (size % 5) * 0.35, repeat: Infinity, ease: "easeInOut", delay },
        x: { duration: 4 + (size % 4), repeat: Infinity, ease: "easeInOut", delay },
        y: { duration: 3.6 + (size % 3), repeat: Infinity, ease: "easeInOut", delay },
        rotate: { duration: 5 + (size % 4), repeat: Infinity, ease: "easeInOut", delay },
      }}
      whileHover={{ scale: 1.22, rotate: rotate * 1.5, transition: { duration: 0.2 } }}
      style={{
        fontSize: size,
        fontWeight: 900,
        color,
        lineHeight: 1.1,
        display: "inline-block",
        cursor: "pointer",
        textShadow: `0 2px 12px ${color}55`,
        userSelect: "none",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
      }}
    >
      {text}
    </motion.span>
  );
}

export default function Demo() {
  const nav = useNavigate();

  return (
    <div style={page}>
      <div style={meshOverlay} />

      <div style={container}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            ...cardDark,
            marginBottom: 18,
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link to="/home" style={{
            display: "flex", alignItems: "center", gap: 10,
            textDecoration: "none", color: "#fff", fontWeight: 900, fontSize: 18,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #2979ff, #00c853)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(41,121,255,0.5)",
            }}>
              <span style={{ fontSize: 18 }}>⚡</span>
            </div>
            <span style={{ background: "linear-gradient(90deg,#00e5ff,#69f0ae)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              PragmaProfe
            </span>
          </Link>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => nav("/home")} style={btnGhost}>← Volver al inicio</button>
            <button type="button" onClick={() => nav("/registro")} style={btnPrimary}>
              ⚡ Empieza gratis en 30 segundos
            </button>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ ...card, padding: 28, marginBottom: 18 }}
        >
          <div style={glowLine} />
          <div style={{ display: "grid", gap: 12 }}>
            <span style={chip}>⚡ DEMO INTERACTIVA</span>

            <h2 style={{
              color: "#0a2463", fontWeight: 900, margin: "8px 0 0 0",
              fontSize: 26, lineHeight: 1.15,
            }}>
              Mientras otros profesores planifican… tú ya estás enseñando.
            </h2>

            <h1 style={{
              margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 900,
              background: "linear-gradient(135deg, #1565c0, #00c853)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Así se verá tu clase automática
            </h1>

            <p style={{ color: COLORS.muted, fontSize: 17, maxWidth: 900, margin: 0 }}>
              PRAGMA detecta tu bloque, carga la asignatura, la unidad, el objetivo y te
              prepara una experiencia de inicio lista para enseñar. Menos carga, más clase. Así de simple.
            </p>

            <div style={socialProof}>
              🟢 Profesores ya están usando PRAGMA para ahorrar tiempo y entrar a clase con todo listo.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button type="button" onClick={() => nav("/registro")} style={btnPrimary}>
                ⚡ Empieza gratis en 30 segundos
              </button>
              <button type="button" onClick={() => nav("/horario", { state: { from: "demo" } })} style={btnGhostDark}>
                Ir directo al horario →
              </button>
            </div>
          </div>
        </motion.div>

        {/* Simulación InicioClase */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          style={{ display: "grid", gap: 14 }}
        >
          {/* Top bar */}
          <div style={{
            ...card, padding: 16,
            display: "grid",
            gridTemplateColumns: "220px 1fr 190px",
            gap: 12,
            alignItems: "stretch",
          }}>
            {/* Hora */}
            <div style={{
              background: "linear-gradient(180deg,#e3f2fd,#f1f8e9)",
              border: "1px solid #b3e5fc",
              borderRadius: 16, padding: 16,
              display: "grid", gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 12, color: "#0277bd", fontWeight: 800, letterSpacing: 0.5 }}>Hora actual</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#0a2463", fontVariantNumeric: "tabular-nums" }}>08:15</div>
              </div>
              <div style={{ borderTop: "1px solid #b3e5fc", paddingTop: 10, display: "grid", gap: 8 }}>
                <InfoPill label="Bloque" value="1° bloque" />
                <InfoPill label="Duración" value="45 min" />
              </div>
            </div>

            {/* Clase */}
            <div style={{
              background: "linear-gradient(180deg,#fff,#f8fffe)",
              border: "1px solid #b2dfdb",
              borderRadius: 16, padding: 18,
              display: "grid", gap: 10,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 900, letterSpacing: 1.5,
                background: "linear-gradient(90deg,#2979ff,#00c853)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                CLASE ACTIVA AUTOMÁTICA
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0a2463" }}>
                Profesor Demo · 2° Medio A · Matemática
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <InfoPill label="Unidad" value="Ecuaciones lineales en una variable" accent />
                <InfoPill label="Objetivo" value="Resolver ecuaciones lineales y comprobar sus soluciones paso a paso." accent />
                <InfoPill label="Habilidades" value="Analizar · Resolver · Comunicar · Verificar" />
              </div>
            </div>

            {/* Interacciones */}
            <div style={{
              background: "linear-gradient(180deg,#e8f5e9,#e0f7fa)",
              border: "1px solid #80cbc4",
              borderRadius: 16, padding: 16,
              display: "grid", gap: 12, alignContent: "start",
            }}>
              <div>
                <div style={{ fontSize: 12, color: "#00695c", fontWeight: 800, letterSpacing: 0.5 }}>Interacciones</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#0a2463" }}>32</div>
              </div>
              <button type="button" style={{
                ...btnGhostDark, width: "100%",
                borderColor: "#80cbc4", color: "#00695c",
                background: "rgba(0,200,83,0.08)",
              }}>
                ✋ Levantar la mano
              </button>
              <button type="button" style={{
                ...btnGhostDark, width: "100%",
                borderColor: "#ffd54f", color: "#f57f17",
                background: "rgba(255,213,79,0.1)",
              }}>
                👏 Aplausos
              </button>
            </div>
          </div>

          {/* Segunda fila */}
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
            {/* Participación */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0a2463", marginBottom: 12 }}>
                Participación inicial
              </div>
              <div style={glowLine} />
              <div style={{ display: "grid", gap: 10 }}>
                <InfoPill label="Pregunta gatillante" value="¿Qué recuerdas sobre ecuaciones?" accent />
                <InfoPill label="Código de acceso" value="AULA-2048" />
                <InfoPill label="Estado" value="Recibiendo respuestas en tiempo real" accent />
              </div>
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 12,
                background: "linear-gradient(135deg,#e8f5e9,#e0f7fa)",
                border: "1px solid #80cbc4",
                color: "#00695c", fontWeight: 700, fontSize: 14,
              }}>
                🟢 Los estudiantes responden desde el celular y tú ves todo aquí al instante.
              </div>
            </div>

            {/* Nube de palabras */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0a2463", marginBottom: 12 }}>
                Nube de palabras en vivo
              </div>
              <div style={glowLine} />
              <div style={{
                minHeight: 200, borderRadius: 16,
                border: "1px solid #b2dfdb",
                background: "radial-gradient(circle at 60% 40%, #e0f7fa 0%, #f1f8e9 60%, #fff 100%)",
                padding: 20,
                display: "flex", flexWrap: "wrap", gap: 16,
                alignContent: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {wordCloudWords.map((word, idx) => (
                  <StudentWord
                    key={`${word.text}-${idx}`}
                    text={word.text} size={word.size}
                    x={word.x} y={word.y} rotate={word.rotate} delay={word.delay}
                    color={WORD_COLORS[idx % WORD_COLORS.length]}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tercera fila - Lo que está probando */}
          <div style={{ ...cardDark, padding: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#00e5ff", marginBottom: 14 }}>
              Lo que esta demo está probando
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}>
              <InfoPillDark label="Valor inmediato" value="El profe ve la clase antes de configurar nada" />
              <InfoPillDark label="Paso siguiente" value="Registrar cuenta y guardar horario" />
              <InfoPillDark label="Promesa del producto" value="Configuras una vez. Enseñas mejor todo el año." />
              <InfoPillDark label="Meta UX" value="Menos explicación. Más claridad visual." />
            </div>
          </div>
        </motion.div>

        {/* CTA final */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            ...cardDark, marginTop: 18, padding: 32, textAlign: "center",
          }}
        >
          <div style={glowLine} />
          <h2 style={{
            margin: 0, fontSize: 30, fontWeight: 900,
            background: "linear-gradient(90deg,#00e5ff,#69f0ae)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Esto no es adorno. Esto es conversión.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 10, fontSize: 16 }}>
            El profesor entra, entiende el valor en segundos y luego sí configura horario y
            planificación. Primero impacto. Después configuración. No al revés.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => nav("/registro")} style={btnPrimary}>
              ⚡ Crear mi cuenta
            </button>
            <button type="button" onClick={() => nav("/home")} style={btnGhost}>
              Seguir explorando
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}