// src/components/desarrollo/DesarrolloHeader.jsx
import React from "react";

const COLORS = {
  ink: "#0f172a",
  muted: "#475569",
  card: "#ffffff",
  border: "#dbeafe",
  soft: "#f0f9ff",
  accent: "#0284c7",
};

function chipStyle(active) {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 13,
    background: active ? "#0f172a" : "rgba(255,255,255,.16)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.25)",
  };
}

function infoCard(icon, label, value) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 22,
        padding: 18,
        minHeight: 86,
      }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          letterSpacing: 1,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 950, fontSize: 19, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

export default function DesarrolloHeader({
  clase,
  fase = "desarrollo",
  rightSlot,
}) {
  const esInicio = fase === "inicio";
  const esDesarrollo = fase === "desarrollo";
  const esCierre = fase === "cierre";

  const etiquetaFase = esCierre
    ? "CierreClase · Evidencias y evaluación final"
    : esInicio
      ? "InicioClase · Activación y participación"
      : "DesarrolloClase · Centro de operaciones docente";

  const tituloFase = esCierre
    ? "Cierre de la clase"
    : esInicio
      ? "Inicio de la clase"
      : "Desarrollo de la clase";

  const descripcionFase = esCierre
    ? "Aquí se comprueba el aprendizaje, se registran evidencias y se finaliza la sesión."
    : esInicio
      ? "Aquí se activa el aprendizaje, se conecta al curso y se prepara el trabajo de la sesión."
      : "Aquí el objetivo se convierte en explicación clara, práctica guiada, recursos inteligentes y evidencia real.";

  const objetivoClase =
    clase?.objetivoClase ||
    clase?.objetivo ||
    "Objetivo de clase no informado";

  return (
    <header>
      <div
        style={{
          background: "linear-gradient(135deg, #083344, #0e7490)",
          borderRadius: 28,
          padding: 24,
          color: "white",
          boxShadow: "0 20px 50px rgba(0,0,0,.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <span style={chipStyle(esInicio)}>✓ Inicio</span>
          <span style={chipStyle(esDesarrollo)}>● Desarrollo</span>
          <span style={chipStyle(esCierre)}>○ Cierre</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,.12)",
                fontWeight: 900,
                marginBottom: 12,
              }}
            >
              {etiquetaFase}
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2.2rem, 5vw, 4.4rem)",
                lineHeight: 1.02,
              }}
            >
              {tituloFase}
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: 18,
                color: "#e0f2fe",
              }}
            >
              {descripcionFase}
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
              background: "rgba(255,255,255,.12)",
              padding: 18,
              borderRadius: 22,
              minWidth: 210,
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "#bae6fd",
                fontWeight: 900,
              }}
            >
              Curso activo
            </div>
            <div style={{ fontSize: 30, fontWeight: 950 }}>
              {clase?.curso || "Curso"}
            </div>
            <div style={{ fontSize: 13, color: "#dff7ff" }}>
              {clase?.asignatura || "Asignatura"}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 470px",
          gap: 18,
          marginTop: 18,
        }}
      >
        <div
          style={{
            background: COLORS.card,
            borderRadius: 26,
            padding: 22,
            boxShadow: "0 18px 38px rgba(15,23,42,.10)",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {infoCard(
              "👨‍🏫",
              "Profesor",
              clase?.nombreProfesor || clase?.profesor || "Profesor"
            )}
            {infoCard(
              "🏫",
              "Institución",
              clase?.institucion || "Institución"
            )}
            {infoCard(
              "📘",
              "Asignatura",
              clase?.asignatura || "Asignatura"
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              background: "linear-gradient(135deg, #f8fafc, #e0f2fe)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div
              style={{
                color: COLORS.muted,
                fontSize: 12,
                letterSpacing: 1,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Unidad
            </div>

            <h2 style={{ margin: "4px 0 8px", fontSize: 28 }}>
              {clase?.unidad || "Unidad"}
            </h2>

            <div style={{ fontWeight: 800 }}>
              🎯 Objetivo curricular:{" "}
              <span style={{ fontWeight: 950 }}>
                {clase?.oa || "No informado"}
              </span>
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              ✅ {objetivoClase}
            </div>

            <div
              style={{
                marginTop: 10,
                color: COLORS.muted,
                fontWeight: 800,
              }}
            >
              🧠 Habilidades: {clase?.habilidades || "No informadas"}
            </div>
          </div>
        </div>

        {rightSlot || null}
      </div>
    </header>
  );
}
