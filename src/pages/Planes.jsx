// src/pages/Planes.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const CLP = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const planes = [
  {
    id: "FREE",
    nombre: "Free",
    precio: 0,
    badge: "Muy limitado",
    features: [
      "1 clase activa por semana",
      "Nube de palabras (hasta 10 alumnos)",
      "Sin juegos de cierre",
      "Sin exportaciones",
      "Sin soporte",
    ],
    cta: "Probar gratis",
  },
  {
    id: "BASICO",
    nombre: "Básico",
    precio: 9990,
    badge: "1 juego",
    features: [
      "Planificador diario",
      "Nube de palabras (25 alumnos)",
      "1 juego de cierre",
      "Evidencias básicas (PDF)",
      "Soporte por correo",
    ],
    cta: "Elegir Básico",
  },
  {
    id: "PRO",
    nombre: "Premium",
    precio: 19990,
    badge: "5 juegos",
    features: [
      "Todo lo del Básico",
      "5 juegos de cierre",
      "IA de apoyo a la planificación",
      "Exportación Excel",
      "Hasta 40 alumnos por clase",
    ],
    cta: "Elegir Premium",
  },
  {
    id: "PREMIUM",
    nombre: "Platinum",
    precio: 29990,
    badge: "10 juegos + extras",
    features: [
      "Todo lo de Premium",
      "Grabación de clase",
      "Alarma anti-ruido",
      "10 juegos para el cierre",
      "2 meses gratis (anual)",
    ],
    cta: "Elegir Platinum",
    destacado: true,
  },
  {
    id: "TRIAL",
    nombre: "1 mes gratis",
    precio: 0,
    badge: "Promoción",
    features: [
      "Acceso completo por 30 días",
      "Luego elige tu plan",
      "Recordatorio 5 días antes de vencer",
    ],
    cta: "Quiero mi mes gratis",
  },
];

export default function Planes() {
  const nav = useNavigate();

  const irAPago = (plan, billing = "monthly") => {
    // dejamos que Pago.js maneje login + Flow:
    nav(`/pago?plan=${encodeURIComponent(plan)}&billing=${billing}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#2193b0,#6dd5ed)",
        padding: 24,
        color: "#0f172a",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <h1 style={{ color: "#fff", margin: "4px 0 16px" }}>Planes para profes</h1>
        <p style={{ color: "#eaf7fb", marginTop: 0 }}>
          El plan <b>Free</b> es muy básico para que pruebes. Si quieres dar clases reales,
          elige un plan de pago y podrás pagar con <b>Flow (Chile)</b>. Si pagas <b>anual</b>,
          regalamos <b>1 mes extra</b> en cualquier plan.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {planes.map((p) => (
            <div
              key={p.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 30px rgba(2,6,23,.08)",
                padding: 16,
                position: "relative",
                outline: p.destacado ? "2px solid #f59e0b" : "none",
              }}
            >
              {p.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "#0ea5e9",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {p.badge}
                </div>
              )}

              <h3 style={{ margin: 0 }}>{p.nombre}</h3>
              <div style={{ margin: "6px 0 10px", fontWeight: 800 }}>
                {p.precio > 0 ? `${CLP(p.precio)} / mes` : "Gratis"}
              </div>

              <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
                {p.features.map((f, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{f}</li>
                ))}
              </ul>

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {/* mensual */}
                <button
                  onClick={() => irAPago(p.id === "TRIAL" ? "PRO" : p.id, "monthly")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "#10b981",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {p.cta}
                </button>

                {/* anual (2 meses gratis para Platinum; 1 mes gratis para todos por política general) */}
                {p.precio > 0 && (
                  <button
                    onClick={() => irAPago(p.id, "annual")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #10b981",
                      background: "#fff",
                      color: "#0f766e",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Pagar anual — 1 mes gratis
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Plan colegios */}
        <div
          style={{
            marginTop: 18,
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 30px rgba(2,6,23,.08)",
            padding: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Colegios (descuentos por volumen)</h2>
          <ul style={{ marginTop: 6 }}>
            <li>30 profes: -$2.000 por profe</li>
            <li>50 profes: -$3.000 por profe</li>
            <li>80 profes: -$4.000 por profe</li>
            <li>100 profes: -$5.000 por profe</li>
          </ul>
          <div style={{ color: "#334155" }}>
            Escríbenos a <a href="mailto:contactocolegios@pragmaprofe.com">contactocolegios@pragmaprofe.com</a>
            {" "}y te enviamos cotización y factura.
          </div>
        </div>

        <div style={{ marginTop: 16, color: "#eaf7fb" }}>
          Nota: Si activas la prueba de 7 días o el mes gratis, enviaremos un correo de recordatorio
          <b> 5 días antes</b> del vencimiento.
        </div>
      </div>
    </div>
  );
}
