// src/pages/ConfirmacionPago.jsx
import React from "react";

export default function ConfirmacionPago() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>✅ Pago recibido</h1>
      <p>Gracias. Tu suscripción quedó registrada.</p>
      <p>
        Puedes volver al <a href="/home">Home</a> o ir a{" "}
        <a href="/inicio">Inicio de clase</a>.
      </p>
    </div>
  );
}
