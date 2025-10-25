// src/components/FichaClaseSticky.jsx
import React from "react";

const box = {
  position: "sticky",
  top: 12,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "12px",
  boxShadow: "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
  color: "#1f2937",
};

export default function FichaClaseSticky({ ficha = {}, onIrADesarrollo }) {
  const {
    unidad = "(sin unidad)",
    objetivo = "(sin objetivo)",
    habilidades = "(sin habilidades)",
    asignatura = "(asignatura)",
    curso = "",
    programaUrl = "",
  } = ficha || {};

  return (
    <aside style={box}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>ðŸ“Œ Ficha de clase</div>
      <div><b>Unidad:</b> {unidad}</div>
      <div><b>Objetivo:</b> {objetivo}</div>
      <div><b>Habilidades:</b> {habilidades}</div>
      <div style={{ color:"#475569", marginTop:6 }}>
        <b>Curso:</b> {curso} Â· <b>Asignatura:</b> {asignatura}
      </div>

      <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
        {programaUrl ? (
          <a
            href={programaUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              background:"#fff", color:"#2193b0", border:"1px solid #e5e7eb",
              borderRadius:10, padding:".4rem .7rem", fontWeight:800, textDecoration:"none",
              boxShadow:"0 2px 6px rgba(0,0,0,.06)"
            }}
          >
            ðŸ“– Programa (PDF)
          </a>
        ) : null}

        {onIrADesarrollo && (
          <button
            onClick={onIrADesarrollo}
            style={{
              background:"#2193b0", color:"#fff", border:"none",
              borderRadius:10, padding:".45rem .8rem", fontWeight:800, cursor:"pointer"
            }}
          >
            â–¶ï¸ Ir a Desarrollo
          </button>
        )}
      </div>
    </aside>
  );
}
