// src/pages/Planes.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { pagarSmart, pagarConPayPal, PRICE_MAP } from "./Pago";

// Tipo de cambio CLP → USD aproximado (ajustar según necesidad)
const USD_RATE = 950;
const toUSD = (clp) => (clp / USD_RATE).toFixed(2);

const CLP = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const planes = [
  {
    id: "FREE",
    nombre: "Free",
    precio: 0,
    color: "#64748b",
    badge: null,
    destacado: false,
    pragmaprofe: [
      "1 clase activa por semana",
      "Nube de palabras (hasta 10 alumnos)",
      "Planificador básico",
      "Sin exportaciones",
    ],
    gincana: [
      "GincanaNexus: 5 estaciones",
      "Hasta 10 alumnos por sala",
      "Panel profesor básico",
    ],
    cta: "Probar gratis",
    billing: false,
  },
  {
    id: "PROFE_PRO",
    flowId: "BASICO",
    nombre: "Profe Pro",
    precio: 9990,
    precioAnual: 9990 * 11,
    mesesAnual: 13,
    color: "#0ea5e9",
    badge: "Más popular",
    destacado: false,
    pragmaprofe: [
      "Clases ilimitadas",
      "Nube de palabras (hasta 40 alumnos)",
      "Planificador con IA alineado al Mineduc",
      "Evidencias en PDF",
      "Horario editable",
      "Soporte por correo",
    ],
    gincana: [
      "GincanaNexus: 10 estaciones",
      "Hasta 35 alumnos por sala",
      "Panel profesor en tiempo real",
      "Ranking y puntos",
    ],
    cta: "Elegir Profe Pro",
    billing: true,
  },
  {
    id: "PROFE_ELITE",
    flowId: "PRO",
    nombre: "Profe Elite",
    precio: 19990,
    precioAnual: 19990 * 11,
    mesesAnual: 13,
    color: "#f59e0b",
    badge: "Recomendado",
    destacado: true,
    pragmaprofe: [
      "Todo lo del Profe Pro",
      "IA avanzada de planificación",
      "Exportación Excel",
      "Grabación de clase",
      "Alarma anti-ruido",
      "Soporte prioritario",
    ],
    gincana: [
      "GincanaNexus: 15 estaciones (completo)",
      "Alumnos ilimitados por sala",
      "Informes avanzados por OA",
      "Torneos entre salas",
      "Personalización de preguntas",
    ],
    cta: "Elegir Profe Elite",
    billing: true,
  },
  {
    id: "COLEGIO_BASICO",
    nombre: "Colegio Básico",
    precio: 59990,
    color: "#8b5cf6",
    badge: "Hasta 10 profes",
    destacado: false,
    pragmaprofe: [
      "Todo el Profe Elite para cada profe",
      "Panel de administración del colegio",
      "Estadísticas por departamento",
      "Factura electrónica",
    ],
    gincana: [
      "GincanaNexus completo para todos",
      "Ranking entre cursos del colegio",
      "Informes por asignatura y nivel",
      "Soporte por videollamada",
    ],
    cta: "Cotizar Colegio Básico",
    billing: false,
    contacto: true,
  },
  {
    id: "COLEGIO_FULL",
    nombre: "Colegio Full",
    precio: 119990,
    color: "#10b981",
    badge: "Profes ilimitados",
    destacado: false,
    pragmaprofe: [
      "Todo el Colegio Básico",
      "Profes ilimitados",
      "Capacitación presencial incluida",
      "Integración con sistemas del colegio",
    ],
    gincana: [
      "GincanaNexus para todo el colegio",
      "Torneos entre cursos y niveles",
      "Dashboard directivo en tiempo real",
      "Soporte 24/7 prioritario",
    ],
    cta: "Cotizar Colegio Full",
    billing: false,
    contacto: true,
  },
];

function MetodoPagoModal({ plan, onClose }) {
  const [modo, setModo] = useState("monthly");

  const flowId   = plan.flowId || plan.id;
  const precio   = modo === "annual" ? plan.precioAnual : plan.precio;
  const meses    = modo === "annual" ? (plan.mesesAnual || 13) : 1;
  const precioUSD = toUSD(precio);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
      display: "grid", placeItems: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 16, padding: 32,
        maxWidth: 420, width: "100%", color: "#fff", border: "1px solid #334155",
      }}>
        <h3 style={{ margin: "0 0 8px" }}>Pagar {plan.nombre}</h3>

        {/* Selector mensual / anual */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["monthly", "annual"].map((m) => (
            <button key={m} onClick={() => setModo(m)} style={{
              flex: 1, padding: "10px", borderRadius: 8,
              border: modo === m ? `2px solid ${plan.color}` : "1px solid #334155",
              background: modo === m ? `${plan.color}22` : "transparent",
              color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13,
            }}>
              {m === "monthly" ? `Mensual — ${CLP(plan.precio)}` : `Anual — ${CLP(plan.precioAnual)} (+1 mes gratis)`}
            </button>
          ))}
        </div>

        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
          Elige tu método de pago:
        </p>

        {/* Flow — Chile */}
        <button
          onClick={() => { pagarSmart(flowId, precio, meses); onClose(); }}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, border: "none",
            background: "#22c55e", color: "#fff", fontWeight: 800,
            cursor: "pointer", fontSize: "0.95rem", marginBottom: 10,
          }}
        >
          🇨🇱 Pagar con Flow (Débito / Cuenta RUT / Chile)
        </button>

        {/* PayPal — Internacional */}
        <button
          onClick={() => { pagarConPayPal(flowId, precioUSD, meses); onClose(); }}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, border: "none",
            background: "#003087", color: "#fff", fontWeight: 800,
            cursor: "pointer", fontSize: "0.95rem", marginBottom: 10,
          }}
        >
          🌎 Pagar con PayPal — USD ${precioUSD}
        </button>

        <button onClick={onClose} style={{
          width: "100%", padding: "10px", borderRadius: 10,
          border: "1px solid #334155", background: "transparent",
          color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem",
        }}>
          Cancelar
        </button>

        <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 12 }}>
          Pagos seguros · Cancela cuando quieras
        </p>
      </div>
    </div>
  );
}

