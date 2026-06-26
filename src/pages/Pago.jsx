// src/pages/Pago.jsx
// Este archivo mantiene toda la lógica de pago (Flow + PayPal) y redirige la UI a /planes.

import "../firebase";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { PLAN_CAPS } from "../lib/planCaps";

/* ─── CONFIG ─── */
const API_FALLBACK = "https://us-central1-pragma-2c5d1.cloudfunctions.net/api";

const API_BASE_RAW =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "";

const API_BASE = (() => {
  try {
    const raw = String(API_BASE_RAW || "").trim();
    if (!raw || raw.startsWith("/") || !/^https?:/i.test(raw)) return API_FALLBACK;
    const u = new URL(raw);
    const looksServerless = /(cloudfunctions\.net|run\.app)$/i.test(u.host || "");
    const sameOrigin = typeof window !== "undefined" && window.location.hostname === u.hostname;
    if (!looksServerless && sameOrigin) return API_FALLBACK;
    return (u.origin + u.pathname).replace(/\/+$/, "") || API_FALLBACK;
  } catch { return API_FALLBACK; }
})();

const RETURN_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_RETURN_URL) ||
  "https://pragmaprofe.com/#/pago?flowReturn=1";

export const PRICE_MAP = {
  FREE: 0,
  BASICO: 9990,
  PRO: 19990,
  PREMIUM: 29990,
  PROFE_PRO: 9990,
  PROFE_ELITE: 19990,
  COLEGIO_BASICO: 59990,
};

/* ─── HELPERS ─── */
function clearAllCountdowns() {
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "inicioClase_countdown_end" || k.startsWith("ic_countdown_end:") || k.startsWith("crono:"))
        toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export function marcarPendienteDeActivar(plan = "BASICO", months = 1) {
  try {
    localStorage.setItem("pendingPlan", plan);
    localStorage.setItem("pendingMonths", String(months));
    localStorage.setItem("pendingTS", String(Date.now()));
  } catch {}
}

export async function activarPlanLocalFallback(plan = "BASICO", months = 1) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Usuario no autenticado");
  const caps = PLAN_CAPS?.[plan];
  if (!caps) throw new Error("Plan inválido");
  const end = Timestamp.fromDate(new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000));
  await setDoc(
    doc(db, "users", uid),
    { plan, limits: caps, period: { start: serverTimestamp(), end }, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function activarPlanViaBackend(plan = "BASICO", months = 1) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid) throw new Error("Usuario no autenticado");
    const fn = getFunctions(app, "southamerica-east1");
    const setPlan = httpsCallable(fn, "setPlanV2");
    await setPlan({ uid, plan, months });
    return true;
  } catch (e) {
    console.warn("[Pago] setPlanV2 falló, uso fallback local:", e?.message);
    try { await activarPlanLocalFallback(plan, months); return false; }
    catch (err) { console.error("[Pago] Fallback también falló:", err); return false; }
  }
}

export async function intentarActivarSiPendiente() {
  const plan = localStorage.getItem("pendingPlan");
  const months = Number(localStorage.getItem("pendingMonths") || 1);
  if (!plan) return false;
  await activarPlanViaBackend(plan, months);
  localStorage.removeItem("pendingPlan");
  localStorage.removeItem("pendingMonths");
  localStorage.removeItem("pendingTS");
  return true;
}

/* ─── FLOW ─── */
const normalizeFlowUrl = (url) => {
  try {
    const u = new URL(url);
    const token = u.searchParams.get("token");
    if (!token) return url;
    const isSandbox = /sandbox\.flow\.cl/i.test(u.hostname);
    const host = isSandbox ? "https://sandbox.flow.cl" : "https://www.flow.cl";
    return `${host}/app/web/pay.php?token=${token}`;
  } catch { return url; }
};

