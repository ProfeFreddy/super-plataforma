// src/pages/Pago.jsx

// Asegura que Firebase se inicializa siempre
import "../firebase";

import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { httpsCallable, getFunctions } from "firebase/functions";
import { app, auth, db /* functions as exportedFunctions no se usa acá */ } from "../firebase";
import { onAuthStateChanged, /* signOut no se usa aquí */ } from "firebase/auth";
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

import { PLAN_CAPS } from "../lib/planCaps";

/* ─────────────────────────────────────────────
   CONSTANTES / CONFIG
────────────────────────────────────────────── */

// base proxy local / api same-origin
const PROXY_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PROXY_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_PROXY_URL || process.env.VITE_PROXY_BASE)) ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:8080");

// fallback Cloud Functions pública
const API_FALLBACK =
  "https://us-central1-pragma-2c5d1.cloudfunctions.net/api";

const API_BASE_RAW =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.VITE_API_BASE || process.env.REACT_APP_API_BASE)) ||
  "";

/* decide si un URL es inseguro (mismo origen no-serverless, relativo, etc.) */
function isUnsafeApiUrl(u) {
  try {
    const isBrowser = typeof window !== "undefined";
    const host = u.hostname?.toLowerCase?.() || "";
    const sameOrigin =
      isBrowser &&
      window.location &&
      window.location.hostname === host;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const path = (u.pathname || "").trim();
    const isRelativeRoot = path === "/" || path === "";

    const looksServerless = /(cloudfunctions\.net|run\.app)$/i.test(
      u.host || ""
    );

    // si es mismo origen en prod y no es serverless => inseguro
    if (!isLocal && sameOrigin && !looksServerless) return true;

    // bases como "/" o "" tampoco sirven
    if (isRelativeRoot && (!looksServerless || sameOrigin)) return true;

    return false;
  } catch {
    return true;
  }
}

/* Normaliza API_BASE con fallback seguro */
const API_BASE = (() => {
  try {
    const raw = String(API_BASE_RAW || "").trim();
    if (!raw) return API_FALLBACK;

    // relativo → fallback
    if (raw.startsWith("/") || !/^https?:/i.test(raw))
      return API_FALLBACK;

    const u = new URL(raw);
    if (isUnsafeApiUrl(u)) return API_FALLBACK;

    const base = (u.origin + u.pathname).replace(/\/+$/, "");
    return base || API_FALLBACK;
  } catch {
    return API_FALLBACK;
  }
})();

/* returnUrl que espera backend Flow */
const RETURN_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_RETURN_URL) ||
  "https://super-plataforma.web.app/pago/retorno";

// diagnóstico
try {
  console.info(
    "[Pago] API_BASE =",
    API_BASE,
    "| RETURN_URL =",
    RETURN_URL
  );
} catch {}

/* precios base */
const PRICE_MAP = {
  BASICO: 9990,
  PRO: 19990,
  PREMIUM: 29990,
};

// helper: limpiar contadores / cronos
function clearAllCountdowns() {
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k === "inicioClase_countdown_end" ||
        k.startsWith("ic_countdown_end:") ||
        k.startsWith("crono:")
      ) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

/* ─────────────────────────────────────────────
   ACTIVACIÓN DE PLAN
────────────────────────────────────────────── */

async function activarPlanLocalFallback(plan = "BASICO", months = 1) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Usuario no autenticado");

  const caps = PLAN_CAPS?.[plan];
  if (!caps) throw new Error("Plan inválido");

  const end = Timestamp.fromDate(
    new Date(
      Date.now() + months * 30 * 24 * 60 * 60 * 1000
    )
  );

  await setDoc(
    doc(db, "users", uid, "meta", "limits"),
    {
      plan,
      ...caps,
      period: { start: serverTimestamp(), end },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(
    "[Pago] Activación local fallback escrita en Firestore"
  );
}

async function activarPlanViaBackend(plan = "BASICO", months = 1) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid) throw new Error("Usuario no autenticado");

    const fn = getFunctions(app, "southamerica-east1");
    const setPlan = httpsCallable(fn, "setPlanV2"); // callable v2
    await setPlan({ uid, plan, months });
    console.log("[Pago] setPlanV2 callable OK");
    return true;
  } catch (e) {
    console.warn(
      "[Pago] setPlanV2 callable falló, uso fallback local:",
      e?.message || e
    );
    try {
      await activarPlanLocalFallback(plan, months);
      return false;
    } catch (err) {
      console.error(
        "[Pago] Fallback local también falló:",
        err
      );
      return false;
    }
  }
}

