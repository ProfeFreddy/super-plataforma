const express = require("express");
const cors = require("cors");
const axios = require("axios");

// ⬅️ NUEVO: variables de entorno (.env)
require("dotenv").config();

// ⬇️ NUEVO: módulos nativos para ejecutar Python y manejar archivos/rutas
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();

// CORS abierto para desarrollo local
app.use(cors());
app.use(express.json());
app.set("trust proxy", true); // para que req.protocol funcione detrás de proxy

// ⬅️ NUEVO: opcional, restringe origen si defines CORS_ORIGIN en .env (no elimina el cors() de arriba)
if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    })
  );
}

// ⬇️ NUEVO: RUTAS DE TU PC (ajústalas si difieren) — usando path.join para evitar problemas de backslashes
const PY_DIR = path.join("C:", "Users", "ADMIN-15", "tools", "generador-3d");
const PYTHON = path.join(PY_DIR, ".venv", "Scripts", "python.exe");
const SHAPE_SCRIPT = path.join(PY_DIR, "shape_prompt2glb.py");

// Avisos útiles en consola
if (!fs.existsSync(PYTHON)) console.warn("[WARN] No se encontró Python en:", PYTHON);
if (!fs.existsSync(SHAPE_SCRIPT)) console.warn("[WARN] No se encontró el script:", SHAPE_SCRIPT);

// ⬇️ NUEVO: carpeta de salida y estáticos (sirve los GLB generados)
// Quedará en: server/public/glb/
const OUT_DIR = path.resolve(__dirname, "public", "glb");
fs.mkdirSync(OUT_DIR, { recursive: true });
app.use("/files", express.static(OUT_DIR));

// Healthcheck
app.get("/ping", (req, res) => res.json({ ok: true }));

/* ──────────────────────────────────────────────────────────────
   ⬅️ NUEVO: Proxy de pago — POST /api/flow/init
   Body: { plan, monto, email }
   Respuesta: { token, payUrl }
   Reenvía a tu función HTTP "crearPagoFlowHttp" (configurable vía .env)
   ────────────────────────────────────────────────────────────── */
app.post("/api/flow/init", async (req, res) => {
  try {
    const { plan, monto, email } = req.body || {};
    if (!plan || !monto) {
      return res.status(400).json({ error: "Faltan campos: plan y monto" });
    }

    const FLOW_FN_URL =
      process.env.FLOW_FN_URL ||
      "https://southamerica-east1-pragma-2c5d1.cloudfunctions.net/crearPagoFlowHttp";

    // reenviamos a la Cloud Function que realmente crea el pago en Flow
    const r = await axios.post(
      FLOW_FN_URL,
      { plan, precio: Number(monto), email: email || "" },
      { headers: { "Content-Type": "application/json" }, validateStatus: () => true }
    );

    const data = r.data || {};
    if (r.status < 200 || r.status >= 300) {
      return res.status(502).json({ error: "FlowFn error", status: r.status, detail: data });
    }

    // normalizamos salida a { token, payUrl }
    let token = data?.token;
    let payUrl = data?.payUrl || data?.url || data?.paymentUrl || data?.paymentURL;

    if (!token && payUrl) {
      try {
        const u = new URL(String(payUrl));
        token = u.searchParams.get("token");
      } catch {}
    }
    if (!token) {
      return res.status(500).json({ error: "Respuesta sin token ni payUrl", raw: data });
    }

    // sandbox por defecto si no podemos inferir
    const isSandbox = /sandbox/i.test(String(payUrl || "")) || true;
    const host = isSandbox ? "https://sandbox.flow.cl" : "https://www.flow.cl";
    payUrl = `${host}/app/web/pay.php?token=${encodeURIComponent(token)}`;

    return res.json({ token, payUrl });
  } catch (err) {
    console.error("[/api/flow/init] error:", err?.message || err);
    return res.status(500).json({ error: "server_error", detail: String(err?.message || err) });
  }
});

