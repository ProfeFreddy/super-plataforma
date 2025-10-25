// src/components/NubeDePalabras.jsx
import React from "react";
export default function NubeDePalabras({ palabras = [] }) {
  return (
    <div>
      <b>Nube de Palabras:</b> {palabras.join(" Â· ")}
    </div>
  );
}