function marcarPendienteDeActivar(plan = "BASICO", months = 1) {
  try {
    localStorage.setItem("pendingPlan", plan);
    localStorage.setItem("pendingMonths", String(months));
    localStorage.setItem("pendingTS", String(Date.now()));
  } catch {}
}

async function intentarActivarSiPendiente() {
  const plan = localStorage.getItem("pendingPlan");
  const months = Number(
    localStorage.getItem("pendingMonths") || 1
  );
  if (!plan) return false;

  await activarPlanViaBackend(plan, months);

  localStorage.removeItem("pendingPlan");
  localStorage.removeItem("pendingMonths");
  localStorage.removeItem("pendingTS");

  return true;
}

/* ─────────────────────────────────────────────
   FLOW helpers
────────────────────────────────────────────── */

// UI ventana previa (abre popup antes del fetch)
const preOpenWindow = () => {
  let w = null;
  try {
    w = window.open("", "_blank");
    if (w && w.document) {
      w.document.write(`
        <!doctype html>
        <html><head><meta charset="utf-8"><title>Abriendo Flow…</title>
        <style>
          html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto}
          .box{height:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;flex-direction:column}
          .spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite}
          @keyframes spin{to{transform:rotate(360deg)}}
          .txt{color:#334155}
        </style></head>
        <body><div class="box">
          <div class="spinner"></div>
          <div class="txt">Redirigiendo a Flow…</div>
        </div></body></html>`);
      w.document.close();
    }
  } catch (_) {}
  return w;
};

// normaliza URL tipo Flow token
const normalizeFlowUrl = (url) => {
  try {
    const u = new URL(url);
    const token = u.searchParams.get("token");
    if (token) {
      const isSandbox =
        /sandbox\.flow\.cl/i.test(u.hostname) ||
        /sandbox\.flow\.cl/i.test(url);
      const host = isSandbox
        ? "https://sandbox.flow.cl"
        : "https://www.flow.cl";
      return `${host}/app/web/pay.php?token=${token}`;
    }
  } catch {}
  return url;
};

const extractUrl = (out) => {
  const candidates = [
    out,
    out?.url,
    out?.url?.url,
    out?.paymentUrl,
    out?.paymentURL,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
  }
  return null;
};

/** callable flowCreateV2 → {url} */
const callCrearPago = async (payload) => {
  const __normalize = (url) => {
    try {
      const u = new URL(url);
      const token = u.searchParams.get("token");
      const isSandbox =
        /sandbox\.flow\.cl/i.test(u.hostname) ||
        /sandbox\.flow\.cl/i.test(url);
      const host = isSandbox
        ? "https://sandbox.flow.cl"
        : "https://www.flow.cl";
      return token
        ? `${host}/app/web/pay.php?token=${token}`
        : url;
    } catch {
      return url;
    }
  };

  const __stub = () =>
    `https://sandbox.flow.cl/app/web/pay.php?token=${encodeURIComponent(
      "DUMMY-" + Date.now()
    )}`;

  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear(payload);

    const out =
      typeof res?.data === "string"
        ? { url: res.data }
        : res?.data || {};
    const raw =
      out?.url ||
      out?.paymentUrl ||
      out?.paymentURL ||
      "";
    const url = __normalize(raw || __stub());
    console.log("[Pago][Callable] respuesta:", { url });
    return { url };
  } catch (e) {
    console.warn(
      "[Pago] Callable flowCreateV2 falló, uso stub:",
      e?.code || e?.message || e
    );
    return { url: __stub() };
  }
};

// HTTP directo a /flow/init del backend
const FLOW_HTTP_URL = `${API_BASE}/flow/init`;

