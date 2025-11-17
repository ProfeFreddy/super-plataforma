import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { getClaseVigente } from "../services/PlanificadorService";
import Home from "./Home";

/*
  RutaInicial (ruta "/"):
  - Visitante o sesión anónima → muestra <Home /> (landing).
  - Usuario autenticado “real” (no anónimo):
      * si perfil incompleto → /registro
      * si no tiene horario → /horario
      * si tiene horario y hay clase activa → /InicioClase
      * si tiene horario y NO hay clase activa → /proximas-clases
  - Respeta overrides por query (?go=horario | ?go=inicio) y flags de registro.
*/

export default function RutaInicial() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ready, setReady] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState({
    hasUser: false,
    isAnon: false,
    uid: null,
  });

  const unsubRef = React.useRef(null);

  // ✅ helper evita saltos múltiples en el mismo tick
  const goOnce = React.useCallback(
    (path, state) => {
      if (window.__ROUTE_JUMPING__) return;
      window.__ROUTE_JUMPING__ = true;
      try {
        navigate(path, { replace: true, state });
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
        setUserInfo({ hasUser: true, isAnon: !!u.isAnonymous, uid: u.uid });
      } else {
        setUserInfo({ hasUser: false, isAnon: false, uid: null });
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

  // ===== Redirección con reglas de negocio =====
  React.useEffect(() => {
    if (!ready || !isRoot) return;

    // Demo opcional
    const params = new URLSearchParams(location.search || "");
    const forceGo = params.get("autogo") === "1";

    // Si no hay usuario → Home
    if (!userInfo.hasUser) return;

    // Si es anónimo: solo permitimos “autogo” explícito a InicioClase (demo)
    if (userInfo.isAnon) {
      if (forceGo) goOnce("/InicioClase");
      return;
    }

    // Usuario real (no anónimo): aplicamos la secuencia
    (async () => {
      try {
        const uref = doc(db, "usuarios", String(userInfo.uid));
        const usnap = await getDoc(uref);
        const udata = usnap.data() || {};

        // 1) perfil incompleto
        if (!udata.nombre || !udata.email || !udata.rol) {
          goOnce("/registro");
          return;
        }

        // 2) horario no cargado
        if (!Array.isArray(udata.horario) || !udata.horario.length) {
          goOnce("/horario");
          return;
        }

        // 3) clase activa?
        let vigente = null;
        try {
          vigente = await getClaseVigente(new Date());
        } catch {
          vigente = null;
        }

        if (vigente && vigente.activa) {
          goOnce("/InicioClase", { slotId: vigente.slotId, clase: vigente });
          return;
        }

        // 4) sin clase activa → próximas
        goOnce("/proximas-clases");
      } catch {
        // fallback seguro
        goOnce("/InicioClase");
      }
    })();
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








