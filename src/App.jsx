// src/App.jsx
import React, { Suspense, lazy } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

// registra el worker de pdf (no exporta nada, pero algunos componentes lo necesitan)
import "./pdf-worker-setup";

// Páginas cargadas normal (no lazy)
import Home from "./pages/Home";
import Registro from "./pages/Registro";
import Login from "./pages/Login";
import Participa from "./pages/Participa";
import Perfil from "./pages/Perfil";
import HorarioEditable from "./pages/HorarioEditable";
import PlanGuard from "./components/PlanGuard";
import RutaInicial from "./pages/RutaInicial";

/*
  IMPORTANTE:
  Muchas de tus páginas exportan "export { NombreComponente }"
  en vez de "export default NombreComponente".

  React.lazy() espera que el módulo tenga "default".
  Para no tocar tus archivos originales, hacemos este patrón:

  const X = lazy(() =>
    import("./pages/X").then(mod => ({ default: mod.X }))
  );

  Así le damos a React.lazy un default artificial.
*/

// Inicio de clase
const InicioClase = lazy(() =>
  import("./pages/InicioClase").then((mod) => ({
    default: mod.InicioClase || mod.default || mod,
  }))
);

// Desarrollo de la clase
const DesarrolloClase = lazy(() =>
  import("./pages/DesarrolloClase").then((mod) => ({
    default: mod.DesarrolloClase || mod.default || mod,
  }))
);

// Cierre de la clase
const CierreClase = lazy(() =>
  import("./pages/CierreClase").then((mod) => ({
    default: mod.CierreClase || mod.default || mod,
  }))
);

// Pago / planes
const Pago = lazy(() =>
  import("./pages/Pago").then((mod) => ({
    default: mod.Pago || mod.default || mod,
  }))
);

// Confirmación de pago
const ConfirmacionPago = lazy(() =>
  import("./pages/ConfirmacionPago").then((mod) => ({
    default: mod.ConfirmacionPago || mod.default || mod,
  }))
);

// Planificaciones
const Planificaciones = lazy(() =>
  import("./pages/Planificaciones.jsx").then((mod) => ({
    default: mod.Planificaciones || mod.default || mod,
  }))
);

// Editor de plan de clase
const PlanClaseEditor = lazy(() =>
  import("./pages/PlanClaseEditor.jsx").then((mod) => ({
    default: mod.PlanClaseEditor || mod.default || mod,
  }))
);

// PlanificadorClase (lo cargas pero todavía no lo enrutas abajo, igual lo dejamos)
const PlanificadorClase = lazy(() =>
  import("./pages/PlanificadorClase.jsx").then((mod) => ({
    default: mod.PlanificadorClase || mod.default || mod,
  }))
);

/* ─────────────────────────────────────────
   ErrorBoundary robusto
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
    if (val instanceof Error) {
      return val.message || val.toString();
    }
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
        style={{
          marginBottom: "0.75rem",
          wordBreak: "break-word",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: ".25rem",
          }}
        >
          {label}:
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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
        this.safeBlock(
          "componentStack",
          this.state.info && this.state.info.componentStack
        ),
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
            boxSizing: "border-box",
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
              <span role="img" aria-label="warning">
                ⚠️
              </span>
              <span>Ocurrió un error renderizando la página</span>
            </div>

            <div
              style={{
                color: "#881337",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: ".75rem",
                  lineHeight: "1rem",
                  color: "#7f1d1d",
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
   Wrapper RequirePlan = lo que tenías con PlanGuard
   ───────────────────────────────────────── */
function RequirePlan({ children }) {
  return <PlanGuard allowDuringTrial={true}>{children}</PlanGuard>;
}

/* ─────────────────────────────────────────
   Hook pequeño para saber si ya cargó Firebase Auth
   ───────────────────────────────────────── */
function useAuthReady() {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    let unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
    });

    const t = setTimeout(() => {
      setReady(true);
    }, 1500);

    return () => {
      clearTimeout(t);
      if (unsub) unsub();
    };
  }, []);

  return { ready, user };
}

