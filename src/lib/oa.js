// src/lib/oa.js
const OA_PROXY = import.meta.env.VITE_OA_PROXY || ""; // p.ej. http://localhost:3000

/** Construye URL al proxy con los mismos query params */
function buildUrl(params = {}) {
  const u = new URL(`${OA_PROXY}/mineduc`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/** Llama al proxy y normaliza la respuesta (real o mock) */
export async function buscarOA(params) {
  const url = buildUrl(params);
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`OA proxy error ${r.status}`);
  const data = await r.json();

  // Normalización: si es mock viene { items: [...] }, si es real puede venir otro formato
  const items =
    Array.isArray(data) ? data :
    Array.isArray(data.items) ? data.items :
    Array.isArray(data.data) ? data.data :
    [];

  return { raw: data, items };
}
