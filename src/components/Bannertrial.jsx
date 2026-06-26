// src/components/BannerTrial.jsx
// - Días 1-5: sin aviso
// - Día 6 (diasRestantes === 1): advertencia naranja
// - Día 7+ (expirado): bloqueo total con redirect a /planes

import React, { useEffect } from "react";
import { usePlan } from "../hooks/usePlan";
import { useNavigate, useLocation } from "react-router-dom";

// Rutas que NO se bloquean aunque el trial expire
const RUTAS_LIBRES = ["/planes", "/registro", "/login", "/home", "/demo"];

export default function BannerTrial() {
  const { tieneAcceso, trialActivo, diasRestantes, trialExpirado, loading } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();

  const rutaActual = location.pathname.toLowerCase();
  const esRutaLibre = RUTAS_LIBRES.some((r) => rutaActual.startsWith(r));

  // ✅ BLOQUEO TOTAL: redirige a /planes si el trial expiró
  useEffect(() => {
    if (!loading && trialExpirado && !tieneAcceso && !esRutaLibre) {
      navigate("/planes", { replace: true });
    }
  }, [loading, trialExpirado, tieneAcceso, esRutaLibre, navigate]);

  if (loading || esRutaLibre) return null;

  // Días 1-5: sin banner
  if (trialActivo && diasRestantes > 1) return null;

  // Día 6: advertencia (queda 1 día)
  if (trialActivo && diasRestantes === 1) {
    return (
      <div style={{
        background: "linear-gradient(90deg, #fff7ed, #fef3c7)",
        border: "1px solid #fb923c",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
        fontSize: 14,
      }}>
        <span style={{ color: "#92400e", fontWeight: 700 }}>
          ⚠️ <strong>Tu prueba gratuita vence mañana.</strong> Suscríbete hoy para no perder el acceso.
        </span>
        <button
          onClick={() => navigate("/planes")}
          style={{
            background: "#f97316", color: "#fff", border: "none",
            borderRadius: 8, padding: "7px 16px", fontWeight: 800,
            cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
          }}
        >
          Ver planes →
        </button>
      </div>
    );
  }

  // Expirado: el useEffect ya redirige, pero por si acaso mostramos bloqueo visual
  if (trialExpirado) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 28px",
          maxWidth: 460, width: "100%", textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>
            Tu prueba gratuita terminó
          </h2>
          <p style={{ color: "#475569", fontSize: 15, margin: "0 0 20px" }}>
            Tus datos y configuraciones están guardados. Suscríbete para seguir usando PragmaProfe sin interrupciones.
          </p>
          <button
            onClick={() => navigate("/planes")}
            style={{
              background: "linear-gradient(135deg, #2979ff, #10b981)",
              color: "#fff", border: "none", borderRadius: 12,
              padding: "13px 28px", fontWeight: 900, fontSize: 16,
              cursor: "pointer", width: "100%",
              boxShadow: "0 4px 20px rgba(41,121,255,0.35)",
            }}
          >
            Ver planes y suscribirme →
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
            Sin tarjeta de crédito requerida para explorar los planes.
          </div>
        </div>
      </div>
    );
  }

  return null;
}