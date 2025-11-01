// src/index.js
console.log("⚠️ ESTO ES index.js (CRA) EJECUTÁNDOSE");

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// Auto-switch: si la URL ya viene con "#/ruta", usamos HashRouter.
// También puedes forzarlo con REACT_APP_FORCE_HASH=1 en tu .env
const FORCE_HASH = String(process.env.REACT_APP_FORCE_HASH || "").trim() === "1";
const hasHashPrefix =
  typeof window !== "undefined" &&
  window.location.hash &&
  window.location.hash.startsWith("#/");

const UseHash = FORCE_HASH || hasHashPrefix;
const Router = UseHash ? HashRouter : BrowserRouter;

const container = document.getElementById("root");
if (!container) {
  console.error("No se encontró #root en el DOM.");
} else {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <Router>
        <App />
      </Router>
    </React.StrictMode>
  );
}

// Métricas opcionales de CRA
reportWebVitals();

