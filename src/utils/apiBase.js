// src/utils/apiBase.js
// Orden de resolución (de mayor a menor prioridad):
// 1) VITE_API_BASE (recomendado)
// 2) VITE_BACKEND_URL (legacy)
// 3) Si estamos en localhost y no hay envs: usa un puerto local (3001 por defecto)
// 4) Fallback: /api  (con rewrites en producción)

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

const fromEnv =
  env.VITE_API_BASE?.trim() ||
  env.VITE_BACKEND_URL?.trim() ||
  "";

const fromLocalhost =
  (typeof window !== "undefined" && window.location.hostname === "localhost")
    ? "http://localhost:3001" // cambia a 8082 si ése es tu backend local
    : "";

export const API_BASE = fromEnv || fromLocalhost || "/api";

// Helpers opcionales:
export const MINEDUC_PROXY_ENABLED =
  String(env.VITE_MINEDUC_PROXY_ENABLED || "").toLowerCase() === "true";

// Log útil (quitar luego):
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.debug("[API_BASE runtime]", API_BASE);
}
