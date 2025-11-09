// src/lib/api.js
import axios from "axios";
import { API_BASE } from "../utils/apiBase";

/* ================== FLAGS / CONFIG ================== */

// Habilita llamadas reales al proxy/back-end del MINEDUC.
// También puede forzarse con localStorage("__MINEDUC_ON" = "1")
export const MINEDUC_ENABLED =
  (import.meta?.env?.VITE_MINEDUC_PROXY_ENABLED === "true") ||
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("__MINEDUC_ON") === "1");

// Base del API para axios (usa util si existe; cae a env; luego a /api)
const BASE = API_BASE ?? import.meta.env?.VITE_API_BASE ?? "/api";

/* ================== CLIENTE AXIOS ================== */

export const api = axios.create({
  baseURL: BASE, // "", "/api" o "https://tu-cloud-run..."
  timeout: 30_000,
});

// Log de requests en modo dev
if (import.meta.env?.DEV) {
  api.interceptors.request.use((cfg) => {
    try {
      // Evita loggear credenciales en consola
      const full = (cfg.baseURL || "") + (cfg.url || "");
      console.debug("[api]", (cfg.method || "get").toUpperCase(), full);
    } catch {}
    return cfg;
  });
}

// Idempotencia simple por request
api.interceptors.request.use((cfg) => {
  try {
    const rid =
      (typeof crypto !== "undefined" &&
        crypto.randomUUID &&
        crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cfg.headers = cfg.headers || {};
    cfg.headers["X-Client-Request-Id"] = rid;
  } catch {}
  return cfg;
});

// Reintentos ligeros para errores transitorios
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status;

    // Marca especial para rutas /flow/
    try {
      const full = (cfg.baseURL || "") + (cfg.url || "");
      if (full.includes("/flow/")) err.isFlow = true;
    } catch {}

    const isNetworkError = axios.isAxiosError(err) && !err.response;
    const shouldRetry = isNetworkError || RETRYABLE_STATUS.has(status);

    if (shouldRetry) {
      cfg.__retryCount = cfg.__retryCount || 0;
      const maxRetries = 2;
      if (cfg.__retryCount < maxRetries) {
        cfg.__retryCount += 1;
        await sleep(350 * cfg.__retryCount); // 350ms, 700ms
        return api(cfg);
      }
    }

    return Promise.reject(err);
  }
);

/* ================== HELPERS MINEDUC ================== */

async function offlineStub() {
  // Forma compatible con tu UI sin romper el flujo
  return { ok: false, offline: true, items: [] };
}

async function safeGet(url, params) {
  // Helper genérico para GET con manejo de errores
  const r = await api.get(url, { params });
  return { ok: true, items: r.data ?? r };
}

/**
 * Las tres funciones siguientes son las que importa DesarrolloClase.jsx:
 *   - buscarAsignaturaMineduc
 *   - buscarUnidadMineduc
 *   - buscarHabilidadesMineduc
 *
 * Si MINEDUC_ENABLED = false, devuelven un stub offline que no rompe el build.
 * Ajusta las rutas `/mineduc/*` a las de tu backend/proxy si ya las tienes.
 */

export async function buscarAsignaturaMineduc(params = {}) {
  if (!MINEDUC_ENABLED) {
    console.debug("[MINEDUC] OFF → buscarAsignaturaMineduc (stub)");
    return offlineStub();
  }
  // TODO: ajusta la ruta a tu backend real
  return safeGet("/mineduc/asignaturas", params);
}

export async function buscarUnidadMineduc(params = {}) {
  if (!MINEDUC_ENABLED) {
    console.debug("[MINEDUC] OFF → buscarUnidadMineduc (stub)");
    return offlineStub();
  }
  // TODO: ajusta la ruta a tu backend real
  return safeGet("/mineduc/unidades", params);
}

export async function buscarHabilidadesMineduc(params = {}) {
  if (!MINEDUC_ENABLED) {
    console.debug("[MINEDUC] OFF → buscarHabilidadesMineduc (stub)");
    return offlineStub();
  }
  // TODO: ajusta la ruta a tu backend real
  return safeGet("/mineduc/habilidades", params);
}

/* ===== Ejemplo original que mencionaste (lo conservo como comentario) =====
export async function buscarAsignaturaMineduc(params) {
  if (!MINEDUC_ENABLED) {
    console.debug("[MINEDUC] OFF → skip fetch (CORS bloqueado en browser)");
    return { ok: false, offline: true, items: [] };
  }
  // const url = `https://curriculumnacional.mineduc.cl/api/v1/oa/buscar?...`;
  // const res = await fetch(url, { headers: { ... } });
  // const data = await res.json();
  // return data;
}
*/

/* ================== EXPORT POR DEFECTO ================== */
// Por si en algún archivo usas `import api from "..."`.
export default api;