async function crearPagoHttp(plan, precio, email) {
  console.log("🛰️ [DEBUG Pago] API_BASE =", API_BASE);
  console.log(
    "🛰️ [DEBUG Pago] Intentando POST →",
    `${API_BASE}/flow/init`
  );

  const res = await fetch(FLOW_HTTP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan,
      email,
      amount: Number(precio),
      returnUrl: RETURN_URL,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${t || ""}`.trim()
    );
  }

  const out = await res.json().catch(() => ({}));

  const payUrl = out?.payUrl || out?.url || null;
  let token = out?.token;

  if (!token && payUrl) {
    try {
      token = new URL(payUrl).searchParams.get("token");
    } catch {}
  }
  if (!token && out?.paymentUrl) {
    try {
      token = new URL(
        out.paymentUrl
      ).searchParams.get("token");
    } catch {}
  }

  if (!token) {
    const maybe = normalizeFlowUrl(payUrl || "");
    try {
      token = new URL(maybe).searchParams.get("token");
    } catch {}
  }

  if (!token)
    throw new Error(
      "No se recibió token (ni payUrl) desde /flow/init"
    );

  const isSandbox = /sandbox/i.test(
    String(payUrl || "")
  );
  const host = isSandbox
    ? "https://sandbox.flow.cl"
    : "https://www.flow.cl";

  return `${host}/app/web/pay.php?token=${encodeURIComponent(
    token
  )}`;
}

/* enviar recordatorios antes de expirar */
async function scheduleReminders(plan, months = 1) {
  try {
    const u = auth?.currentUser;
    if (!u) return;
    await fetch(`${API_BASE}/billing/schedule-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: u.uid,
        plan,
        months,
        days_before: 5,
      }),
    });
  } catch {
    // si no existe endpoint, no rompe el flujo
  }
}

/* pagar con Flow vía HTTP */
async function pagarConFlowHttp(plan, precio, months = 1) {
  const u = auth?.currentUser;
  if (!u || u.isAnonymous) {
    alert("Para suscribirte debes iniciar sesión.");
    try {
      clearAllCountdowns();
    } catch {}
    window.location.href = "/inicio?checkout=1";
    return;
  }

  // persistimos para activación post-retorno
  marcarPendienteDeActivar(
    String(plan || "").toUpperCase(),
    Number(months) || 1
  );

  const email =
    u.email || localStorage.getItem("email") || "";

  const preWin = preOpenWindow();
  let opened = !!preWin;

  try {
    // recordatorios (no bloquea)
    scheduleReminders(plan, months);

    const payPhp = await crearPagoHttp(
      plan,
      precio,
      email
    );

    if (opened && preWin) {
      try {
        if (preWin.document) {
          preWin.document.body.innerHTML = `
            <div class="box" style="height:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              <div class="spinner" style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite"></div>
              <div style="color:#334155">Redirigiendo a Flow…</div>
              <a href="${payPhp}" style="color:#16a34a;text-decoration:none;font-weight:600">Si no continúa automáticamente, haz clic aquí</a>
              <meta http-equiv="refresh" content="0;url=${payPhp}">
              <script>setTimeout(function(){ try{ location.href=${JSON.stringify(
                payPhp
              )} }catch(e){} }, 60);</script>
            </div>`;
        }
      } catch {}
      preWin.location.href = payPhp;
    } else {
      const w = window.open(payPhp, "_blank");
      opened = !!w;
    }

    // fallback si popup bloqueado
    setTimeout(() => {
      if (!opened) window.location.href = payPhp;
    }, 300);

    // y nos vamos a /registro como "gracias"
    setTimeout(() => {
      if (opened) window.location.href = "/registro";
    }, 600);
  } catch (err) {
    try {
      if (preWin && !preWin.closed) preWin.close();
    } catch {}
    console.error("[Pago][HTTP] Error creando pago:", err);
    alert(
      `No se pudo iniciar el pago con Flow (HTTP).\nDetalle: ${
        err?.message || err
      }`
    );
  }
}

