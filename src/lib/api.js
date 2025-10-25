// src/lib/api.js 
import axios from "axios";

/**
 * Base para endpoints relativos. Si tienes VITE_PROXY_BASE, Ãºsala.
 * Si no, dejamos "" y Vite harÃ¡ proxy segÃºn tu vite.config.js.
 */
const BASE = import.meta.env.VITE_API_BASE || "/api";
// Un Ãºnico cliente axios.
// Nota: para URLs absolutas (https://...), axios ignora baseURL â€” perfecto.
export const api = axios.create({
  baseURL: BASE,      // ej: "", "/api" o "http://localhost:8080"
  timeout: 30000,
});

// Opcional: pequeÃ±o log en desarrollo
if (import.meta.env?.DEV) {
  api.interceptors.request.use((cfg) => {
    console.debug("[api]", cfg.method?.toUpperCase(), cfg.baseURL + (cfg.url || ""));
    return cfg;
  });
}

/* ======== ADITIVOS: robustez de red, sin eliminar nada ======== */

// Header idempotente simple por request (evita dobles compras/acciones en backend)
api.interceptors.request.use((cfg) => {
  try {
    const rid =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cfg.headers = cfg.headers || {};
    cfg.headers["X-Client-Request-Id"] = rid;
  } catch {}
  return cfg;
});

// Reintentos ligeros con backoff para errores transitorios
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status;

    // Marca especial si la URL apunta a rutas de Flow (para mostrar msjs claros en el front)
    try {
      if ((cfg.url || "").includes("/flow/") || (cfg.baseURL + cfg.url).includes("/flow/")) {
        err.isFlow = true;
      }
    } catch {}

    // Red o timeouts sin response => retry
    const isNetworkError = axios.isAxiosError(err) && !err.response;
    const shouldRetry = isNetworkError || RETRYABLE_STATUS.has(status);

    if (shouldRetry) {
      cfg.__retryCount = cfg.__retryCount || 0;
      const maxRetries = 2;
      if (cfg.__retryCount < maxRetries) {
        cfg.__retryCount += 1;
        // backoff exponencial simple: 350ms, 700ms
        await sleep(350 * cfg.__retryCount);
        return api(cfg);
      }
    }

    return Promise.reject(err);
  }
);






// opcional, por si en algÃºn archivo usas `import api from ...`
export default api;
