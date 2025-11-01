// src/pages/RutaInicial.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import Home from "./Home";

/*
  RutaInicial (ruta "/"):
  - Visitante o sesión anónima → muestra <Home /> (landing).
  - Usuario autenticado “real” (no anónimo) → redirige a /InicioClase.
  - Respeta overrides por query (?go=horario | ?go=inicio) y flags de registro.
*/

export default function RutaInicial() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ready, setReady] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState({
    hasUser: false,
    isAnon: false,
  });

  const unsubRef = React.useRef(null);

  // ✅ Este helper evita saltos múltiples en el mismo tick
  const goOnce = React.useCallback(
    (path) => {
      if (window.__ROUTE_JUMPING__) return;
      window.__ROUTE_JUMPING__ = true;
      try {
        navigate(path, { replace: true });
      } finally {
        setTimeout(() => {
          window.__ROUTE_JUMPING__ = false;
        }, 100);
      }
    },
    [navigate]
  );

  // ✅ Si por alguna razón RutaInicial se montara fuera de "/",
  // no hace nada (blindaje contra montajes inesperados).
  const isRoot = location.pathname === "/";
  React.useEffect(() => {
    if (!isRoot) return;
    const qs = new URLSearchParams(location.search || "");
    const go = (qs.get("go") || "").toLowerCase(); // "horario" | "inicio"
    if (go === "horario") {
      goOnce("/horario");
      return;
    }
    if (go === "inicio") {
      goOnce("/InicioClase");
      return;
    }

    // Flags que puede dejar Registro.jsx (post-registro)
    const forceHorario = localStorage.getItem("forceHorarioOnce") === "1";
    const skipRI = localStorage.getItem("skipRutaInicialOnce") === "1";
    const justAt = Number(localStorage.getItem("justRegisteredAt") || 0);
    const within3min = justAt && Date.now() - justAt < 3 * 60 * 1000;

    if (forceHorario || skipRI || within3min) {
      try {
        localStorage.removeItem("forceHorarioOnce");
        localStorage.removeItem("skipRutaInicialOnce");
      } catch {}
      goOnce("/horario");
    }
  }, [isRoot, location.search, goOnce]);

  // ===== Auth sync =====
  React.useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!alive) return;
      if (u) {
        setUserInfo({ hasUser: true, isAnon: !!u.isAnonymous });
      } else {
        setUserInfo({ hasUser: false, isAnon: false });
      }
      setReady(true);
    });
    unsubRef.current = unsub;
    return () => {
      alive = false;
      try {
        unsubRef.current && unsubRef.current();
      } catch {}
    };
  }, []);

  // ===== Redirección automática SOLO en "/" y solo si es user real =====
  React.useEffect(() => {
    if (!ready || !isRoot) return;

    const params = new URLSearchParams(location.search || "");
    const forceGo = params.get("autogo") === "1"; // demo opcional

    if (userInfo.hasUser && !userInfo.isAnon) {
      goOnce("/InicioClase");
      return;
    }
    // Demo: permite saltar a la clase con sesión anónima si ?autogo=1
    if (forceGo && (userInfo.hasUser || userInfo.isAnon)) {
      goOnce("/InicioClase");
    }
  }, [ready, isRoot, userInfo, location.search, goOnce]);

  // ===== Loader breve mientras Auth responde la primera vez =====
  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          color: "#0f172a",
        }}
      >
        Cargando…
      </div>
    );
  }

  // Si ya está logeado “real”, probablemente estamos navegando:
  if (userInfo.hasUser && !userInfo.isAnon && isRoot) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          color: "#0f172a",
        }}
      >
        Entrando a tu clase…
      </div>
    );
  }

  // Visitante nuevo o sesión anónima → Home (landing pública)
  return <Home />;
}






