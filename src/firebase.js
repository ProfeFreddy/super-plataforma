// src/firebase.js
// Inicialización sólida para Auth, Firestore y RTDB (nube de palabras)

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
// 👇 usamos initializeFirestore en vez de getFirestore
import {
  initializeFirestore,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";

/* ------------------------- FALLBACKS (seguros) ------------------------- */
/* Usa tus propios valores si no están definidos en .env */
const FB_FALLBACK = {
  apiKey: "AIzaSyC6uvGu9_9kNx1vInNy7X2ny2JPkE4M-YU",
  authDomain: "pragma-2c5d1.firebaseapp.com",
  projectId: "pragma-2c5d1",
  storageBucket: "pragma-2c5d1.appspot.com",
  messagingSenderId: "203232076035",
  appId: "1:203232076035:web:1ed2a449ba619ac30b8936",
  measurementId: "G-348TG6WKLE",
  databaseURL: "https://pragma-2c5d1-default-rtdb.firebaseio.com",
};

/* ------------------------- CONFIG FINAL ------------------------- */
/* IMPORTANTE: authDomain NUNCA debe ser localhost. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FB_FALLBACK.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FB_FALLBACK.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || FB_FALLBACK.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FB_FALLBACK.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    FB_FALLBACK.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FB_FALLBACK.appId,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || FB_FALLBACK.measurementId,
  // RTDB es clave para la nube de palabras
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL || FB_FALLBACK.databaseURL,
};

/* ------------------------- DIAGNÓSTICO ÚTIL ------------------------- */
try {
  console.log(
    "🧠 [FB] host:",
    typeof window !== "undefined" ? window.location.hostname : "(no-window)"
  );
  console.log("[FB] projectId:", firebaseConfig.projectId);
  console.log("[FB] authDomain:", firebaseConfig.authDomain);
  if (!firebaseConfig.apiKey) {
    console.error("[FB] Falta apiKey (revisa .env.local)");
  }
  if (
    firebaseConfig.authDomain === "localhost" ||
    firebaseConfig.authDomain?.includes("127.0.0.1")
  ) {
    console.warn(
      "[FB] authDomain inválido. Debe ser <proyecto>.firebaseapp.com / web.app"
    );
  }
  if (!firebaseConfig.databaseURL) {
    console.warn(
      "[FB] Falta databaseURL. Define VITE_FIREBASE_DATABASE_URL para la nube (RTDB)."
    );
  }
} catch { /* noop */ }

/* ------------------------- INIT ÚNICO ------------------------- */
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* ------------------------- SERVICIOS ------------------------- */
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ✅ Firestore robusto para redes “difíciles” (evita 400/streaming)
const db = initializeFirestore(app, {
  localCache: persistentSingleTabManager(),
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false, // evita fetch streaming que a veces rompe
});

const functions = getFunctions(app, "southamerica-east1");
const storage = getStorage(app);
const rtdb = getDatabase(app);

/* ------------------------- AUTO-ANON EN DEV (desactivado) ------------------------- */
/* Mantener desactivado aquí para no pisar sesiones reales.
   Si alguna pantalla lo necesita, que haga signInAnonymously localmente. */
// import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
// if (typeof window !== "undefined" && window.location.hostname === "localhost") {
//   onAuthStateChanged(auth, (u) => {
//     if (!u) signInAnonymously(auth).catch(() => {});
//   });
// }

/* ------------------------- ANALYTICS (opcional) ------------------------- */
let analytics;
try {
  if (firebaseConfig.measurementId) {
    isSupported().then((ok) => {
      if (ok) {
        analytics = getAnalytics(app);
        console.log("[FB] Analytics ON");
      }
    });
  }
} catch { /* noop */ }

/* ------------------------- EXPORTS ------------------------- */
export { app, auth, db, functions, storage, rtdb };

/* ------------------------- Helper Flow (pago) ------------------------- */
export async function callFlowCreateV2(payload) {
  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear(payload);
    const data =
      typeof res?.data === "string" ? { url: res.data } : res?.data || {};
    const url = data.url || data.paymentUrl || data.paymentURL || null;
    if (url) return { url };
    return data;
  } catch (e) {
    console.warn("[firebase] callFlowCreateV2 fallback:", e?.message || e);
    const token = `DUMMY-${Date.now()}`;
    return {
      url: `https://sandbox.flow.cl/app/web/pay.php?token=${encodeURIComponent(
        token
      )}`,
    };
  }
}










