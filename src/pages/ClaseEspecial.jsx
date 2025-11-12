// src/pages/ClaseEspecial.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ClaseEspecial() {
  const nav = useNavigate();
  const [idioma, setIdioma] = useState("es");
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [nota, setNota] = useState("");

  const lanzar = () => {
    // Puedes guardar en Firestore si quieres; por ahora sólo navegamos:
    const params = new URLSearchParams({
      especial: "1",
      lang: idioma,
      t: titulo || "",
      o: objetivo || "",
    });
    nav(`/InicioClase?${params.toString()}`, {
      replace: false,
      state: {
        from: "clase-especial",
        especial: true,
        lang: idioma,
        titulo,
        objetivo,
        nota,
      },
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>Clase especial</h1>
      <p style={{ marginTop: 0 }}>
        Lanza una clase fuera de la planificación y elige el idioma (ej. Pitágoras en inglés).
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          <div>Idioma</div>
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>

        <label>
          <div>Título</div>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Teorema de Pitágoras"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div>Objetivo</div>
          <input
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Demostrar el teorema / Solve right triangles"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div>Notas</div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={lanzar} style={{ padding: "8px 12px" }}>
            Iniciar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
