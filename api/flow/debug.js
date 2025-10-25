// api/flow/debug.js  (reemplaza el contenido del debug actual por esto)
const crypto = require("crypto");
const axios = require("axios");

function canonicalQuery(params, doEncode = true) {
  return Object.keys(params)
    .sort()
    .map((k) => {
      const key = doEncode ? encodeURIComponent(k) : k;
      const val = doEncode ? encodeURIComponent(params[k]) : String(params[k]);
      return `${key}=${val}`;
    })
    .join("&");
}

function hmacHex(secret, text) {
  return crypto.createHmac("sha256", secret || "").update(text).digest("hex");
}
function hmacB64(secret, text) {
  return crypto.createHmac("sha256", secret || "").update(text).digest("base64");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    const { amount = 100, currency = "CLP", reference, email, subject } = req.body || {};
    const ref = reference || `REF-${Date.now()}`;

    const baseParams = {
      apiKey: process.env.FLOW_API_KEY,
      amount: Number(amount),
      currency,
      reference: String(ref),
      commerceOrder: String(ref),
      subject: subject || `Pago ${ref}`
    };
    if (email) baseParams.email = String(email);
    if (process.env.FLOW_CONFIRM_URL) baseParams.urlConfirmation = process.env.FLOW_CONFIRM_URL;
    if (process.env.FLOW_RETURN_URL) baseParams.urlReturn = process.env.FLOW_RETURN_URL;
    if (process.env.FLOW_MERCHANT) baseParams.merchantId = process.env.FLOW_MERCHANT;

    const secret = process.env.FLOW_SECRET_KEY || process.env.FLOW_SECRET || "";
    if (!secret) return res.status(500).json({ error: "missing_secret_env", note: "Set FLOW_SECRET_KEY" });

    const flowUrlBase = process.env.FLOW_API_URL || "https://sandbox.flow.cl/api";
    const endpointsToTry = [
      `${flowUrlBase.replace(/\/$/, "")}/pagos`,
      `${flowUrlBase.replace(/\/$/, "")}/payment/create`
    ];

    const attemptResults = [];

    // Probar dos variantes de canonicalización y dos formatos de firma
    const canonicalOptions = [true, false]; // true -> encodeURIComponent values, false -> raw
    const signatureFormats = ["hex", "b64"];

    for (const doEncode of canonicalOptions) {
      const canonical = canonicalQuery(baseParams, doEncode);

      const sigHex = hmacHex(secret, canonical);
      const sigB64 = hmacB64(secret, canonical);

      // Log seguro (solo prefijos) al servidor
      console.log(`FLOW canonical (encode=${doEncode}):`, canonical);
      console.log(`FLOW signature hex[:8]:`, sigHex.slice(0, 8));
      console.log(`FLOW signature b64[:8]:`, sigB64.slice(0, 8));

      for (const fmt of signatureFormats) {
        const signatureToSend = fmt === "hex" ? sigHex : sigB64;
        // probamos endpoints en orden hasta obtener respuesta HTTP
        let tried = [];
        for (const endpoint of endpointsToTry) {
          try {
            const bodyToFlow = { ...baseParams, signature: signatureToSend };
            const r = await axios.post(endpoint, bodyToFlow, {
              headers: { "Content-Type": "application/json" },
              validateStatus: () => true,
              timeout: 15000
            });

            attemptResults.push({
              canonicalEncoded: doEncode,
              format: fmt,
              endpoint,
              status: r.status,
              data: r.data,
              sigPrefix: signatureToSend.slice(0, 8)
            });

            // si Flow responde (incluso 4xx/5xx) lo registramos y pasamos al siguiente intento
            tried.push(endpoint);
            break;
          } catch (e) {
            // fallo de red o timeout
            attemptResults.push({
              canonicalEncoded: doEncode,
              format: fmt,
              endpoint,
              error: String(e.message || e)
            });
            tried.push(endpoint);
          }
        } // endpointsToTry
      } // signatureFormats
    } // canonicalOptions

    return res.json({ ok: true, attempts: attemptResults });
  } catch (err) {
    console.error("[/api/flow/debug] fatal:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
};

