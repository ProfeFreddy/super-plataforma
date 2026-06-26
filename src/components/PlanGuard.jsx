// src/components/PlanGuard.jsx
// Bloquea rutas protegidas si el usuario no tiene plan activo ni trial vigente.
// Uso en App.jsx: <PlanGuard><InicioClase /></PlanGuard>

import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { PlanContext } from "../context/PlanContext";

export default function PlanGuard({ children, allowDuringTrial = true }) {
  const { plan, loading, trialActive, planExpired } = useContext(PlanContext);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Segoe UI, sans-serif",
        background: "#f8fafc",
      }}>
        <div style={{ textAlign: "center", color: "#475569" }}>
          Verificando tu plan…
        </div>
      </div>
    );
  }

  // Tiene acceso si:
  // 1. Plan de pago activo (no FREE y no expirado)
  // 2. Trial activo (si allowDuringTrial = true)
  const tieneAcceso = true; // Juego libre para todos — monetización por ventajas premium

  if (!tieneAcceso) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg,#0f172a,#1e293b)",
        fontFamily: "Segoe UI, sans-serif",
        padding: 24,
      }}>
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 40,
          maxWidth: 480,
          textAlign: "center",
          color: "#fff",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>

          <h2 style={{ margin: "0 0 12px", fontSize: "1.4rem" }}>
            {planExpired ? "Tu plan ha vencido" : "Acceso restringido"}
          </h2>

          <p style={{ color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.6 }}>
            {planExpired
              ? "Tu suscripción venció. Renueva tu plan para seguir usando PragmaProfe."
              : "Para acceder a esta funcionalidad necesitas un plan activo o una prueba gratuita."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => navigate("/planes")}
              style={{
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                background: "#0ea5e9",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Ver planes y precios
            </button>

            <button
              onClick={() => navigate("/planes#trial")}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "1px solid #0ea5e9",
                background: "transparent",
                color: "#0ea5e9",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Comenzar prueba gratis de 7 días
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}