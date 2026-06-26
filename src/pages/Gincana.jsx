import React from "react";
import { useLocation } from "react-router-dom";

const DOWNLOAD_URL =
  "https://drive.google.com/uc?export=download&id=1xmjGtEXFNJU3D88LKIKEAPYcCqRSJmYT";

export default function Gincana() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const asignatura = params.get("asignatura") || "";
  const nivel = params.get("nivel") || "";
  const unidad = params.get("unidad") || "";
  const objetivo = params.get("objetivo") || "";

  const vieneDesdHorario = !!asignatura;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1a", color: "#fff", fontFamily: "sans-serif" }}>

      {/* HERO */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)", padding: "60px 32px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", color: "#00d4ff", marginBottom: 12 }}>
          GincanaNexus
        </h1>
        <p style={{ fontSize: "1.2rem", color: "#ccc", maxWidth: 600, margin: "0 auto 32px" }}>
          El juego educativo multijugador donde tus alumnos aprenden compitiendo en tiempo real.
        </p>

        {/* BANNER CLASE DESDE HORARIO */}
        {vieneDesdHorario && (
          <div style={{
            background: "linear-gradient(135deg, #10b98122, #00d4ff22)",
            border: "1px solid #10b981",
            borderRadius: 12,
            padding: "16px 24px",
            maxWidth: 600,
            margin: "0 auto 32px",
            textAlign: "left",
          }}>
            <div style={{ color: "#10b981", fontWeight: 700, marginBottom: 8, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: 1 }}>
              Clase configurada desde tu horario
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>
              {asignatura} {nivel && `— ${nivel}`}
            </div>
            {unidad && (
              <div style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: 2 }}>
                Unidad: {unidad}
              </div>
            )}
            {objetivo && (
              <div style={{ color: "#aaa", fontSize: "0.9rem" }}>
                Objetivo: {objetivo}
              </div>
            )}
          </div>
        )}

        <a href={DOWNLOAD_URL} download
          style={{
            background: "#00d4ff", color: "#0f0f1a", padding: "14px 36px",
            borderRadius: 8, fontWeight: 700, fontSize: "1.1rem",
            textDecoration: "none", display: "inline-block"
          }}>
          Descargar GincanaNexus (Windows)
        </a>
        <p style={{ color: "#888", fontSize: "0.85rem", marginTop: 10 }}>
          Gratis · Sin instalación de software adicional · Solo descomprime y ejecuta
        </p>
      </div>

      {/* INSTRUCCIONES */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px" }}>
        <h2 style={{ color: "#00d4ff", marginBottom: 24 }}>Cómo usar en clases</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { n: "1", t: "Descarga el juego", d: "Haz clic en el botón de descarga y descomprime el ZIP." },
            { n: "2", t: "Crea una sala", d: "Abre el juego, escribe tu nombre y crea una sala con código." },
            { n: "3", t: "Comparte el código", d: "Tus alumnos entran al juego con el mismo código de sala." },
            { n: "4", t: "Observa en tiempo real", d: "Usa el Panel Profesor más abajo para ver el progreso." },
          ].map(s => (
            <div key={s.n} style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: "1px solid #00d4ff22" }}>
              <div style={{ fontSize: "2rem", color: "#00d4ff", fontWeight: 700 }}>{s.n}</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{s.t}</div>
              <div style={{ color: "#aaa", fontSize: "0.9rem" }}>{s.d}</div>
            </div>
          ))}
        </div>

        {/* PLANES */}
        <h2 style={{ color: "#00d4ff", margin: "48px 0 24px" }}>Planes</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { n: "Gratis", p: "$0", d: "Estaciones 1-5, hasta 30 alumnos, panel profesor básico", c: "#555" },
            { n: "Pro", p: "$9.990/mes", d: "Estaciones 1-10, ranking entre salas, informes avanzados", c: "#00d4ff" },
            { n: "Elite", p: "$19.990/mes", d: "Todas las estaciones, torneos entre colegios, soporte prioritario", c: "#ffd700" },
          ].map(p => (
            <div key={p.n} style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: `2px solid ${p.c}` }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: p.c }}>{p.n}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, margin: "8px 0" }}>{p.p}</div>
              <div style={{ color: "#aaa", fontSize: "0.9rem" }}>{p.d}</div>
            </div>
          ))}
        </div>

        {/* PANEL PROFESOR */}
        <h2 style={{ color: "#00d4ff", margin: "48px 0 16px" }}>Panel Profesor en tiempo real</h2>
        <p style={{ color: "#aaa", marginBottom: 24 }}>
          Ingresa el código de sala para ver el progreso de tus alumnos en vivo.
        </p>
        <iframe
          src="/panel_profesor.html"
          style={{ width: "100%", height: 700, borderRadius: 12, border: "1px solid #00d4ff33" }}
          title="Panel Profesor"
        />
      </div>
    </div>
  );
}