// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";

/**
 * 🔁 PUENTE PATH → HASH PARA HashRouter
 *
 * Si el usuario entra a:
 *   http://localhost:5174/cierre
 *   http://localhost:5174/participa?session=XYZ
 *
 * y NO hay hash (#/...), convertimos la URL a:
 *   http://localhost:5174/#/cierre
 *   http://localhost:5174/#/participa?session=XYZ
 *
 * De esta forma HashRouter verá correctamente la ruta
 * y NO pasará por RutaInicial ni te redirigirá a /horario.
 */
if (typeof window !== "undefined") {
  const { pathname, search, hash, origin } = window.location;

  const isIndex =
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "" ||
    pathname === undefined;

  const hasRealHash = hash && hash !== "#" && hash !== "#/";

  if (!isIndex && !hasRealHash) {
    const target = pathname + (search || "");
    const next = `${origin}/#${target}`;
    // Evita bucles: solo se ejecuta cuando NO hay hash real
    window.location.replace(next);
  }
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("No se encontró el elemento #root");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);












