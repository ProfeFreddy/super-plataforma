// App.jsx
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
import "./pdf-worker-setup";
import StudioDashboard from "./studio/pages/StudioDashboard";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";

import Home from "./pages/Home";
import Gincana from "./pages/Gincana";
import Registro from "./pages/Registro";
import Login from "./pages/Login";
import Participa from "./pages/Participa";
import Perfil from "./pages/Perfil";
import HorarioEditable from "./pages/HorarioEditable";
import PlanGuard from "./components/PlanGuard";
import RutaInicial from "./pages/RutaInicial";
import TestNube from "./pages/TestNube";
import OnboardingExpress from "./pages/OnboardingExpress";
import Demo from "./pages/Demo";
import BancoPreguntas from "./studio/pages/BancoPreguntas";
import ImportadorJson from "./studio/pages/ImportadorJson";

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
const ClaseEspecial = lazy(() =>
  import("./pages/ClaseEspecial").then((mod) => ({
    default: mod.ClaseEspecial || mod.default || mod,
  }))
);

/* ── ErrorBoundary ── */
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
      <div
        key={label}
        style={{ marginBottom: "0.75rem", wordBreak: "break-word" }}
      >
        <div style={{ fontWeight: 600, marginBottom: ".25rem" }}>{label}:</div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace,monospace",
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
        this.state.err?.message ||
        this.safeText(this.state.err) ||
        "Error desconocido";

      const detailBlocks = [
        this.safeBlock("stack", this.state.err?.stack),
        this.safeBlock("componentStack", this.state.info?.componentStack),
      ].filter(Boolean);

      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#fff1f2",
            color: "#881337",
            fontFamily: "system-ui,sans-serif",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              background: "#fff",
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
              <span role="img" aria-label="warning">
                ⚠️
              </span>
              <span>Ocurrió un error renderizando la página</span>
            </div>

            <div
              style={{
                color: "#881337",
                fontFamily: "ui-monospace,monospace",
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

/* ── Hooks y guards ── */
function useAuthReady() {
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

          const usr = cred.user || null;
          setUser(usr);

          try {
            if (usr?.uid) localStorage.setItem("uid", usr.uid);
          } catch {}

          setReady(true);
        } else {
          setUser(u || null);

          try {
            if (u?.uid) localStorage.setItem("uid", u.uid);
          } catch {}

          setReady(true);
        }
      } catch (err) {
        console.error("No pude crear sesión anónima", err);
        setUser(null);
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
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now());
        localStorage.setItem("uid", `anon-offline-${gen}`);
      }
    } catch {}

    return children;
  }

  return children;
}

function AllowAnonWithPlan({ children }) {
  const { ready, user } = useAuthReady();

  if (!ready) {
    return (
      <div style={{ padding: 16, fontFamily: "sans-serif" }}>
        Cargando tu sesión docente…
      </div>
    );
  }

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
  return <DesarrolloClase duracion={30} />;
}

function SalaWrapper() {
  const { code } = useParams();
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    const sp = new URLSearchParams(loc.search);
    let changed = false;

    if (code && !sp.get("code")) {
      sp.set("code", code);
      changed = true;
    }

    if (changed) {
      nav(
        {
          pathname: loc.pathname,
          search: `?${sp.toString()}`,
          hash: loc.hash,
        },
        { replace: true }
      );
    }
  }, [code, loc.pathname, loc.search, loc.hash, nav]);

  return (
    <RequireAuthAllowAnon>
      <Participa />
    </RequireAuthAllowAnon>
  );
}

function AsistenciaWrapper() {
  const { code } = useParams();
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    const sp = new URLSearchParams(loc.search);
    let changed = false;

    if (!sp.get("m")) {
      sp.set("m", "asis");
      changed = true;
    }

    if (code && !sp.get("code")) {
      sp.set("code", code);
      changed = true;
    }

    if (changed) {
      nav(
        {
          pathname: loc.pathname,
          search: `?${sp.toString()}`,
          hash: loc.hash,
        },
        { replace: true }
      );
    }
  }, [code, loc.pathname, loc.search, loc.hash, nav]);

  return (
    <RequireAuthAllowAnon>
      <Participa />
    </RequireAuthAllowAnon>
  );
}

function HashRedirector() {
  const loc = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const atRoot =
      loc.pathname === "/" ||
      loc.pathname === "/index.html" ||
      loc.pathname === "" ||
      loc.pathname === undefined;

    if (!atRoot) return;

    const hash = loc.hash || "";
    if (!hash.startsWith("#/")) return;

    const target = hash.slice(1);
    if (target && target !== loc.pathname) {
      navigate(target, { replace: true });
    }
  }, [loc.pathname, loc.hash, navigate]);

  return null;
}

