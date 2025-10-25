import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ── NUEVO: configuración por variables de entorno ──────────────────────────────
const UPSTREAM_BASE =
  process.env.UPSTREAM_BASE ||
  "https://curriculumnacional.mineduc.cl/api/v1/oa/buscar";

const CACHE_TTL_MS = Number.isFinite(+process.env.CACHE_TTL_MS)
  ? +process.env.CACHE_TTL_MS
  : 60_000; // 60s por defecto

// Caché en memoria: key -> { expiresAt, data }
const cache = new Map();

app.use(cors());

// ───────────────────────────────────────────────────────────────────────────────
// Utilidades
// ───────────────────────────────────────────────────────────────────────────────

/** Construye la URL real al API del Mineduc con los mismos query params */
function buildUpstreamUrl(query) {
  const qs = new URLSearchParams(query);
  return `${UPSTREAM_BASE}?${qs.toString()}`;
}

/** Clave única para la caché basada en los query params */
function cacheKeyFromQuery(query) {
  // Usamos el orden normalizado que hace URLSearchParams
  const qs = new URLSearchParams(query);
  return qs.toString();
}

/** Devuelve un mock predecible para no bloquear la UI si el upstream falla */
function buildMockPayload(query) {
  const asignatura = `${query.asignatura ?? "matematica"}`.toLowerCase();
  const unidad = `${query.unidad ?? "U1"}`.toUpperCase();

  // Mini catálogo por asignatura para que el mock tenga sentido
  const catalog = {
    matematica: [
      { id: "MOCK-OA3", titulo: "OA3: Sumar fracciones", minutos: 45 },
      { id: "MOCK-OA4", titulo: "OA4: Restar fracciones", minutos: 45 },
    ],
    lenguaje: [
      { id: "MOCK-OA2", titulo: "OA2: Comprensión lectora literal", minutos: 45 },
      { id: "MOCK-OA5", titulo: "OA5: Inferencias en textos breves", minutos: 45 },
    ],
  };

  const items = catalog[asignatura] ?? [
    { id: "MOCK-OA1", titulo: "OA genérico 1", minutos: 45 },
    { id: "MOCK-OA2", titulo: "OA genérico 2", minutos: 45 },
  ];

  return {
    source: "mock",
    params: query,
    unidad,
    items: items.map((x) => ({ ...x, unidad })),
  };
}

/** Intenta parsear JSON. Si viene HTML (Drupal), devolvemos null para tratarlo como error. */
async function safeJson(response) {
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Endpoints
// ───────────────────────────────────────────────────────────────────────────────

app.get("/ping", (_req, res) => res.json({ ok: true }));

/**
 * Diagnóstico: muestra la URL real que se consulta + status
 * Ej: http://localhost:3000/mineduc/debug?asignatura=matematica&nivel=basica&cantidad=1
 */
app.get("/mineduc/debug", async (req, res) => {
  const upstream = buildUpstreamUrl(req.query);
  const key = cacheKeyFromQuery(req.query);
  const cached = cache.get(key);
  try {
    const r = await fetch(upstream, { headers: { accept: "application/json" } });
    const dataMaybe = await safeJson(r);
    res.json({
      upstream,
      status: r.status,
      ok: r.ok,
      contentType: r.headers.get("content-type") || null,
      cache: cached
        ? { hasEntry: true, expiresAt: cached.expiresAt }
        : { hasEntry: false },
      jsonPreview: dataMaybe
        ? Array.isArray(dataMaybe)
          ? dataMaybe.slice(0, 1)
          : dataMaybe
        : null,
    });
  } catch (e) {
    res.json({ upstream, error: String(e) });
  }
});

/**
 * Ruta opcional: limpia la caché en memoria
 */
app.get("/mineduc/cache/flush", (_req, res) => {
  cache.clear();
  res.json({ ok: true, flushed: true });
});

/**
 * Ruta principal que usa el frontend
 * Pasa los query params tal cual → si falla el upstream, responde un mock
 */
app.get("/mineduc", async (req, res) => {
  const upstream = buildUpstreamUrl(req.query);
  const key = cacheKeyFromQuery(req.query);

  // 1) Intento de caché
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.json(entry.data);
  }

  console.log(`[OA] → ${upstream}`);

  try {
    const r = await fetch(upstream, { headers: { accept: "application/json" } });

    // Respuesta con error del servidor (404/5xx) → fallback
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[OA][ERR] ${r.status} en upstream. Fallback -> mock`);
      const mock = buildMockPayload(req.query);
      res.setHeader("X-Proxy-Cache", "MOCK");
      return res.json(mock);
    }

    // Validamos que realmente sea JSON (a veces devuelven HTML)
    const data = await safeJson(r);
    if (!data) {
      console.warn("[OA][ERR] Upstream devolvió contenido no-JSON. Fallback -> mock");
      const mock = buildMockPayload(req.query);
      res.setHeader("X-Proxy-Cache", "MOCK");
      return res.json(mock);
    }

    // 2) Guardamos en caché y devolvemos
    cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
    res.setHeader("X-Proxy-Cache", "MISS");
    return res.json(data);
  } catch (err) {
    console.warn("[OA][ERR] Error de red. Fallback -> mock:", String(err));
    const mock = buildMockPayload(req.query);
    res.setHeader("X-Proxy-Cache", "MOCK");
    return res.json(mock);
  }
});

// ───────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`OA proxy escuchando en http://localhost:${PORT}`);
  console.log(`UPSTREAM_BASE: ${UPSTREAM_BASE}`);
  console.log(`CACHE_TTL_MS: ${CACHE_TTL_MS} ms`);
  console.log(`Diagnóstico: GET http://localhost:${PORT}/mineduc/debug?...`);
});







