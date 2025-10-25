import crypto from "crypto";
import fetch from "node-fetch";

const FLOW_API_URL = process.env.FLOW_API_URL;
const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;

// util: ordena por clave y compone "k=v&k2=v2..."
function canonicalQuery(params) {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null && k !== "s")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&"); // <- sin encode
}

function hmac256(secret, data) {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export async function flowInit({ commerceOrder, subject, amount, email, urlReturn, urlConfirmation }) {
  const payload = {
    apiKey: FLOW_API_KEY,
    commerceOrder: String(commerceOrder),
    subject: subject,
    amount: Number(amount).toFixed(2), // 2 decimales, punto
    email: email,
    urlReturn: urlReturn,               // deben ser https públicos
    urlConfirmation: urlConfirmation,   // idem
  };

  const base = canonicalQuery(payload);    // k=v&k2=v2...
  const s = hmac256(FLOW_SECRET_KEY, base);
  const body = { ...payload, s };

  const resp = await fetch(`${FLOW_API_URL}/payment/create`, { // o la ruta que uses
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`FLOW_ERROR ${resp.status}: ${err}`);
  }
  return await resp.json();
}