function ForceInicioClaseDev({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    const flag =
      (typeof window !== "undefined" && window.__FORCE_INICIO) ||
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("__FORCE_INICIO") === "1");

    if (flag && loc.pathname === "/home") {
      nav("/InicioClase", { replace: true });
    }
  }, [loc.pathname, nav]);

  return children;
}

/* ── APP PRINCIPAL ── */
export default function App() {
  const esSubdominioJuego =
    window.location.hostname === "juego.pragmaprofe.com";

  const estaEnRaiz =
    window.location.pathname === "/" ||
    window.location.pathname === "";

  if (esSubdominioJuego && estaEnRaiz) {
    window.location.replace(
      "https://juego.pragmaprofe.com/gincana/"
    );

    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        Abriendo GincanaNexus…
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
        <HashRedirector />

        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/registro" element={<Registro />} />

          {/* Onboarding Express */}
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingExpress />
              </RequireAuth>
            }
          />

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
            path="/participa/:code"
            element={
              <RequireAuthAllowAnon>
                <Participa />
              </RequireAuthAllowAnon>
            }
          />

          <Route
            path="/test-nube"
            element={
              <RequireAuthAllowAnon>
                <TestNube />
              </RequireAuthAllowAnon>
            }
          />

          <Route
            path="/InicioClase"
            element={
              <ForceInicioClaseDev>
                <InicioClase />
              </ForceInicioClaseDev>
            }
          />
          <Route path="/inicio" element={<Navigate to="/InicioClase" replace />} />
          <Route path="/inicioClase" element={<Navigate to="/InicioClase" replace />} />
          <Route path="/inicioclase" element={<Navigate to="/InicioClase" replace />} />
          <Route path="/Inicioclase" element={<Navigate to="/InicioClase" replace />} />

          <Route path="/sala" element={<Navigate to="/participa" replace />} />
          <Route path="/sala/:code" element={<SalaWrapper />} />
          <Route path="/asistencia/:code" element={<AsistenciaWrapper />} />

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
          <Route
            path="/CierreClase"
            element={
              <RequireAuthAllowAnon>
                <CierreClase duracion={10} />
              </RequireAuthAllowAnon>
            }
          />
          <Route path="/cierreclase" element={<Navigate to="/CierreClase" replace />} />
          <Route path="/Cierreclase" element={<Navigate to="/CierreClase" replace />} />

          {/* Demo real del onboarding */}
          <Route path="/demo" element={<Demo />} />

          <Route
            path="/horario"
            element={
              <RequireAuth>
                <HorarioEditable />
              </RequireAuth>
            }
          />
          <Route
            path="/horario/editar"
            element={
              <RequireAuth>
                <HorarioEditable />
              </RequireAuth>
            }
          />
          <Route
            path="/planificaciones"
            element={
              <RequireAuth>
                <Planificaciones />
              </RequireAuth>
            }
          />

          <Route path="/plan-clase" element={<PlanClaseEditor />} />
          <Route
  path="/planes"
  element={<Navigate to="/home" replace />}
/>
          <Route path="/gincana" element={<Gincana />} />
          <Route path="/pago" element={<Pago />} />
          <Route path="/confirmacion-pago" element={<ConfirmacionPago />} />

          <Route
            path="/clase-especial"
            element={
              <RequireAuthAllowAnon>
                <ClaseEspecial />
              </RequireAuthAllowAnon>
            }
          />

          <Route element={<GuardedLayout />}>
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          <Route path="/studio" element={<StudioDashboard />} />

<Route
  path="/studio/banco"
  element={<BancoPreguntas />}
/>

<Route
  path="/studio/editor"
  element={<div>Editor (próximo paso)</div>}
/>

<Route
  path="/studio/ia"
  element={<div>IA (próximo paso)</div>}
/>

<Route
  path="/studio/export"
  element={<div>Exportador (próximo paso)</div>}
/>

<Route
  path="/studio/stats"
  element={<div>Estadísticas (próximo paso)</div>}
/>

<Route
  path="/studio/importar"
  element={<ImportadorJson />}
/>

          <Route
            path="*"
            element={
              typeof window !== "undefined" &&
              window.location.hash &&
              window.location.hash.startsWith("#/")
                ? null
                : <Navigate to="/home" replace />
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}