export default function Planes() {
  const nav = useNavigate();
  const [planSeleccionado, setPlanSeleccionado] = useState(null);

  const irAContacto = () => { window.location.href = "mailto:contactocolegios@pragmaprofe.com"; };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#0f172a,#1e293b)",
      padding: "40px 24px",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      {planSeleccionado && (
        <MetodoPagoModal plan={planSeleccionado} onClose={() => setPlanSeleccionado(null)} />
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: "2.2rem", margin: "0 0 12px", color: "#fff" }}>
            Una plataforma. Todo lo que necesitas.
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "1.1rem", maxWidth: 600, margin: "0 auto" }}>
            PragmaProfe + GincanaNexus en un solo plan. Planifica, dinamiza, evalúa y gamifica tus clases.
          </p>
          <div style={{
            display: "inline-flex", gap: 24, marginTop: 24,
            background: "#1e293b", borderRadius: 12, padding: "12px 24px",
            border: "1px solid #334155",
          }}>
            {[
              { val: "+500", label: "Profes activos", color: "#0ea5e9" },
              { val: "3-5h",  label: "Ahorradas/semana", color: "#10b981" },
              { val: "100%", label: "Mineduc alineado",  color: "#f59e0b" },
            ].map((s, i, arr) => (
              <React.Fragment key={s.val}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{s.label}</div>
                </div>
                {i < arr.length - 1 && <div style={{ width: 1, background: "#334155" }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* PLANES */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16, marginBottom: 32,
        }}>
          {planes.map((p) => (
            <div key={p.id} style={{
              background: "#1e293b", borderRadius: 16,
              border: `2px solid ${p.destacado ? p.color : "#334155"}`,
              padding: 24, position: "relative",
              boxShadow: p.destacado ? `0 0 30px ${p.color}33` : "none",
            }}>
              {p.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%",
                  transform: "translateX(-50%)",
                  background: p.color, color: "#fff",
                  padding: "4px 16px", borderRadius: 999,
                  fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
                }}>
                  {p.badge}
                </div>
              )}

              <h3 style={{ margin: "8px 0 4px", fontSize: "1.2rem", color: p.color }}>{p.nombre}</h3>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 4 }}>
                {p.precio > 0 ? CLP(p.precio) : "$0"}
                {p.precio > 0 && <span style={{ fontSize: "1rem", fontWeight: 400, color: "#94a3b8" }}>/mes</span>}
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #334155", margin: "16px 0" }} />

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0ea5e9", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  PragmaProfe
                </div>
                {p.pragmaprofe.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: "0.88rem", color: "#cbd5e1" }}>
                    <span style={{ color: "#0ea5e9", flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10b981", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  GincanaNexus
                </div>
                {p.gincana.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: "0.88rem", color: "#cbd5e1" }}>
                    <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>

              {/* Botones */}
              {p.contacto ? (
                <button onClick={irAContacto} style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: `2px solid ${p.color}`, background: "transparent",
                  color: p.color, fontWeight: 800, cursor: "pointer", fontSize: "0.95rem",
                }}>
                  {p.cta}
                </button>
              ) : p.id === "FREE" ? (
                <button onClick={() => nav("/registro")} style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: "none", background: p.color,
                  color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: "0.95rem",
                }}>
                  {p.cta}
                </button>
              ) : (
                <button onClick={() => setPlanSeleccionado(p)} style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: "none", background: p.color,
                  color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: "0.95rem",
                }}>
                  {p.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* TRIAL */}
        <div id="trial" style={{
          background: "linear-gradient(135deg, #0ea5e9, #10b981)",
          borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 32,
        }}>
          <h2 style={{ margin: "0 0 8px" }}>¿No estás seguro? Prueba 7 días gratis</h2>
          <p style={{ color: "#e0f7fa", margin: "0 0 20px" }}>
            Acceso completo al plan Profe Elite por 7 días. Sin tarjeta de crédito.
          </p>
          <button onClick={() => nav("/registro?trial=1")} style={{
            padding: "14px 36px", borderRadius: 10, border: "none",
            background: "#fff", color: "#0ea5e9", fontWeight: 800,
            cursor: "pointer", fontSize: "1rem",
          }}>
            Comenzar prueba gratuita
          </button>
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
          Pagos seguros con Flow (Chile) y PayPal · Cancela cuando quieras · Factura electrónica disponible
        </div>
      </div>
    </div>
  );
}