/* ─────────────────────────────────────────
   Rutas que requieren login NO anónimo
   ───────────────────────────────────────── */
function RequireAuth({ children }) {
  const { ready, user } = useAuthReady();
  if (!ready)
    return <div style={{ padding: 16 }}>Cargando sesión…</div>;

  const isAuthed = !!user && !user.isAnonymous;
  return isAuthed ? children : <Navigate to="/login" replace />;
}

/* ─────────────────────────────────────────
   Si el usuario YA está logeado → mándalo a /home
   evita que abra /login otra vez
   ───────────────────────────────────────── */
function RedirectIfAuthed({ children }) {
  const { ready, user } = useAuthReady();
  if (!ready) return null;

  const isAuthed = !!user && !user.isAnonymous;
  return isAuthed ? <Navigate to="/home" replace /> : children;
}

/* ─────────────────────────────────────────
   Layout protegido:
   - primero exige login (RequireAuth)
   - luego exige plan (PlanGuard / RequirePlan)
   ───────────────────────────────────────── */
function GuardedLayout() {
  return (
    <RequireAuth>
      <PlanGuard allowDuringTrial={true}>
        <Outlet />
      </PlanGuard>
    </RequireAuth>
  );
}

/* ─────────────────────────────────────────
   Wrapper para pasar props a DesarrolloClase
   ───────────────────────────────────────── */
function DesarrolloRouteWrapper() {
  const navigate = useNavigate();
  return (
    <DesarrolloClase
      duracion={30}
      onIrACierre={() => navigate("/cierre")}
    />
  );
}

/* ─────────────────────────────────────────
   Rutas QR rápidas → redirigen a /participa con query
   /asistencia               → /participa?m=asis
   /asistencia/:code         → /participa?m=asis&code=...
   /sala/:code               → /participa?code=...
   ───────────────────────────────────────── */
function AsistenciaWrapper() {
  const { code } = useParams();
  const search = new URLSearchParams();
  search.set("m", "asis");
  if (code) search.set("code", code);
  return (
    <Navigate to={`/participa?${search.toString()}`} replace />
  );
}

function SalaWrapper() {
  const { code } = useParams();
  const search = new URLSearchParams();
  if (code) search.set("code", code);
  return (
    <Navigate to={`/participa?${search.toString()}`} replace />
  );
}

/* ─────────────────────────────────────────
   APP PRINCIPAL
   ───────────────────────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
        <Routes>
          {/* Ruta raíz inicial */}
          <Route path="/" element={<RutaInicial />} />

          {/* Públicas */}
          <Route path="/home" element={<Home />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/participa" element={<Participa />} />

          {/* Alias públicos para QR */}
          <Route path="/asistencia" element={<AsistenciaWrapper />} />
          <Route path="/asistencia/:code" element={<AsistenciaWrapper />} />
          <Route path="/sala/:code" element={<SalaWrapper />} />

          {/* Login: si ya estás logeado → redirige a /home */}
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />

          {/* Inicio de clase:
             - en dev cualquiera puede entrar
             - en prod exige plan */}
          <Route
            path="/inicioclase"
            element={
              import.meta.env.DEV ? (
                <InicioClase />
              ) : (
                <RequirePlan>
                  <InicioClase />
                </RequirePlan>
              )
            }
          />

          {/* Editor directo de horario */}
          <Route path="/horario/editar" element={<HorarioEditable />} />

          {/* Páginas varias */}
          <Route path="/plan-clase" element={<PlanClaseEditor />} />
          <Route
            path="/confirmacion-pago"
            element={<ConfirmacionPago />}
          />

          {/* Pago / Planes públicas */}
          <Route path="/pago" element={<Pago />} />
          <Route path="/planes" element={<Pago />} />

          {/* Privadas bajo sesión + plan */}
          <Route element={<GuardedLayout />}>
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/horario" element={<HorarioEditable />} />
            <Route
              path="/planificaciones"
              element={<Planificaciones />}
            />
            <Route
              path="/desarrollo"
              element={<DesarrolloRouteWrapper />}
            />
            <Route
              path="/cierre"
              element={<CierreClase duracion={10} />}
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
