/* pagar con Flow vía callable (backup, la dejamos expuesta por compatibilidad) */
async function pagarConFlow(plan, precio, months = 1) {
  const u = auth?.currentUser;
  if (!u || u.isAnonymous) {
    alert("Para suscribirte debes iniciar sesión.");
    try {
      clearAllCountdowns();
    } catch {}
    window.location.href = "/inicio?checkout=1";
    return;
  }

  try {
    localStorage.setItem("uid", u.uid);
    if (u.email) localStorage.setItem("email", u.email);
  } catch {}

  const preWin = preOpenWindow();
  let opened = !!preWin;

  try {
    const PLAN = (plan || "")
      .toString()
      .trim()
      .toUpperCase();
    let monto = Number(precio);
    if (!Number.isFinite(monto) || monto <= 0)
      monto = PRICE_MAP[PLAN] ?? PRICE_MAP.BASICO;

    localStorage.setItem("lastPlan", PLAN);
    localStorage.setItem("lastPrecio", String(monto));
    localStorage.setItem(
      "lastModo",
      Number(months) === 12 ? "anual" : "mensual"
    );

    marcarPendienteDeActivar(
      PLAN,
      Number(months) || 1
    );

    // recordatorios
    scheduleReminders(PLAN, months);

    const payload = {
      plan: PLAN,
      precio: monto,
      uid: localStorage.getItem("uid") || null,
      email:
        auth?.currentUser?.email ||
        localStorage.getItem("email") ||
        "",
    };
    console.log(
      "[Pago] Enviar a flowCreate (callable):",
      payload
    );

    const out = await callCrearPago(payload);

    const rawUrl = extractUrl(out);
    if (!rawUrl)
      throw new Error(
        "Respuesta inválida del servidor (sin URL)"
      );
    let urlStr = normalizeFlowUrl(rawUrl);
    urlStr = String(urlStr || "");

    if (!urlStr || !urlStr.includes("token=")) {
      console.warn(
        "[Pago] URL Flow sin token (continuo igual):",
        urlStr
      );
    }

    try {
      if (opened && preWin) {
        try {
          if (preWin.document) {
            preWin.document.body.innerHTML = `
              <div class="box" style="height:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                <div class="spinner" style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite"></div>
                <div style="color:#334155">Redirigiendo a Flow…</div>
                <a href="${urlStr}" style="color:#16a34a;text-decoration:none;font-weight:600">Si no continúa automáticamente, haz clic aquí</a>
                <meta http-equiv="refresh" content="0;url=${urlStr}">
                <script>setTimeout(function(){ try{ location.href=${JSON.stringify(
                  urlStr
                )} }catch(e){} }, 50);</script>
              </div>`;
          }
        } catch {}
        preWin.location.href = urlStr;
      } else {
        const win = window.open(urlStr, "_blank");
        opened = !!win;
      }
    } catch (e) {
      console.warn(
        "[Pago] window.open bloqueado:",
        e
      );
      opened = false;
    }

    setTimeout(() => {
      if (!opened) window.location.href = urlStr;
    }, 300);

    setTimeout(() => {
      if (opened) window.location.href = "/registro";
    }, 600);
  } catch (err) {
    try {
      if (preWin && !preWin.closed) preWin.close();
    } catch {}
    console.error("Flow error:", err);
    alert(
      `No se pudo iniciar el pago con Flow.\nDetalle: ${
        err?.message || err
      }`
    );
  }
}

