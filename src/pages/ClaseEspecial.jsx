// src/pages/ClaseEspecial.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  white: "#ffffff",
  textDark: "#1f2937",
  textMuted: "#64748b",
  border: "#e5e7eb",
};

const page = {
  minHeight: "100vh",
  background: `linear-gradient(to right, ${COLORS.brandA}, ${COLORS.brandB})`,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "2rem",
  boxSizing: "border-box",
  fontFamily: "Segoe UI, system-ui, sans-serif",
};

const card = {
  background: COLORS.white,
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,.18)",
  padding: "1.8rem 2rem",
  width: "100%",
  maxWidth: 620,
  color: COLORS.textDark,
};

const label = {
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
  display: "block",
};

const input = {
  width: "100%",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  padding: "0.55rem 0.8rem",
  fontSize: 14,
  outline: "none",
};

const textarea = {
  ...input,
  minHeight: 70,
  resize: "vertical",
};

const select = {
  ...input,
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const btn = {
  border: "none",
  borderRadius: 999,
  padding: "0.7rem 1.4rem",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const btnPrimary = {
  ...btn,
  background: COLORS.brandA,
  color: COLORS.white,
};

const btnGhost = {
  ...btn,
  background: "#f9fafb",
  color: COLORS.textDark,
};

export default function ClaseEspecial() {
  const navigate = useNavigate();

  // idioma de la clase especial
  const [language, setLanguage] = useState("es");

  // Datos de la clase especial
  const [titulo, setTitulo] = useState("");
  const [eje, setEje] = useState("");
  const [unidad, setUnidad] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [habilidades, setHabilidades] = useState("");
  const [asignatura, setAsignatura] = useState("");
  const [curso, setCurso] = useState("");
  const [notas, setNotas] = useState("");

  const handleStart = () => {
    if (!titulo && !unidad && !objetivo) {
      if (!window.confirm("No has completado Título/Unidad/Objetivo. ¿Iniciar igual?")) return;
    }

    const claseEspecial = {
      titulo,
      eje,
      unidad,
      objetivo,
      habilidades,
      asignatura,
      curso,
      notas,
    };

    navigate("/InicioClase", {
      state: {
        especial: true,
        language,
        claseEspecial,
      },
    });
  };

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textMuted }}>
            PRAGMA · Clase Especial
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>Configurar Clase Especial</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            Define esta clase rápida (en español o en inglés). El contenido viajará completo por
            Inicio, Desarrollo y Cierre sin usar el horario normal.
          </p>
        </div>

        {/* Idioma + curso/asignatura */}
        <div style={{ ...row, marginBottom: 12 }}>
          <div>
            <label style={label}>Language / Idioma</label>
            <select
              style={select}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label style={label}>{language === "en" ? "Course" : "Curso"}</label>
            <input
              style={input}
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              placeholder={language === "en" ? "e.g. 10th grade B" : "Ej: 1° Medio A"}
            />
          </div>
        </div>

        <div style={{ ...row, marginBottom: 12 }}>
          <div>
            <label style={label}>{language === "en" ? "Subject" : "Asignatura"}</label>
            <input
              style={input}
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              placeholder={language === "en" ? "e.g. Math" : "Ej: Matemática"}
            />
          </div>
          <div>
            <label style={label}>{language === "en" ? "Axis" : "Eje"}</label>
            <input
              style={input}
              value={eje}
              onChange={(e) => setEje(e.target.value)}
              placeholder={language === "en" ? "e.g. Geometry" : "Ej: Números y operaciones"}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>{language === "en" ? "Title of the class" : "Título de la clase"}</label>
          <input
            style={input}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={
              language === "en"
                ? "e.g. Pythagorean Theorem in real life"
                : "Ej: Teorema de Pitágoras en la vida cotidiana"
            }
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>{language === "en" ? "Unit" : "Unidad"}</label>
          <input
            style={input}
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            placeholder={
              language === "en" ? "e.g. Right triangles" : "Ej: Triángulos rectángulos"
            }
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>
            {language === "en" ? "Learning objective" : "Objetivo de aprendizaje"}
          </label>
          <textarea
            style={textarea}
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder={
              language === "en"
                ? "Students will be able to apply the Pythagorean theorem in real situations."
                : "Los estudiantes aplican el teorema de Pitágoras en situaciones reales."
            }
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>
            {language === "en" ? "Skills / competencies" : "Habilidades / competencias"}
          </label>
          <textarea
            style={textarea}
            value={habilidades}
            onChange={(e) => setHabilidades(e.target.value)}
            placeholder={
              language === "en"
                ? "Problem solving, mathematical reasoning, communication…"
                : "Resolución de problemas, razonamiento matemático, comunicación…"
            }
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>
            {language === "en" ? "Notes for the teacher" : "Notas para el profesor"}
          </label>
          <textarea
            style={textarea}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={
              language === "en"
                ? "Extra notes, links, materials..."
                : "Notas extra, enlaces, materiales…"
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 6,
          }}
        >
          <button style={btnGhost} type="button" onClick={() => navigate("/")}>
            ⬅ Volver al Home
          </button>
          <button style={btnPrimary} type="button" onClick={handleStart}>
            🚀 Iniciar ahora
          </button>
        </div>
      </div>
    </div>
  );
}



