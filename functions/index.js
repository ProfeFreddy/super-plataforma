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

  const admin = require("firebase-admin");
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const FLOW_API_KEY  = process.env.FLOW_API_KEY;
  const FLOW_SECRET   = process.env.FLOW_SECRET_KEY;
  const FLOW_MERCHANT = process.env.FLOW_MERCHANT || "";
  const FLOW_API_URL  = (process.env.FLOW_API_URL || "https://www.flow.cl/api").replace(/\/+$/, "");
  const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://juego.pragmaprofe.com/api").replace(/\/+$/, "");

  // ====== Helpers ======
  const sortObject = (obj) =>
    Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});

  function normalizeParams(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === undefined || v === null) continue;
      out[k] = String(v);
    }
    return out;
  }

  function buildSigningString(params) {
    const normalized = normalizeParams(params);
    delete normalized.s;
    const sorted = sortObject(normalized);
    return Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join("&");
  }

  function buildSigningStringURLEncoded(params) {
    const normalized = normalizeParams(params);
    delete normalized.s;
    const sorted = sortObject(normalized);
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(sorted)) usp.append(k, v);
    return usp.toString();
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

  // ====== Mapa de planes de suscripción ======
  const PLANES_CONFIG = {
    profe_mensual:          { meses: 1,  limite: 1   },
    profe_anual:            { meses: 12, limite: 1   },
    colegio_5_mensual:      { meses: 1,  limite: 5   },
    colegio_5_anual:        { meses: 12, limite: 5   },
    colegio_ilimit_mensual: { meses: 1,  limite: 999 },
    colegio_ilimit_anual:   { meses: 12, limite: 999 },
  };

  // Packs de gemas para la tienda del juego
  const GEMAS_CONFIG = {
    gemas_10:  { gemas: 10,  precio: 490  },
    gemas_50:  { gemas: 50,  precio: 1990 },
    gemas_150: { gemas: 150, precio: 4990 },
    gemas_500: { gemas: 500, precio: 9990 },
  };

  // ====== Activar plan en Firestore ======
  async function activarPlan(email, plan, commerceOrder) {
    try {
      const config = PLANES_CONFIG[plan];
      if (!config) {
        console.error("[ACTIVAR_PLAN] Plan desconocido:", plan);
        return false;
      }

      const usersRef = db.collection("users");
      const snap = await usersRef.where("email", "==", email).limit(1).get();

      if (snap.empty) {
        console.error("[ACTIVAR_PLAN] Usuario no encontrado:", email);
        await db.collection("pagos_pendientes").doc(commerceOrder).set({
          email, plan, commerceOrder,
          creadoEn: admin.firestore.FieldValue.serverTimestamp(),
          activado: false
        });
        return false;
      }

      const userDoc = snap.docs[0];
      const uid = userDoc.id;

      const ahora = new Date();
      const vencimiento = new Date(ahora);
      vencimiento.setMonth(vencimiento.getMonth() + config.meses);

      await db.collection("users").doc(uid).set({
        plan,
        planActivo: true,
        limiteDocentes: config.limite,
        planVencimiento: admin.firestore.Timestamp.fromDate(vencimiento),
        ultimoPago: {
          orden: commerceOrder,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          plan
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log("[ACTIVAR_PLAN] Plan activado:", uid, plan, "hasta", vencimiento.toISOString());
      return true;
    } catch (e) {
      console.error("[ACTIVAR_PLAN_ERROR]", e.message);
      return false;
    }
  }

  // Agregar gemas al jugador en Firestore
  async function agregarGemas(uid, email, packId, commerceOrder) {
    try {
      const config = GEMAS_CONFIG[packId];
      if (!config) {
        console.error("[AGREGAR_GEMAS] Pack desconocido:", packId);
        return false;
      }

      let userRef = null;
      if (uid) {
        userRef = db.collection("users").doc(uid);
      } else {
        const snap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!snap.empty) userRef = snap.docs[0].ref;
      }

      if (!userRef) {
        console.error("[AGREGAR_GEMAS] Usuario no encontrado:", email);
        return false;
      }

      await userRef.set({
        gemas: admin.firestore.FieldValue.increment(config.gemas),
        ultimaCompraGemas: {
          orden: commerceOrder,
          pack: packId,
          gemas: config.gemas,
          fecha: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });

      console.log(`[AGREGAR_GEMAS] +${config.gemas} gemas para ${email}`);
      return true;
    } catch (e) {
      console.error("[AGREGAR_GEMAS_ERROR]", e.message);
      return false;
    }
  }

  // ====== Helper para crear pago Flow ======
  async function crearPagoFlow({ plan, email, amount, returnUrl, subject }) {
    const flowEndpoint = `${FLOW_API_URL}/payment/create`;
    const amountInt = Math.max(0, Math.round(Number(amount) || 0));

    const base = {
      apiKey: FLOW_API_KEY,
      commerceOrder: `${Date.now()}-${plan}`,
      subject: subject || `PragmaProfe - ${plan}`,
      currency: "CLP",
      amount: amountInt,
      email: email || "",
      urlReturn: returnUrl,
      urlConfirmation: `${PUBLIC_BASE_URL}/flow/webhook`,
      ...(FLOW_MERCHANT ? { merchantId: FLOW_MERCHANT } : {})
    };

    const strPlain = buildSigningString(base);
    const sigPlain = sign(strPlain, FLOW_SECRET);
    let form = formEncode({ ...base, s: sigPlain });

    const tryPost = async (label, payload) =>
      axios.post(flowEndpoint, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 20_000,
        validateStatus: () => true
      }).then(r => ({ label, status: r.status, data: r.data }));

    let r = await tryPost("plain", form);

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
      if (r2.status >= 200 && r2.status < 300) r = r2;
      else r = r2.status >= r.status ? r2 : r;
    }

    if (r.status < 200 || r.status >= 300) {
      throw new Error(`FLOW_ERROR ${r.status}: ${JSON.stringify(r.data)}`);
    }

    const data = r?.data || {};
    const { url, token } = data;
    const isSandbox = /sandbox/i.test(FLOW_API_URL);
    const payHost = isSandbox ? "https://sandbox.flow.cl" : "https://www.flow.cl";
    const redirectUrl = token
      ? `${payHost}/app/web/pay.php?token=${encodeURIComponent(token)}`
      : url || null;

    if (!redirectUrl) throw new Error("FLOW_BAD_RESPONSE");

    return { redirectUrl, token, commerceOrder: base.commerceOrder, detail: data };
  }

  // ====== App ======
  const a = express();
  a.set("trust proxy", true);
  a.use(cors({ origin: true }));
  a.options("*", cors({ origin: true }));
  a.use(express.urlencoded({ extended: false }));
  a.use(express.json({ limit: "2mb" }));

  a.get("/", (_req, res) => res.json({ ok: true, service: "api", ts: Date.now() }));
  a.get("/ping", (_req, res) => res.status(200).send("pong"));
  a.get("/health", (_req, res) => {
    if (initError) return res.status(500).json({ ok: false, initError: String(initError) });
    return res.json({ ok: true, ts: Date.now() });
  });
  a.get("/debug/env", (_req, res) => {
    res.json({
      hasKey: !!FLOW_API_KEY,
      hasSecret: !!FLOW_SECRET,
      apiUrl: FLOW_API_URL,
      hasMerchant: !!FLOW_MERCHANT,
      publicBase: PUBLIC_BASE_URL
    });
  });

  a.get("/gemas/packs", (_req, res) => {
    res.json({ ok: true, packs: GEMAS_CONFIG });
  });

  // ============= FLOW: crear pago suscripción =================
  a.post("/flow/init", async (req, res) => {
    try {
      const { plan, email, amount, returnUrl } = req.body || {};
      if (!plan || !amount || !returnUrl)
        return res.status(400).json({ ok: false, message: "MISSING_FIELDS" });
      if (!FLOW_API_KEY || !FLOW_SECRET || !FLOW_API_URL)
        return res.status(500).json({ ok: false, message: "FLOW_CONFIG_MISSING" });

      const { redirectUrl, token, detail } = await crearPagoFlow({
        plan, email, amount, returnUrl,
        subject: `GincanaNexus - Plan ${plan}`
      });

      return res.json({ ok: true, url: redirectUrl, token, detail });
    } catch (err) {
      console.error("[FLOW_INIT_ERROR]", err.message);
      return res.status(500).json({ ok: false, message: "FLOW_ERROR", detail: err.message });
    }
  });

  // Crear pago pack de gemas
  a.post("/flow/gemas", async (req, res) => {
    try {
      const { packId, email, uid, returnUrl } = req.body || {};

      if (!packId || !email || !returnUrl)
        return res.status(400).json({ ok: false, message: "MISSING_FIELDS" });

      const pack = GEMAS_CONFIG[packId];
      if (!pack)
        return res.status(400).json({ ok: false, message: "PACK_INVALIDO", packs: Object.keys(GEMAS_CONFIG) });

      if (!FLOW_API_KEY || !FLOW_SECRET)
        return res.status(500).json({ ok: false, message: "FLOW_CONFIG_MISSING" });

      const planConUid = uid ? `${packId}__uid__${uid}` : packId;

      const { redirectUrl, token, commerceOrder, detail } = await crearPagoFlow({
        plan: planConUid,
        email,
        amount: pack.precio,
        returnUrl,
        subject: `GincanaNexus - ${pack.gemas} Gemas`
      });

      await db.collection("pagos_gemas_pendientes").doc(commerceOrder).set({
        packId, email, uid: uid || "",
        gemas: pack.gemas,
        precio: pack.precio,
        token,
        estado: "pendiente",
        creadoEn: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ ok: true, url: redirectUrl, token, gemas: pack.gemas, precio: pack.precio });
    } catch (err) {
      console.error("[FLOW_GEMAS_ERROR]", err.message);
      return res.status(500).json({ ok: false, message: "FLOW_ERROR", detail: err.message });
    }
  });

  // ============= FLOW: webhook de confirmación =================
  a.post("/flow/webhook", async (req, res) => {
    try {
      const token = req.body?.token || req.query?.token;
      if (!token) return res.status(200).send("OK");

      const params = { apiKey: FLOW_API_KEY, token };
      const sigStr = buildSigningString(params);
      params.s = sign(sigStr, FLOW_SECRET);

      const resp = await axios.get(`${FLOW_API_URL}/payment/getStatus`, {
        params, timeout: 15_000, validateStatus: () => true
      });

      const data = resp.data || {};
      console.log("[FLOW_WEBHOOK] status:", data.status, "orden:", data.commerceOrder);

      if (data.status === 2) {
        const commerceOrder = data.commerceOrder || "";
        const email = data.payer || "";

        const planRaw = commerceOrder.includes("-")
          ? commerceOrder.split("-").slice(1).join("-")
          : "";

        const esGemas = planRaw.startsWith("gemas_");

        if (esGemas) {
          const parts = planRaw.split("__uid__");
          const packId = parts[0];
          const uid = parts[1] || "";

          console.log("[FLOW_WEBHOOK] Pago gemas - pack:", packId, "uid:", uid, "email:", email);

          const ok = await agregarGemas(uid, email, packId, commerceOrder);

          if (ok) {
            const snap = await db.collection("pagos_gemas_pendientes")
              .where("token", "==", token).limit(1).get();
            if (!snap.empty)
              await snap.docs[0].ref.update({ estado: "completado" });
          }

        } else {
          const plan = planRaw;
          console.log("[FLOW_WEBHOOK] Pago plan - email:", email, "plan:", plan);

          if (email && plan)
            await activarPlan(email, plan, commerceOrder);
        }

        await db.collection("pagos").doc(commerceOrder).set({
          token, commerceOrder, email,
          plan: planRaw,
          monto: data.amount,
          status: data.status,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          flowData: data
        }, { merge: true });
      }

      return res.status(200).send("OK");
    } catch (e) {
      console.error("[FLOW_WEBHOOK_ERROR]", e.message);
      return res.status(200).send("OK");
    }
  });

  // ============= HOTMART: webhook =================
  a.post("/hotmart/webhook", async (req, res) => {
    try {
      const body = req.body || {};
      console.log("[HOTMART_WEBHOOK]", JSON.stringify(body));

      const evento = body.event || body.data?.purchase?.status || "";
      const email = body.data?.buyer?.email || body.buyer?.email || "";

      if (!email) return res.status(200).send("OK");

      const eventosValidos = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE", "PURCHASE_BILLET_PRINTED"];
      if (!eventosValidos.includes(evento)) {
        console.log("[HOTMART_WEBHOOK] Evento ignorado:", evento);
        return res.status(200).send("OK");
      }

      const emailKey = email.toLowerCase().replace(/\./g, "_").replace(/@/g, "__at__");
      await db.collection("accesos_hotmart").doc(emailKey).set({
        email: email.toLowerCase(),
        evento,
        activadoEn: admin.firestore.FieldValue.serverTimestamp(),
        activo: true,
        datos: body.data || {}
      }, { merge: true });

      console.log("[HOTMART_WEBHOOK] Acceso activado para:", email);
      return res.status(200).send("OK");
    } catch (e) {
      console.error("[HOTMART_WEBHOOK_ERROR]", e.message);
      return res.status(200).send("OK");
    }
  });

  // ============= HOTMART: verificar acceso alumno =================
  a.get("/hotmart/verificar", async (req, res) => {
    try {
      const email = (req.query.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ ok: false, acceso: false });

      const emailKey = email.replace(/\./g, "_").replace(/@/g, "__at__");
      const snap = await db.collection("accesos_hotmart").doc(emailKey).get();

      if (!snap.exists || !snap.data().activo) {
        return res.json({ ok: true, acceso: false });
      }

      return res.json({ ok: true, acceso: true, email });
    } catch (e) {
      console.error("[HOTMART_VERIFICAR_ERROR]", e.message);
      return res.status(500).json({ ok: false, acceso: false });
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

const opts = { region: "us-central1", timeoutSeconds: 300, memory: "512MiB" };
exports.api = onRequest(opts, app);
exports.app = onRequest(opts, app);