/* helpers debug opcionales */
function __openFlowWindow(urlStr) {
  try {
    const w = window.open("", "_blank");
    if (w && w.document) {
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">
        <title>Abriendo Flow…</title>
        <style>
          html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto}
          .box{height:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;flex-direction:column}
          .s{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite}
          @keyframes spin{to{transform:rotate(360deg)}}
        </style></head>
        <body><div class="box">
          <div class="s"></div>
          <div>Redirigiendo a Flow…</div>
          <a href="${urlStr}" target="_self" rel="noreferrer">Ir a Flow</a>
          <meta http-equiv="refresh" content="0;url=${urlStr}">
          <script>setTimeout(function(){ try{ location.href=${JSON.stringify(
            urlStr
          )} }catch(e){} }, 60);</script>
        </div></body></html>`);
      w.document.close();
      try {
        w.location.href = urlStr;
      } catch {}
      return true;
    }
  } catch {}
  try {
    window.location.href = urlStr;
  } catch {}
  return false;
}

async function __crearPagoConFallback(
  plan,
  precio,
  extra = {}
) {
  const PLAN = String(plan || "").toUpperCase();
  const monto = Number(precio) > 0 ? Number(precio) : 0;
  const uid = auth?.currentUser?.uid || null;
  const email = auth?.currentUser?.email || "";

  const payload = {
    plan: PLAN,
    precio: monto,
    uid,
    email,
    ...extra,
  };

  const __normalize = (url) => {
    try {
      const u = new URL(url);
      const token = u.searchParams.get("token");
      const isSandbox =
        /sandbox\.flow\.cl/i.test(u.hostname) ||
        /sandbox\.flow\.cl/i.test(url);
      const host = isSandbox
        ? "https://sandbox.flow.cl"
        : "https://www.flow.cl";
      return token
        ? `${host}/app/web/pay.php?token=${token}`
        : url;
    } catch {
      return url;
    }
  };

  const __stub = () => {
    const base = "https://sandbox.flow.cl";
    const token = `DUMMY-${Date.now()}`;
    return `${base}/app/web/pay.php?token=${encodeURIComponent(
      token
    )}`;
  };

  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear(payload);
    const data =
      typeof res?.data === "string"
        ? { url: res.data }
        : res?.data || {};
    const raw =
      data?.url ||
      data?.paymentUrl ||
      data?.paymentURL ||
      "";
    return __normalize(raw || __stub());
  } catch (e) {
    console.warn(
      "[__crearPagoConFallback] callable falló, uso stub:",
      e?.message || e
    );
    return __stub();
  }
}

function __pagoDebug() {
  return {
    now: new Date().toISOString(),
    uid: auth?.currentUser?.uid || null,
    region: "southamerica-east1",
    note:
      "Debug helper. Ej: const url = await __crearPagoConFallback('BASICO',9990); __openFlowWindow(url);",
  };
}

/* ─────────────────────────────────────────────
   UI COMPONENTES DE PLANES
────────────────────────────────────────────── */

function PlanBoxFree({ color, fondo, descripcion, onUse }) {
  const cardStyle = {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow:
      "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
    border: "1px solid #e5e7eb",
    textAlign: "center",
  };
  return (
    <div style={cardStyle}>
      <div
        style={{
          background: fondo,
          borderRadius: 10,
          padding: "0.75rem 1rem",
          marginBottom: "0.75rem",
        }}
      >
        <h3 style={{ color, margin: 0 }}>Free</h3>
      </div>

      <p
        style={{
          marginTop: 0,
          marginBottom: "0.5rem",
          fontSize: "1.15rem",
        }}
      >
        <strong>Gratis / mes</strong>
      </p>

      {descripcion.map((linea, index) => (
        <p
          key={index}
          style={{ margin: "0.25rem 0", color: "#334155" }}
        >
          {linea}
        </p>
      ))}

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={onUse}
          style={{
            padding: "0.6rem 1rem",
            color: "#0ea5e9",
            border: "2px solid #0ea5e9",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            background: "#ffffff",
          }}
        >
          Usar gratis
        </button>
      </div>
    </div>
  );
}

function PlanBox({
  color,
  fondo,
  titulo,
  precioCLP,
  annualPriceCLP,
  annualGiftMonths = 1,
  descripcion,
  flowPlan,
  flowPrecio,
}) {
  const cardStyle = {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow:
      "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
    border: "1px solid #e5e7eb",
    textAlign: "center",
  };

  const formatCLP = (v) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(v);

  const btnPrimary = {
    padding: "0.6rem 1rem",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    background: "#43a047",
  };

  const btnGhost = {
    padding: "0.6rem 1rem",
    color: "#0ea5e9",
    border: "2px solid #0ea5e9",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    background: "#ffffff",
  };

  // meses que realmente vamos a activar cuando paga anual
  const monthsForAnnualActivation =
    12 + (annualGiftMonths || 1); // 13 (+1) o 14 (+2)

  return (
    <div style={cardStyle}>
      <div
        style={{
          background: fondo,
          borderRadius: 10,
          padding: "0.75rem 1rem",
          marginBottom: "0.75rem",
        }}
      >
        <h3 style={{ color, margin: 0 }}>{titulo}</h3>
      </div>

      <p
        style={{
          marginTop: 0,
          marginBottom: "0.25rem",
          fontSize: "1.15rem",
        }}
      >
        <strong>{formatCLP(precioCLP)} / mes</strong>
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "0.85rem",
          color: "#64748b",
        }}
      >
        {annualPriceCLP
          ? `o anual ${formatCLP(
              annualPriceCLP
            )} (${
              annualGiftMonths === 2
                ? "+2 meses"
                : "+1 mes"
            })`
          : ""}
      </p>

      {descripcion.map((linea, index) => (
        <p
          key={index}
          style={{ margin: "0.25rem 0", color: "#334155" }}
        >
          {linea}
        </p>
      ))}

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {/* pago mensual (1 mes) */}
        <button
          style={btnPrimary}
          onClick={() =>
            pagarConFlowHttp(flowPlan, flowPrecio, 1)
          }
          aria-label={`Pagar plan ${titulo} mensual con Flow.cl`}
        >
          Pagar mensual — {formatCLP(flowPrecio)}
          <div
            style={{
              fontSize: "0.75rem",
              color: "#e6ffe6",
              marginTop: "0.2rem",
            }}
          >
            Cuenta RUT o débito (Chile)
          </div>
        </button>

        {/* pago anual */}
        {annualPriceCLP ? (
          <button
            style={btnGhost}
            onClick={() =>
              pagarConFlowHttp(
                flowPlan,
                annualPriceCLP,
                monthsForAnnualActivation
              )
            }
            aria-label={`Pagar plan ${titulo} anual con Flow.cl`}
          >
            Pagar anual — {formatCLP(annualPriceCLP)}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PÁGINA PRINCIPAL /pago
────────────────────────────────────────────── */

function Pago() {
  const navigate = useNavigate();
  const location = useLocation();

  // helper seguro para ir a /inicio
  const goHomeSafe = (q = "") => {
    try {
      clearAllCountdowns();
    } catch {}
    const suffix =
      typeof q === "string" && q
        ? q.startsWith("?")
          ? q
          : `?${q}`
        : "";
    navigate(`/inicio${suffix}`, {
      replace: true,
      state: {
        from: "pago",
        resetTimers: true,
      },
    });
  };

  // este flag decide si corremos la activación automática + redirect
  const shouldCheckReturn = (() => {
    const qs = new URLSearchParams(
      location.search || ""
    );
    // usamos cualquiera de estas marcas cuando Flow redirige
    if (qs.get("flowReturn") === "1") return true;
    if (qs.get("paid") === "1") return true;
    if (qs.get("retorno") === "1") return true;
    return false;
  })();

  // SOLO si venimos "de Flow" intentamos activar y mandar a /inicio
  useEffect(() => {
    if (!shouldCheckReturn) return;

    intentarActivarSiPendiente()
      .then((ok) => {
        if (ok) {
          console.log(
            "[Pago] Plan activado automáticamente al volver."
          );
          goHomeSafe("?paid=1");
        }
      })
      .catch((e) =>
        console.warn(
          "[Pago] No se pudo activar automáticamente:",
          e?.message || e
        )
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldCheckReturn]);

  // estado auth local
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
      try {
        if (u?.uid) localStorage.setItem("uid", u.uid);
        if (u?.email)
          localStorage.setItem("email", u.email);
      } catch {}
    });
    return () => unsub();
  }, []);

  // autostart pago directo si entro con ?plan=PRO&billing=annual
  const [autoMsg, setAutoMsg] = useState("");
  const autoRef = useRef(false);

  useEffect(() => {
    const qs = new URLSearchParams(
      location.search || ""
    );
    const planParam = (qs.get("plan") || "").toUpperCase();
    const billing = (
      qs.get("billing") || "monthly"
    ).toLowerCase();

    if (!planParam || autoRef.current) return;
    if (
      !["BASICO", "PRO", "PREMIUM"].includes(
        planParam
      )
    )
      return;

    const base = PRICE_MAP[planParam] || 0;
    const annual =
      billing === "annual" || billing === "year";

    // monto a cobrar
    const amount = annual
      ? planParam === "PREMIUM"
        ? Math.round(base * 10)
        : Math.round(base * 11)
      : base;

    // meses que activamos
    const monthsToActivate = annual
      ? planParam === "PREMIUM"
        ? 14
        : 13
      : 1;

    autoRef.current = true;
    setAutoMsg(
      `Abriendo Flow para plan ${planParam} (${
        annual ? "anual" : "mensual"
      })…`
    );

    try {
      marcarPendienteDeActivar(
        planParam,
        monthsToActivate
      );
    } catch {}
    pagarConFlowHttp(
      planParam,
      amount,
      monthsToActivate
    );
  }, [location.search]);

  /* estilos inline */
  const pageStyle = {
    minHeight: "100vh",
    background:
      "linear-gradient(to right, #2193b0, #6dd5ed)",
    padding: "2rem",
    fontFamily: "Segoe UI, sans-serif",
    color: "#ffffff",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, 1fr)",
    gap: "2rem",
    marginBottom: "2rem",
    maxWidth: 1200,
    marginInline: "auto",
  };

  // Banner: solo si NO hay sesión real
  const showLoginBanner =
    ready && (!user || user.isAnonymous);

  return (
    <div style={pageStyle}>
      <h2
        style={{
          textAlign: "center",
          marginBottom: "2rem",
          color: "#ffffff",
        }}
      >
        │ Elige tu Plan
      </h2>

      {showLoginBanner && (
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto 1rem",
            background:
              "rgba(255,255,255,.92)",
            color: "#0f172a",
            padding: "0.9rem 1.1rem",
            borderRadius: 10,
            boxShadow:
              "0 6px 18px rgba(16,24,40,.12)",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          Para pagar necesitarás iniciar
          sesión. Puedes mirar y comparar
          los planes ahora, y al pagar te
          pediremos que ingreses.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() =>
                navigate(
                  "/login?next=/pago"
                )
              }
              style={{
                padding: "0.6rem 1rem",
                background: "#ffffff",
                color: "#2193b0",
                border:
                  "1px solid #2193b0",
                borderRadius: 8,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      )}

      {autoMsg && (
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto 1rem",
            background:
              "rgba(255,255,255,.9)",
            color: "#0f172a",
            padding: "0.9rem 1.1rem",
            borderRadius: 10,
            boxShadow:
              "0 6px 18px rgba(16,24,40,.12)",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          {autoMsg}
        </div>
      )}

      <div style={gridStyle}>
        {/* FREE */}
        <PlanBoxFree
          color="#64748b"
          fondo="#f1f5f9"
          onUse={() =>
            navigate("/registro?plan=free")
          }
          descripcion={[
            "1 curso",
            "1 clase por día",
            "Nube de palabras (10 respuestas)",
            "Sin exportaciones",
            "Sin sugerencias de currículo",
          ]}
        />

        {/* BASICO */}
        <PlanBox
          color="#0288d1"
          fondo="#e3f2fd"
          titulo="Básico · 1 juego"
          precioCLP={9990}
          annualPriceCLP={9990 * 11} // 1 mes gratis → activamos 13
          annualGiftMonths={1}
          descripcion={[
            "Hasta 3 cursos",
            "Currículo sugerido (unidad/objetivo)",
            "QR de participación",
            "1 juego de cierre",
            "Asistencia básica",
            "Soporte por correo (48h)",
          ]}
          flowPlan="BASICO"
          flowPrecio={9990}
        />

        {/* PRO */}
        <PlanBox
          color="#7e57c2"
          fondo="#ede7f6"
          titulo="Pro · 5 juegos"
          precioCLP={19990}
          annualPriceCLP={19990 * 11} // 1 mes gratis → 13
          annualGiftMonths={1}
          descripcion={[
            "Cursos ilimitados",
            "OA y currículo sugeridos",
            "QR + carreras",
            "5 juegos de cierre",
            "Asistencia con CSV",
            "Soporte prioritario (24h)",
          ]}
          flowPlan="PRO"
          flowPrecio={19990}
        />

        {/* PREMIUM / PLATINUM */}
        <PlanBox
          color="#f59e0b"
          fondo="#fff8e1"
          titulo="Platinum · 10 juegos"
          precioCLP={29990}
          annualPriceCLP={29990 * 10} // 2 meses gratis → 14
          annualGiftMonths={2}
          descripcion={[
            "Todo en Pro",
            "Grabación de clase",
            "Alarma anti-ruido",
            "10 juegos de cierre",
            "Panel de métricas",
            "Soporte dedicado",
          ]}
          flowPlan="PREMIUM"
          flowPrecio={29990}
        />
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "0.5rem",
        }}
      >
        <small>
          En modalidad <b>anual</b> regalamos{" "}
          <b>+1 mes</b> adicional (activas 13
          meses). En{" "}
          <b>Platinum</b> regalamos{" "}
          <b>+2 meses</b> (activas 14 meses). Se
          envían recordatorios por correo 5
          días antes del fin de la prueba y
          antes de cada renovación.
        </small>
      </div>

      {/* BLOQUE COLEGIOS */}
      <div
        style={{
          maxWidth: 900,
          margin:
            "1.75rem auto 2rem",
          background:
            "rgba(255,255,255,.92)",
          color: "#0f172a",
          padding: "1.25rem",
          borderRadius: 12,
          boxShadow:
            "0 6px 18px rgba(16,24,40,.12)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Planes para Colegios
        </h3>
        <p style={{ marginBottom: 8 }}>
          Descuentos por docente según
          tamaño:
        </p>
        <ul style={{ marginTop: 0 }}>
          <li>
            30 profes: <b>–$2.000</b> por
            profe
          </li>
          <li>
            50 profes: <b>–$3.000</b> por
            profe
          </li>
          <li>
            80 profes: <b>–$4.000</b> por
            profe
          </li>
          <li>
            100 profes: <b>–$5.000</b> por
            profe
          </li>
        </ul>
        <p>
          Todos los profesores que paguen
          anual reciben el mes de regalo
          correspondiente.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label>
            Tamaño:
            <select
              id="colegio-size"
              defaultValue="30"
              style={{
                marginLeft: 8,
              }}
            >
              <option value="30">
                30 profes
              </option>
              <option value="50">
                50 profes
              </option>
              <option value="80">
                80 profes
              </option>
              <option value="100">
                100 profes
              </option>
            </select>
          </label>

          <label>
            Plan base:
            <select
              id="colegio-plan"
              defaultValue="PRO"
              style={{
                marginLeft: 8,
              }}
            >
              <option value="BASICO">
                Básico
              </option>
              <option value="PRO">
                Pro (5 juegos)
              </option>
              <option value="PREMIUM">
                Platinum
              </option>
            </select>
          </label>

          <button
            onClick={() => {
              const size = Number(
                document.getElementById(
                  "colegio-size"
                ).value
              );
              const plan =
                document.getElementById(
                  "colegio-plan"
                ).value; // BASICO/PRO/PREMIUM
              const base = PRICE_MAP[plan];
              const descuento =
                size >= 100
                  ? 5000
                  : size >= 80
                  ? 4000
                  : size >= 50
                  ? 3000
                  : 2000;
              const unit = Math.max(
                1000,
                base - descuento
              ); // clamp
              const totalMensual =
                unit * size;

              const asunto =
                encodeURIComponent(
                  `Cotización Colegio ${size} profes · Plan ${plan}`
                );
              const cuerpo =
                encodeURIComponent(
                  `Hola, deseo cotizar ${size} licencias del plan ${plan}.\n` +
                    `Precio base: ${base.toLocaleString(
                      "es-CL"
                    )} CLP, descuento: ${descuento.toLocaleString(
                      "es-CL"
                    )} por profe.\n` +
                    `Total mensual aprox: ${totalMensual.toLocaleString(
                      "es-CL"
                    )} CLP.\n` +
                    `Datos del colegio: ...`
                );
              window.location.href = `mailto:contactocolegios@pragmaprofe.com?subject=${asunto}&body=${cuerpo}`;
            }}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 8,
              border:
                "1px solid #0ea5e9",
              background: "#fff",
              color: "#0ea5e9",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Solicitar cotización
          </button>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "1.25rem",
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "0.8rem 1.5rem",
            backgroundColor: "#ffffff",
            color: "#2193b0",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow:
              "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────── */

export default Pago;
export {
  pagarConFlow,
  pagarConFlowHttp,
  intentarActivarSiPendiente,
  marcarPendienteDeActivar,
  activarPlanViaBackend,
  activarPlanLocalFallback,
  __openFlowWindow,
  __crearPagoConFallback,
  __pagoDebug,
};

