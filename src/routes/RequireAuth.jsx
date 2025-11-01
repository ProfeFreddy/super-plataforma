// src/routes/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function RequireAuth({ children, allowAnon = false }) {
  const location = useLocation();
  const [ready, setReady] = React.useState(false);
  const [state, setState] = React.useState({ hasUser: false, isAnon: false });

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setState({ hasUser: false, isAnon: false });
      } else {
        setState({ hasUser: true, isAnon: !!u.isAnonymous });
      }
      setReady(true);
    });
    return () => unsub && unsub();
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        Cargando…
      </div>
    );
  }

  // Sin usuario: bloquea
  if (!state.hasUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Con usuario anónimo: permite solo si allowAnon
  if (state.isAnon && !allowAnon) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // OK
  return children;
}