const preOpenWindow = () => {
  try {
    const w = window.open("", "_blank");
    if (w?.document) {
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Abriendo Flow…</title>
      <style>html,body{height:100%;margin:0;font-family:system-ui}
      .box{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.75rem}
      .s{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}</style></head>
      <body><div class="box"><div class="s"></div><div>Redirigiendo a Flow…</div></div></body></html>`);
      w.document.close();
    }
    return w;
  } catch { return null; }
};

async function crearPagoHttp(plan, precio, email) {
  const urls = [`${API_BASE}/api/flow/init`, `${API_BASE}/flow/init`, `${API_FALLBACK}/flow/init`];
  const body = JSON.stringify({ plan, email, amount: Number(precio), returnUrl: RETURN_URL });
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json().catch(() => ({}));
      const payUrl = out?.payUrl || out?.url || out?.paymentUrl || "";
      let token = out?.token;
      if (!token && payUrl) { try { token = new URL(payUrl).searchParams.get("token"); } catch {} }
      if (!token) throw new Error("No se recibió token");
      const isSandbox = /sandbox/i.test(payUrl);
      const host = isSandbox ? "https://sandbox.flow.cl" : "https://www.flow.cl";
      return `${host}/app/web/pay.php?token=${encodeURIComponent(token)}`;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No fue posible crear el pago");
}

async function crearPagoCallable(plan, precio) {
  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear({ plan, precio: Number(precio), uid: auth?.currentUser?.uid, email: auth?.currentUser?.email || "" });
    const out = typeof res?.data === "string" ? { url: res.data } : res?.data || {};
    const raw = out?.url || out?.paymentUrl || "";
    return normalizeFlowUrl(raw || `https://sandbox.flow.cl/app/web/pay.php?token=DUMMY-${Date.now()}`);
  } catch {
    return `https://sandbox.flow.cl/app/web/pay.php?token=DUMMY-${Date.now()}`;
  }
}

function abrirVentanaPago(url) {
  const preWin = preOpenWindow();
  if (preWin) {
    try { preWin.location.href = url; } catch {}
    setTimeout(() => { try { window.location.href = "/home"; } catch {} }, 600);
    return;
  }
  const w = window.open(url, "_blank");
  if (!w) window.location.href = url;
  else setTimeout(() => { window.location.href = "/home"; }, 600);
}

export async function pagarConFlowHttp(plan, precio, months = 1) {
  const u = auth?.currentUser;
  if (!u || u.isAnonymous) { alert("Para suscribirte debes iniciar sesión."); clearAllCountdowns(); window.location.href = "/#/login"; return; }
  marcarPendienteDeActivar(String(plan).toUpperCase(), Number(months) || 1);
  const url = await crearPagoHttp(String(plan).toUpperCase(), precio, u.email || "");
  abrirVentanaPago(url);
}

export async function pagarConFlow(plan, precio, months = 1) {
  const u = auth?.currentUser;
  if (!u || u.isAnonymous) { alert("Para suscribirte debes iniciar sesión."); clearAllCountdowns(); window.location.href = "/#/login"; return; }
  marcarPendienteDeActivar(String(plan).toUpperCase(), Number(months) || 1);
  const url = await crearPagoCallable(String(plan).toUpperCase(), precio);
  abrirVentanaPago(url);
}

export async function pagarSmart(plan, precio, months = 1) {
  try {
    await pagarConFlowHttp(plan, precio, months);
  } catch (e) {
    console.warn("[Pago] HTTP falló, uso callable:", e?.message);
    try { await pagarConFlow(plan, precio, months); }
    catch (e2) { console.error("[Pago] Callable también falló:", e2?.message); alert("No se pudo iniciar el pago con Flow. Inténtalo nuevamente."); }
  }
}

/* ─── PAYPAL ─── */
export async function pagarConPayPal(plan, precioUSD, months = 1) {
  const u = auth?.currentUser;
  if (!u || u.isAnonymous) { alert("Para suscribirte debes iniciar sesión."); window.location.href = "/#/login"; return; }
  marcarPendienteDeActivar(String(plan).toUpperCase(), Number(months) || 1);

  // URL de PayPal con monto y descripción
  const returnUrl = encodeURIComponent("https://pragmaprofe.com/#/pago?flowReturn=1");
  const cancelUrl = encodeURIComponent("https://pragmaprofe.com/#/planes");
  const desc = encodeURIComponent(`PragmaProfe ${plan} ${months === 1 ? "mensual" : "anual"}`);
  const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=pagos@pragmaprofe.com&item_name=${desc}&amount=${precioUSD}&currency_code=USD&return=${returnUrl}&cancel_return=${cancelUrl}`;

  marcarPendienteDeActivar(String(plan).toUpperCase(), Number(months) || 1);
  window.open(paypalUrl, "_blank");
}

/* ─── PÁGINA /pago → redirige a /planes ─── */
export default function Pago() {
  const navigate = useNavigate();
  const location = useLocation();

  const shouldCheckReturn = (() => {
    const qs = new URLSearchParams(location.search || "");
    return qs.get("flowReturn") === "1" || qs.get("paid") === "1" || qs.get("retorno") === "1";
  })();

  useEffect(() => {
    if (!shouldCheckReturn) {
      // Redirige a /planes si no es retorno de Flow
      navigate("/planes", { replace: true });
      return;
    }
    intentarActivarSiPendiente()
      .then((ok) => { if (ok) navigate("/InicioClase?paid=1", { replace: true }); })
      .catch((e) => console.warn("[Pago] No se pudo activar:", e?.message));
  }, [shouldCheckReturn, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", fontFamily: "Segoe UI, sans-serif" }}>
      <div>Procesando pago…</div>
    </div>
  );
}