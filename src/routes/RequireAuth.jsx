// src/components/RequireAuth.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

export default function RequireAuth({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          // NUEVO: no redirigimos al login; habilitamos anónimo
          await signInAnonymously(auth);
        }
      } catch (_e) {
        // si falla, igual mostramos la app (leerá como no autenticado)
      } finally {
        setReady(true);
      }
    });
    return () => unsub();
  }, []);

  if (!ready) return null; // o spinner suave
  return children;
}

