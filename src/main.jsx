// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
// IMPORTANTE: usamos HashRouter a propósito.
// Eso hace que las rutas reales sean /#/home, /#/inicio, etc.
// TODA la navegación interna debe asumir eso.
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);







