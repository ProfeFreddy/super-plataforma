const functions = require("firebase-functions");
const axios = require("axios");
const crypto = require("crypto");

const FLOW_API_KEY = "32DFEB9D-C49C-4388-911B-97A43C410LBA";
const FLOW_SECRET  = "7785925932dbb93630b6318ad747db3daf63a08f";
const FLOW_URL     = "https://www.flow.cl/api";
const BASE_URL     = "https://juego.pragmaprofe.com";

function firmarFlow(params) {
  const keys = Object.keys(params).sort();
  let cadena = "";
  for (const k of keys) cadena += k + params[k];
  return crypto.createHmac("sha256", FLOW_SECRET).update(cadena).digest("hex");
}

exports.crearPago = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const { plan, email, nombre } = req.body;
  console.log("crearPago llamado con plan:", plan, "email:", email);

  const planes = {
    "profe_mensual":          { monto: 4990,   desc: "GincanaNexus - Profe Individual Mensual" },
    "profe_anual":            { monto: 39990,  desc: "GincanaNexus - Profe Individual Anual" },
    "colegio_5_mensual":      { monto: 14990,  desc: "GincanaNexus - Pack Colegio 5 Profes Mensual" },
    "colegio_5_anual":        { monto: 99990,  desc: "GincanaNexus - Pack Colegio 5 Profes Anual" },
    "colegio_ilimit_mensual": { monto: 29990,  desc: "GincanaNexus - Colegio Ilimitado Mensual" },
    "colegio_ilimit_anual":   { monto: 199990, desc: "GincanaNexus - Colegio Ilimitado Anual" },
  };

  const seleccionado = planes[plan];
  if (!seleccionado) {
    return res.status(400).json({ error: "Plan invalido: " + plan });
  }

  const comercioOrden = `GN-${Date.now()}`;
  const params = {
    apiKey:          FLOW_API_KEY,
    commerceOrder:   comercioOrden,
    subject:         seleccionado.desc,
    currency:        "CLP",
    amount:          String(seleccionado.monto),   // ✅ string para la firma
    email:           email,
    urlConfirmation: `${BASE_URL}/api/flow-confirmacion`,
    urlReturn:       `${BASE_URL}/pago-exitoso.html?orden=${comercioOrden}&plan=${plan}&nombre=${encodeURIComponent(nombre || "")}`,
  };
  params.s = firmarFlow(params);

  try {
    // ✅ POST con form-urlencoded (no query string)
    const resp = await axios.post(
      `${FLOW_URL}/payment/create`,
      new URLSearchParams(params),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const data = resp.data;
    console.log("Flow respuesta:", JSON.stringify(data));
    const urlPago = `${data.url}?token=${data.token}`;
    return res.json({ url: urlPago, orden: comercioOrden });
  } catch (e) {
    console.error("Flow error:", e.response?.data || e.message);
    return res.status(500).json({ error: "Error al crear pago en Flow", detalle: e.response?.data || e.message });
  }
});

exports.flowConfirmacion = functions.https.onRequest(async (req, res) => {
  const token = req.body.token || req.query.token;
  if (!token) return res.status(400).send("Sin token");

  const params = {
    apiKey: FLOW_API_KEY,
    token:  token,
  };
  params.s = firmarFlow(params);

  try {
    const resp = await axios.get(`${FLOW_URL}/payment/getStatus`, { params });
    const data = resp.data;
    if (data.status === 2) {
      console.log("Pago aprobado:", data.commerceOrder, data.payer);
    }
    return res.status(200).send("OK");
  } catch (e) {
    console.error(e.message);
    return res.status(500).send("Error");
  }
});