import React, { Suspense, lazy } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";
import "./pdf-worker-setup";

import Home from "./pages/Home";
import Registro from "./pages/Registro";
import Login from "./pages/Login";
import Participa from "./pages/Participa";
import Perfil from "./pages/Perfil";
import HorarioEditable from "./pages/HorarioEditable";
import PlanGuard from "./components/PlanGuard";
import RutaInicial from "./pages/RutaInicial";
import TestNube from "./pages/TestNube"; // ✅ ruta de prueba nube

const InicioClase = lazy(() =>
  import("./pages/InicioClase").then((mod) => ({
    default: mod.InicioClase || mod.default || mod,
  }))
);
const DesarrolloClase = lazy(() =>
  import("./pages/DesarrolloClase").then((mod) => ({
    default: mod.DesarrolloClase || mod.default || mod,
  }))
);
const CierreClase = lazy(() =>
  import("./pages/CierreClase").then((mod) => ({
    default: mod.CierreClase || mod.default || mod,
  }))
);
const Pago = lazy(() =>
  import("./pages/Pago").then((mod) => ({
    default: mod.Pago || mod.default || mod,
  }))
);
const ConfirmacionPago = lazy(() =>
  import("./pages/ConfirmacionPago").then((mod) => ({
    default: mod.ConfirmacionPago || mod.default || mod,
  }))
);
const Planificaciones = lazy(() =>
  import("./pages/Planificaciones.jsx").then((mod) => ({
    default: mod.Planificaciones || mod.default || mod,
  }))
);
const PlanClaseEditor = lazy(() =>
  import("./pages/PlanClaseEditor.jsx").then((mod) => ({
    default: mod.PlanClaseEditor || mod.default || mod,
  }))
);
const Planes = lazy(() =>
  import("./pages/Planes").then((mod) => ({
    default: mod.Planes || mod.default || mod,
  }))
);

/* ─────────────────────────────────────────
   ErrorBoundary
   ───────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null, info: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("[App ErrorBoundary]", err, info);
    this.setState({ info });
  }
  safeText(val) {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (val instanceof Error) return val.message || val.toString();
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return "[object]";
    }
  }
  safeBlock(label, val) {
    const txt = this.safeText(val);
    if (!txt) return null;
    return (
      <div key={label} style={{ marginBottom: "0.75rem", wordBreak: "break-word" }}>
        <div style={{ fontWeight: 600, marginBottom: ".25rem" }}>{label}:</div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: ".75rem",
            lineHeight: "1rem",
            color: "#7f1d1d",
          }}
        >
          {txt}
        </pre>
      </div>
    );
  }
  render() {
    if (this.state.hasError) {
      const friendlyMsg =
        this.state.err?.message || this.safeText(this.state.err) || "Error desconocido";
      const detailBlocks = [
        this.safeBlock("stack", this.state.err?.stack),
        this.safeBlock("componentStack", this.state.info && this.state.info.componentStack),
      ].filter(Boolean);
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#fff1f2",
            color: "#881337",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              background: "#ffffff",
              border: "1px solid #fecaca",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.05)",
              padding: "1rem 1.25rem",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "1.1rem",
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
                color: "#881337",
                marginBottom: ".5rem",
              }}
            >
              <span role="img" aria-label="warning">⚠️</span>
              <span>Ocurrió un error renderizando la página</span>
            </div>
            <div
              style={{
                color: "#881337",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: ".9rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginBottom: "1rem",
              }}
            >
              {friendlyMsg}
            </div>
            {detailBlocks.length > 0 && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "0.75rem",
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {detailBlocks}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────────────────────────
   Hooks y guards
   ───────────────────────────────────────── */
function useAuthReady() {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      if (!u) {
        try {
          const cred = await signInAnonymously(auth);
          if (!alive) return;
          setUser(cred.user || null);
          setReady(true);
        } catch (err) {
          console.error("No pude crear sesión anónima", err);
          if (!alive) return;
          setUser(null);
          setReady(true);
        }
      } else {
        setUser(u || null);
        setReady(true);
      }
    });
    const t = setTimeout(() => {
      if (!alive) return;
      setReady(true);
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
      if (unsub) unsub();
    };
  }, []);
  const isAnon = !!user && !!user.isAnonymous;
  const isLoggedIn = !!user && !user.isAnonymous;
  return { ready, user, isAnon, isLoggedIn };
}

function RequireAuth({ children }) {
  const { ready, isLoggedIn } = useAuthReady();
  if (!ready) return <div style={{ padding: 16 }}>Cargando sesión…</div>;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function RequireAuthAllowAnon({ children }) {
  const { ready, user } = useAuthReady();
  if (!ready) return <div style={{ padding: 16 }}>Cargando sesión…</div>;
  if (!user) {
    try {
      if (!localStorage.getItem("uid")) {
        const gen =
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()));
        localStorage.setItem("uid", `anon-offline-${gen}`);
      }
    } catch {}
    return children;
  }
  return children;
}

