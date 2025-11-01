// src/routes/PrivateRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

/* Hook liviano (copiado aquí para no depender de otros archivos) */
function useAuthReadyLight() {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      try {
        if (!u) {
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUser(cred.user ?? null);
        } else {
          setUser(u);
        }
      } catch {
        setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    });
    return () => { alive = false; unsub && unsub(); };
  }, []);

  return { ready, user, isAnon: !!user?.isAnonymous };
}

export default function PrivateRoute({ children, allowAnon = false }) {
  const { ready, user, isAnon } = useAuthReadyLight();

  // 1) No redirigir mientras se resuelve la sesión
  if (!ready) return null;

  // 2) Si no hay user (ni anónimo), al login
  if (!user && !isAnon) return <Navigate to="/login" replace />;

  // 3) Si es anónimo pero esta ruta no lo permite, al login
  if (isAnon && !allowAnon) return <Navigate to="/login" replace />;

  return children;
}
