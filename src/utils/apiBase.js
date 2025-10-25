// src/utils/apiBase.js
export const API_BASE =
  (typeof window !== "undefined" && window.location.hostname === "localhost")
    ? "http://localhost:3001" // vercel dev expone las funciones en 3001
    : "/api";                 // en producción (Vercel) vive en /api/*