function AllowAnonWithPlan({ children }) {
  const { ready, user } = useAuthReady();
  if (!ready)
    return <div style={{ padding: 16, fontFamily: "sans-serif" }}>Cargando tu sesión docente…</div>;
  if (!user) return <Navigate to="/home" replace />;
  return <PlanGuard allowDuringTrial={true}>{children}</PlanGuard>;
}

function RedirectIfAuthed({ children }) {
  const { ready, isLoggedIn } = useAuthReady();
  if (!ready) return null;
  return isLoggedIn ? <Navigate to="/home" replace /> : children;
}

function GuardedLayout() {
  return (
    <RequireAuth>
      <PlanGuard allowDuringTrial={true}>
        <Outlet />
      </PlanGuard>
    </RequireAuth>
  );
}

function DesarrolloRouteWrapper() {
  const navigate = useNavigate();
  return <DesarrolloClase duracion={30} onIrACierre={() => navigate("/cierre")} />;
}
function AsistenciaWrapper() {
  const { code } = useParams();
  const search = new URLSearchParams();
  search.set("m", "asis");
  if (code) search.set("code", code);
  return <Navigate to={`/participa?${search.toString()}`} replace />;
}
function SalaWrapper() {
  const { code } = useParams();
  const search = new URLSearchParams();
  if (code) search.set("code", code);
  return <Navigate to={`/participa?${search.toString()}`} replace />;
}

/* ─────────────────────────────────────────
   🔧 HashRedirector (soporte #/ruta)
   ───────────────────────────────────────── */
function HashRedirector() {
  const loc = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Soporta /#/Ruta y también /algo#/Ruta
    const full = (loc.pathname || "") + (loc.hash || "");
    if (full.includes("#/")) {
      const target = full.substring(full.indexOf("#") + 1); // desde #
      if (target && target !== loc.pathname) {
        navigate(target, { replace: true });
      }
    }
  }, [loc.pathname, loc.hash, navigate]);

  return null;
}

/* ─────────────────────────────────────────
   🔒 Parche anti-redirecciones a /home mientras debug
   ───────────────────────────────────────── */
function ForceInicioClaseDev({ children }) {
  const nav = useNavigate();
  const loc = useLocation();
  React.useEffect(() => {
    // Si algo externo nos manda a /home, re-enrutamos a /InicioClase
    if (loc.pathname === "/home") {
      nav("/InicioClase", { replace: true });
    }
  }, [loc.pathname, nav]);
  return children;
}

/* ─────────────────────────────────────────
   APP PRINCIPAL
   ───────────────────────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
        {/* ✅ HashRedirector antes de las rutas */}
        <HashRedirector />
        <Routes>
          <Route path="/" element={<RutaInicial />} />
          <Route path="/home" element={<Home />} />
          <Route path="/registro" element={<Registro />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />
          <Route path="/participa" element={<Participa />} />
          <Route
            path="/test-nube"
            element={
              <RequireAuthAllowAnon>
                <TestNube />
              </RequireAuthAllowAnon>
            }
          />

          {/* ⛑️ Forzado temporal anti-redirect al probar InicioClase */}
          <Route
            path="/InicioClase"
            element={
              <ForceInicioClaseDev>
                <InicioClase />
              </ForceInicioClaseDev>
            }
          />

          <Route
            path="/desarrollo"
            element={
              <RequireAuthAllowAnon>
                <DesarrolloRouteWrapper />
              </RequireAuthAllowAnon>
            }
          />
          <Route
            path="/cierre"
            element={
              <RequireAuthAllowAnon>
                <CierreClase duracion={10} />
              </RequireAuthAllowAnon>
            }
          />
          <Route path="/demo" element={<InicioClase />} />
          <Route
            path="/horario"
            element={
              <AllowAnonWithPlan>
                <HorarioEditable />
              </AllowAnonWithPlan>
            }
          />
          <Route
            path="/horario/editar"
            element={
              <AllowAnonWithPlan>
                <HorarioEditable />
              </AllowAnonWithPlan>
            }
          />
          <Route path="/plan-clase" element={<PlanClaseEditor />} />
          <Route path="/planificaciones" element={<Planificaciones />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/pago" element={<Pago />} />
          <Route path="/confirmacion-pago" element={<ConfirmacionPago />} />
          <Route element={<GuardedLayout />}>
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          {/* ✅ Fallback que no pisa rutas hash */}
          <Route
            path="*"
            element={
              window.location.hash && window.location.hash.startsWith("#/")
                ? null
                : <Navigate to="/home" replace />
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}








































