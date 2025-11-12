// C:\Users\ADMIN-15\super-plataforma\server\server.cjs 
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", true);

// ===== Diagnóstico de arranque =====
try {
  const apiDir = path.join(__dirname, "..", "api");
  const items = fs.existsSync(apiDir) ? fs.readdirSync(apiDir) : [];
  console.log("[API] __dirname:", __dirname);
  console.log("[API] Contenido de /api:", items);
} catch (e) {
  console.warn("[API] No se pudo listar /api:", e.message);
}

// ===== Health =====
app.get("/", (_req, res) => res.status(200).json({ ok: true, root: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, healthz: true, ts: Date.now() }));
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, api_health: true, ts: Date.now() }));

// ===== MINEDUC (lo tuyo) =====
try {
  app.get("/api/mineduc", require("../api/mineduc.cjs"));
  console.log("[API] /api/mineduc montado correctamente.");
} catch (e) {
  console.warn("[API] mineduc no disponible:", e.message);
}

// Evitar 404 del favicon
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// Preflight CORS para evitar 404 en OPTIONS
app.options("/flow/init", cors());
app.options("/api/flow/init", cors());
app.options("/flow/create", cors());
app.options("/api/flow/create", cors());
// ⬇️ Añadido: respuesta explícita 204 por si algún preflight no termina
app.options(
  ["/flow/init", "/api/flow/init", "/flow/create", "/api/flow/create"],
  cors(),
  (_req, res) => res.sendStatus(204)
);

// ===== FLOW: intenta cargar handler real y agrega alias =====
function tryRequire(paths) {
  for (const p of paths) {
    try { return require(p); } catch {}
  }
  return null;
}

const flowModule = tryRequire([
  "../api/flow.cjs",
  "../api/flow/index.cjs",
  "../api/flow.js",
  "../api/flow/index.js",
]);

let flowHandler = null;

if (flowModule) {
  // puede exportar default, init, o ser una función directa
  flowHandler = (typeof flowModule === "function")
    ? flowModule
    : (flowModule.init || flowModule.default || null);

  if (typeof flowHandler !== "function") {
    console.warn("[API] flowModule cargado pero no expone función init/default; usaré stub.");
    flowHandler = async (req, res) => {
      res.json({ ok: true, stub: true, reason: "flow module sin función exportada", received: req.body ?? null, ts: Date.now() });
    };
  } else {
    console.log("[API] /flow handler REAL detectado.");
  }
} else {
  console.warn("[API] No se encontró módulo de Flow (api/flow.*); usaré stub.");
  flowHandler = async (req, res) => {
    res.json({ ok: true, stub: true, reason: "sin módulo api/flow.*", received: req.body ?? null, ts: Date.now() });
  };
}

// envoltorio seguro
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Alias aceptados por el front y por pruebas manuales (init/create, con/sin /api)
const FLOW_PATHS = [
  "/flow/init",
  "/api/flow/init",
  "/flow/create",
  "/api/flow/create",
];

for (const p of FLOW_PATHS) {
  app.post(p, wrap(flowHandler));
}
console.log("[API] Rutas FLOW montadas:", FLOW_PATHS.join(", "));

// Logger para cualquier cosa bajo /flow que no coincida (ayuda a depurar 404)
app.all("/flow", (req, res) => {
  console.warn("[API] Ruta /flow no encontrada:", req.method, req.path);
  res.status(404).json({ error: true, msg: "ruta no encontrada", method: req.method, path: req.path, valid: FLOW_PATHS });
});
app.all("/api/flow", (req, res) => {
  console.warn("[API] Ruta /api/flow no encontrada:", req.method, req.path);
  res.status(404).json({ error: true, msg: "ruta no encontrada", method: req.method, path: req.path, valid: FLOW_PATHS });
});

// ===== Manejo de errores =====
app.use((err, req, res, _next) => {
  console.error("[API] Error:", err);
  res.status(err.status || err.statusCode || 500).json({
    error: true,
    message: err.message || "Internal Server Error",
  });
});

// ===== Arranque =====
const PORT = process.env.PORT || 8080; // Cloud Run espera 8080
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log("✅ Flow API escuchando en", `${HOST}:${PORT}`, "PORT env=", process.env.PORT);
});


