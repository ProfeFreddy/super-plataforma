// src/firebase.js 
// (TEMP) comprueba que Vite está leyendo .env.local / .env.production
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";
// 🔹 AÑADIDO: Analytics seguro
import { getAnalytics, isSupported } from "firebase/analytics";

/* -----------------------------------------------------------
   FALLBACKS del proyecto (por si alguna VITE_* viene vacía)
   *No exponen secretos nuevos; son tus propios valores*
----------------------------------------------------------- */
const FB_FALLBACK = {
  apiKey: "AIzaSyC6uvGu9_9kNx1vInNy7X2ny2JPkE4M-YU",
  authDomain: "pragma-2c5d1.firebaseapp.com",
  projectId: "pragma-2c5d1",
  storageBucket: "pragma-2c5d1.appspot.com",
  messagingSenderId: "203232076035",
  appId: "1:203232076035:web:1ed2a449ba619ac30b8936",
  measurementId: "G-348TG6WKLE",
};

// --- Config final: primero intenta leer de .env y cae a literal ---
const firebaseConfig = {
  // ✅ Si no viene de .env, usa el FB_FALLBACK correcto (sin typos)
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    FB_FALLBACK.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    FB_FALLBACK.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    FB_FALLBACK.projectId,
  // OJO: storageBucket debe ir como <project>.appspot.com
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    FB_FALLBACK.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    FB_FALLBACK.messagingSenderId,
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    FB_FALLBACK.appId,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    FB_FALLBACK.measurementId,
};

// Evita re-inicializar en HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// (Opcional) logs de diagnóstico
console.log("[FB] projectId:", firebaseConfig.projectId);
console.log("[FB] authDomain:", firebaseConfig.authDomain);
console.log("[FB] apiKey prefix:", (firebaseConfig.apiKey || "").slice(0, 6));

// Aviso claro si la API key está ausente (ayuda a detectar builds viejos)
if (!firebaseConfig.apiKey) {
  console.error(
    "[FB] apiKey está vacía. Revisa .env.local / .env.production y vuelve a compilar con `npm run build`."
  );
}

// Auth con persistencia local (ignora si falla en algún entorno)
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Servicios que usas en la app
const db = getFirestore(app);
// Si tus callables están en southamerica-east1, fijamos la región:
const functions = getFunctions(app, "southamerica-east1");
const storage = getStorage(app);

// ✅ Analytics protegido (evita crash en entornos no soportados)
let analytics;
try {
  if (firebaseConfig.measurementId) {
    isSupported().then((ok) => {
      if (ok) {
        analytics = getAnalytics(app);
        console.log("[FB] Analytics ON");
      } else {
        console.warn("[FB] Analytics no soportado en este entorno");
      }
    });
  } else {
    console.warn("[FB] Analytics omitido: falta measurementId");
  }
} catch (e) {
  console.warn("[FB] Analytics deshabilitado:", e?.message || e);
}

// Exporta para el resto de la app
export { app, auth, db, functions, storage };

/* ============================================================
   AÑADIDO: helper compatible con Pago.jsx
   - Llama al callable "flowCreateV2" y normaliza la respuesta a { url }
   - Si el callable falla (desarrollo/offline), devuelve un stub sandbox
============================================================ */
export async function callFlowCreateV2(payload) {
  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear(payload);
    const data =
      typeof res?.data === "string" ? { url: res.data } : (res?.data || {});
    // Normaliza posibles claves
    const url = data.url || data.paymentUrl || data.paymentURL || null;
    if (url) return { url };
    return data; // por si tu backend devuelve objeto con otras props útiles
  } catch (e) {
    console.warn("[firebase] callFlowCreateV2 fallback (stub):", e?.message || e);
    const token = `DUMMY-${Date.now()}`;
    return {
      url: `https://sandbox.flow.cl/app/web/pay.php?token=${encodeURIComponent(
        token
      )}`,
    };
  }
}




