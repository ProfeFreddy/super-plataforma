// functions/index.js 
// Firebase Functions Gen2 + Express. Flow con firma HMAC y form-url-encoded.

const { onRequest } = require("firebase-functions/v2/https");

let initError = null;
let app = null;

function buildApp() {
  const express = require("express");
  const cors = require("cors");
  const axios = require("axios");
  const crypto = require("crypto");

  // ====== ENV ======
  const FLOW_API_KEY   = process.env.FLOW_API_KEY;            // requerido
  const FLOW_SECRET    = process.env.FLOW_SECRET_KEY;         // requerido
  const FLOW_MERCHANT  = process.env.FLOW_MERCHANT || "";     // opcional

  // En producción usa el endpoint oficial de Flow
  const FLOW_API_URL   = (process.env.FLOW_API_URL || "https://www.flow.cl/api").replace(/\/+$/, ""); // <<< mantiene tu cambio

  // Base pública de este backend para webhooks (no pongas el front aquí)
  // Puedes sobreescribir con PUBLIC_BASE_URL en variables de entorno si cambias región/URL.
  const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://us-central1-pragma-2c5d1.cloudfunctions.net/api").replace(/\/+$/, ""); // <<< mantiene tu cambio

  // ====== Helpers ======
  const sortObject = (obj) =>
    Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});

  // Normaliza: sin undefined/null y TODO como string
  function normalizeParams(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === undefined || v === null) continue;
      out[k] = String(v);
    }
    return out;
  }

  // Construye la cadena para firmar (sin URL-encoding)
  function buildSigningString(params) {
    const normalized = normalizeParams(params);
    delete normalized.s;
    const sorted = sortObject(normalized);
    return Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join("&");
  }

  // Variante alternativa: firma sobre la cadena ya URL-encoded
  function buildSigningStringURLEncoded(params) {
    const normalized = normalizeParams(params);
    delete normalized.s;
    const sorted = sortObject(normalized);
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(sorted)) usp.append(k, v);
    return usp.toString(); // k=v&k2=v2 pero con encoding
  }

  function sign(str, secret) {
    return crypto.createHmac("sha256", secret).update(str).digest("hex");
  }

  function formEncode(params) {
    const { URLSearchParams } = require("url");
    const s = new URLSearchParams();
    const normalized = normalizeParams(params);
    Object.entries(normalized).forEach(([k, v]) => s.append(k, v));
    return s;
  }

  // ====== App ======
  const a = express();
  a.set("trust proxy", true);
  a.use(cors({ origin: true }));
  a.options("*", cors({ origin: true }));
  // === para recibir webhooks x-www-form-urlencoded también ===
  a.use(express.urlencoded({ extended: false }));
  a.use(express.json({ limit: "2mb" }));

  a.get("/", (_req, res) => res.json({ ok: true, service: "api", ts: Date.now() }));
  a.get("/ping", (_req, res) => res.status(200).send("pong")); // <- test rápido

  a.get("/health", (_req, res) => {
    if (initError) return res.status(500).json({ ok: false, initError: String(initError) });
    return res.json({ ok: true, ts: Date.now() });
  });

  // Mini debug de env (no expone secretos)
  a.get("/debug/env", (_req, res) => {
    res.json({
      hasKey: !!FLOW_API_KEY,
      hasSecret: !!FLOW_SECRET,
      apiUrl: FLOW_API_URL,
      hasMerchant: !!FLOW_MERCHANT,
      publicBase: PUBLIC_BASE_URL
    });
  });

  // Debug de firma (NO expone secret); útil contra el 108
  a.post("/debug/sign", (req, res) => {
    try {
      const sample = normalizeParams(req.body || {});
      const s1 = buildSigningString(sample);
      const s2 = buildSigningStringURLEncoded(sample);
      res.json({ ok: true, plain: s1, encoded: s2, note: "Esto es lo que se firma (sin el secret)" });
    } catch (e) {
      res.status(500).json({ ok: false, err: String(e) });
    }
  });

  // ============= FLOW: crear pago =================
  a.post("/flow/init", async (req, res) => {
    try {
      const { plan, email, amount, returnUrl } = req.body || {};

      // Email lo dejamos opcional (Flow igual acepta vacío)
      if (!plan || !amount || !returnUrl) { // <<< ya NO exige email
        return res.status(400).json({ ok: false, message: "MISSING_FIELDS" });
      }
      if (!FLOW_API_KEY || !FLOW_SECRET || !FLOW_API_URL) {
        return res.status(500).json({ ok: false, message: "FLOW_CONFIG_MISSING" });
      }

      const flowEndpoint = `${FLOW_API_URL}/payment/create`;

      // Aseguramos amount entero positivo
      const amountInt = Math.max(0, Math.round(Number(amount) || 0));

      // Base de parámetros (sin 's')
      const base = {
        apiKey: FLOW_API_KEY,
        commerceOrder: `${Date.now()}-${plan}`,
        subject: `PragmaProfe - Plan ${plan}`,
        currency: "CLP",
        amount: amountInt,
        email: email || "",                                             // opcional
        urlReturn: returnUrl,
        urlConfirmation: `${PUBLIC_BASE_URL}/flow/webhook`,
        ...(FLOW_MERCHANT ? { merchantId: FLOW_MERCHANT } : {})
      };

      // 1) Firma “plana” (más común)
      const strPlain = buildSigningString(base);
      const sigPlain = sign(strPlain, FLOW_SECRET);
      let form = formEncode({ ...base, s: sigPlain });

      const tryPost = async (label, payload) => {
        return axios.post(flowEndpoint, payload, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 20_000,
          validateStatus: () => true
        }).then(r => ({ label, status: r.status, data: r.data }));
      };

      // Primer intento
      let r = await tryPost("plain", form);

      // Si Flow devuelve 108 (firma inválida), probamos variante “URL-encoded”
      const is108 =
        r.status >= 400 &&
        (r.data?.code === 108 ||
         r.data?.detail?.code === 108 ||
         /108/.test(JSON.stringify(r.data || {})));

      if (is108) {
        const strEnc = buildSigningStringURLEncoded(base);
        const sigEnc = sign(strEnc, FLOW_SECRET);
        const form2 = formEncode({ ...base, s: sigEnc });
        const r2 = await tryPost("encoded", form2);

        if (r2.status >= 200 && r2.status < 300) {
          r = r2;
        } else {
          r = r2.status >= r.status ? r2 : r;
        }
      }

      // === NUEVO: modo debug opcional (no expone secretos) ===
      if (req.query && String(req.query.debug) === "1") {
        const dbgPlain = buildSigningString(base);
        const dbgEnc = buildSigningStringURLEncoded(base);
        console.log("[FLOW DEBUG] plain=", dbgPlain);
        console.log("[FLOW DEBUG] encoded=", dbgEnc);
      }

      if (r.status < 200 || r.status >= 300) {
        console.error("[FLOW_INIT_ERROR]", { status: r.status, data: r.data });
        return res.status(500).json({ ok: false, message: "FLOW_ERROR", detail: r.data });
      }

      const data = r?.data || {};
      const { url, token } = data;

      // ✅ Host correcto para redirección si solo viene token
      const isSandbox = /sandbox/i.test(FLOW_API_URL);
      const payHost = isSandbox ? "https://sandbox.flow.cl" : "https://www.flow.cl";

      const redirectUrl =
        url ||
        (token ? `${payHost}/app/web/pay.php?token=${encodeURIComponent(token)}` : null);

      if (!redirectUrl) {
        return res.status(502).json({ ok: false, message: "FLOW_BAD_RESPONSE", detail: data });
      }
      return res.json({ ok: true, url: redirectUrl, token, detail: data });
    } catch (err) {
      const detail = err?.response?.data || err.message || String(err);
      console.error("[FLOW_INIT_ERROR_THROWN]", detail);
      return res.status(500).json({ ok: false, message: "FLOW_ERROR", detail });
    }
  });

  // Webhook opcional (asegúrate de poner esta URL en Flow si lo usas)
  a.post("/flow/webhook", (req, res) => {
    try {
      console.log("[FLOW_WEBHOOK]", req.body);
      res.status(200).send("OK");
    } catch (e) {
      console.error("[FLOW_WEBHOOK_ERROR]", e);
      res.status(500).send("ERR");
    }
  });

  return a;
}

try {
  app = buildApp();
} catch (e) {
  console.error("[INIT_ERROR]", e);
  initError = e;
  const express = require("express");
  const a = express();
  a.get("/health", (_req, res) => res.status(500).json({ ok: false, initError: String(e) }));
  a.all("*", (_req, res) => res.status(500).json({ ok: false, initError: String(e) }));
  app = a;
}

// =========================================================
// 🔹 ENDPOINT BASE DISPONIBLE PÚBLICAMENTE 🔹
// Usa en frontend o Postman:
// https://us-central1/pragma-2c5d1.cloudfunctions.net/api/flow/init
// =========================================================

// Export dual para compatibilidad con firebase.json (app o api)
const opts = { region: "us-central1", timeoutSeconds: 300, memory: "512MiB" };
exports.api = onRequest(opts, app);
exports.app = onRequest(opts, app); // <-- alias extra por si usas "app" en rewrites
