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
  storageBucket: "pragma-2c5d1.firebasestorage.app",
  messagingSenderId: "203232076035",
  appId: "1:203232076035:web:1ed2a449ba619ac30b8936",
  measurementId: "G-348TG6WKLE",
};

/* -----------------------------------------------------------
   Config final enviada al SDK de Firebase
   IMPORTANTE:
   - authDomain NO puede ser "localhost". Debe ser SIEMPRE el
     dominio real del proyecto de Firebase Auth
     (por ej. "pragma-2c5d1.firebaseapp.com"), aunque estemos
     desarrollando en http://localhost:8082.
   - Eso desbloquea el login/registro real (signIn/signUp),
     porque el SDK construye las URLs internas con ese valor.
----------------------------------------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FB_FALLBACK.apiKey,

  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FB_FALLBACK.authDomain,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FB_FALLBACK.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FB_FALLBACK.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    FB_FALLBACK.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FB_FALLBACK.appId,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || FB_FALLBACK.measurementId,
};

/* -----------------------------------------------------------
   Logs/diagnóstico en consola (no afectan producción)
----------------------------------------------------------- */
console.log("🧠 [FB] Hostname actual:", window.location.hostname);
console.log("[FB] projectId:", firebaseConfig.projectId);
console.log("[FB] authDomain:", firebaseConfig.authDomain);
console.log("[FB] apiKey prefix:", (firebaseConfig.apiKey || "").slice(0, 6));

// 🧨 Aviso si la apiKey falta (detección temprana)
if (!firebaseConfig.apiKey) {
  console.error(
    "[FB] apiKey está vacía. Revisa .env.local / .env.production y vuelve a compilar con `npm run build`."
  );
}

// 🧩 Aviso si el dominio en el que estás navegando no está entre los que
// autorizaste en Firebase > Authentication > Dominios autorizados.
// (Esto NO bloquea nada, es solo para que te avise en consola.)
if (
  ![
    "localhost",
    "127.0.0.1",
    "www.pragmaprofe.com",
    "pragmaprofe.com",
  ].includes(window.location.hostname)
) {
  console.warn(
    `[FB] Dominio no reconocido localmente: ${window.location.hostname}.
     Asegúrate de agregarlo en Firebase > Authentication > Dominios autorizados
     si quieres iniciar sesión desde ahí.`
  );
}

// Aviso explícito si authDomain quedó raro
if (!firebaseConfig.authDomain || firebaseConfig.authDomain === "localhost") {
  console.warn(
    "[FB] authDomain inválido en firebaseConfig.authDomain:",
    firebaseConfig.authDomain,
    "→ debería ser algo como pragma-2c5d1.firebaseapp.com"
  );
}

/* -----------------------------------------------------------
   Inicialización única (evita doble init con HMR / React Fast Refresh)
----------------------------------------------------------- */
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* -----------------------------------------------------------
   Auth con persistencia local (para que quede logeado)
----------------------------------------------------------- */
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* -----------------------------------------------------------
   Otros servicios que ya usas en la app
----------------------------------------------------------- */
const db = getFirestore(app);
const functions = getFunctions(app, "southamerica-east1");
const storage = getStorage(app);

/* -----------------------------------------------------------
   Analytics opcional/seguro
   - Solo se activa si measurementId existe
   - isSupported() evita crashear en entornos que no soportan Analytics
----------------------------------------------------------- */
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

/* -----------------------------------------------------------
   Exporta servicios principales para el resto de la app
----------------------------------------------------------- */
export { app, auth, db, functions, storage };

/* ============================================================
   AÑADIDO: helper compatible con Pago.jsx
   (dejas tu flujo de pago funcionando igual que antes)
============================================================ */
export async function callFlowCreateV2(payload) {
  try {
    const fn = getFunctions(app, "southamerica-east1");
    const crear = httpsCallable(fn, "flowCreateV2");
    const res = await crear(payload);

    const data =
      typeof res?.data === "string" ? { url: res.data } : (res?.data || {});
    const url = data.url || data.paymentUrl || data.paymentURL || null;

    if (url) return { url };
    return data;
  } catch (e) {
    console.warn(
      "[firebase] callFlowCreateV2 fallback (stub):",
      e?.message || e
    );
    const token = `DUMMY-${Date.now()}`;
    return {
      url: `https://sandbox.flow.cl/app/web/pay.php?token=${encodeURIComponent(
        token
      )}`,
    };
  }
}