// 🔎 Proxy hacia Mineduc (el endpoint público actual devuelve 404)
// Lo dejamos para depurar/registrar exactamente qué URL estamos intentando.
app.get("/mineduc", async (req, res) => {
  try {
    const { asignatura = "matematica", nivel = "media", unidad = "" } = req.query;

    // ⚠️ Esta URL hoy NO existe (404). Mantenerla nos ayuda a depurar.
    const url =
      `https://www.curriculumnacional.cl/api/v1/oa/buscar` +
      `?asignatura=${encodeURIComponent(asignatura)}` +
      `&nivel=${encodeURIComponent(nivel)}` +
      `&unidad=${encodeURIComponent(unidad)}`;

    console.log(`[proxy /mineduc] GET -> ${url}`);

    const r = await axios.get(url, {
      headers: { "User-Agent": "pragma-app", Accept: "application/json" },
      maxRedirects: 5,
      // Deja pasar 4xx/5xx para poder reenviarlos con info
      validateStatus: () => true,
    });

    if (r.status >= 400) {
      return res.status(r.status).json({
        error: true,
        status: r.status,
        message: `Mineduc respondió ${r.status} (endpoint probablemente inválido)`,
        url,
        body: typeof r.data === "string" ? r.data.slice(0, 500) : r.data,
      });
    }

    return res.json(r.data);
  } catch (e) {
    console.error("[proxy /mineduc] error:", e?.message);
    return res
      .status(500)
      .json({ error: true, message: e?.message || "Proxy error" });
  }
});

// 🧪 Mock temporal con datos de ejemplo (para seguir avanzando sin el endpoint real)
app.get("/mineduc/mock", (req, res) => {
  const unidad = (req.query.unidad || "").toLowerCase();
  const base = [
    {
      id: "OA-MAT-1",
      descripcion:
        "Resolver problemas que involucren operaciones con fracciones y sus representaciones equivalentes.",
      nivel: "1° medio",
      asignatura: "Matemática",
      fuente: "mock",
    },
    {
      id: "OA-MAT-2",
      descripcion:
        "Aplicar propiedades de los números racionales en contextos cotidianos.",
      nivel: "1° medio",
      asignatura: "Matemática",
      fuente: "mock",
    },
  ];

  // Filtro simple por palabra clave de la unidad (ej. 'fracciones')
  const resultados =
    unidad && unidad.length > 2
      ? base.filter((x) => x.descripcion.toLowerCase().includes(unidad))
      : base;

  res.json({ unidadSolicitada: unidad, resultados });
});

// Proxy para Wikipedia (OK)
app.get("/wiki", async (req, res) => {
  try {
    const q = req.query.q || "";
    const url = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q
    )}&format=json&origin=*`;
    const r = await axios.get(url, { maxRedirects: 5 });
    res.json(r.data);
  } catch (e) {
    console.error("[proxy /wiki] error:", e?.message);
    res.status(500).json({ error: true, message: e?.message || "Proxy error" });
  }
});

// ⬇️ NUEVO: endpoint que ejecuta tu script Python y devuelve la URL del GLB
app.post("/shape/generate", (req, res) => {
  const { prompt = "cubo", base = 1, altura = 1, thickness = 0.06, outName } = req.body || {};
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
  const fname = safe(outName || `shape_${Date.now()}.glb`);
  const outPath = path.join(OUT_DIR, fname);

  const args = [
    SHAPE_SCRIPT,
    "--prompt", String(prompt),
    "--base", String(base),
    "--altura", String(altura),
    "--thickness", String(thickness),
    "--out", outPath,
  ];

  console.log("[shape/generate] Ejecutando:", PYTHON, args.map(a => `"${a}"`).join(" "));

  const proc = spawn(PYTHON, args, {
    cwd: PY_DIR,          // ⬅️ importante para imports/rutas relativas del script
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let log = "", err = "";
  proc.stdout.on("data", (d) => (log += d.toString()));
  proc.stderr.on("data", (d) => (err += d.toString()));

  proc.on("error", (e) => {
    console.error("[shape/generate] spawn error:", e?.message);
    res.status(500).json({ ok: false, error: e?.message || "spawn error" });
  });

  proc.on("close", (code) => {
    console.log("[shape/generate] exit code:", code);
    if (code === 0 && fs.existsSync(outPath)) {
      const host = req.get("host") || `localhost:${process.env.PORT || 8080}`;
      const protocol = req.protocol || "http";
      return res.json({
        ok: true,
        url: `${protocol}://${host}/files/${fname}`,
        log
      });
    }
    res.status(500).json({ ok: false, error: err || `exit code ${code}`, log });
  });
});

// ⬇️ NUEVO (opcional): health simple del servidor
app.get("/health", (req, res) => res.send("ok"));
// server/server.js
app.get("/health", (_req, res) => res.status(200).send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] activo en http://localhost:${PORT}`);
});

