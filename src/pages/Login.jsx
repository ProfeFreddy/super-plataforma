import React from "react"; 
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";

/* Firestore para decidir redirección post-login (no tocado) */
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/* ===== Helpers de mensajes ===== */
function msgFromFirebaseCode(code) {
  switch (code) {
    case "auth/user-not-found":
      return "No encontramos una cuenta con ese correo.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "La contraseña es incorrecta.";
    case "auth/invalid-email":
      return "El formato del correo no es válido.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Inténtalo más tarde.";
    case "auth/network-request-failed":
      return "Problema de conexión. Puede ser un bloqueo (VPN/AdBlock) o red inestable.";
    case "auth/operation-not-allowed":
      return "El método de acceso no está habilitado para este proyecto.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}

/* ===== Diagnóstico de conectividad (mejorado) =====
   Devuelve un objeto con el estado de cada endpoint crítico.
*/
async function probeConnectivityDetailed() {
  const out = {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    gstatic: false,
    identitytoolkit: false,
    securetoken: false,
    details: {},
  };
  const tryFetch = async (url) => {
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      return true;
    } catch (e) {
      return false;
    }
  };
  out.gstatic = await tryFetch("https://www.gstatic.com/generate_204");
  out.identitytoolkit = await tryFetch(
    "https://identitytoolkit.googleapis.com/.well-known/openid-configuration"
  );
  out.securetoken = await tryFetch(
    "https://securetoken.googleapis.com/.well-known/openid-configuration"
  );
  out.ok = out.online && out.gstatic && out.identitytoolkit && out.securetoken;
  return out;
}

/* ===== Verifica plan activo para decidir a dónde va tras login ===== */
async function hasActivePlan(uid) {
  try {
    if (!uid) return false;
    const snap = await getDoc(doc(db, "users", uid, "meta", "limits"));
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    const plan = String(data.plan || "").toUpperCase();
    const endTs = data?.period?.end;
    const endDate =
      endTs?.toDate?.() || (endTs instanceof Date ? endTs : null);
    const isActive = !!endDate && endDate > new Date();
    const isFreeLike = plan === "FREE" || plan === "TRIAL" || plan === "BASICO_TRIAL";
    return isActive && !isFreeLike;
  } catch {
    return false;
  }
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);

  const [email, setEmail] = React.useState(qs.get("email") || "");
  const [pass, setPass] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [canCreate, setCanCreate] = React.useState(false);

  /* Nuevo: estado del diagnóstico */
  const [diag, setDiag] = React.useState(null);
  const [runningDiag, setRunningDiag] = React.useState(false);

  const loadingGuardRef = React.useRef(null);
  const startLoadingGuard = () => {
    clearLoadingGuard();
    loadingGuardRef.current = setTimeout(() => {
      setLoading(false);
      setError("Está tardando más de lo normal. Revisa si hay VPN/AdBlock o vuelve a intentarlo.");
    }, 15000);
  };
  const clearLoadingGuard = () => {
    if (loadingGuardRef.current) {
      clearTimeout(loadingGuardRef.current);
      loadingGuardRef.current = null;
    }
  };

  const runDiag = async () => {
    setRunningDiag(true);
    const r = await probeConnectivityDetailed();
    setDiag(r);
    setRunningDiag(false);
    return r;
  };

  const goAfterLogin = React.useCallback(async () => {
    const next = qs.get("next");
    if (next) {
      nav(next, { replace: true });
      setTimeout(() => { try { window.location.assign(next); } catch {} }, 120);
      return;
    }
    const active = await hasActivePlan(auth.currentUser?.uid);
    const dest = active ? "/inicioclase" : "/pago";
    nav(dest, { replace: true });
    setTimeout(() => { try { window.location.assign(dest); } catch {} }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, loc.key]);

  /* Al montar: si ya está autenticado, redirige y además corre diagnóstico para mostrar si hay bloqueos */
  React.useEffect(() => {
    runDiag(); // no bloqueante, solo informativo
    const stop = onAuthStateChanged(auth, (u) => { if (u) goAfterLogin(); });
    return () => { stop(); clearLoadingGuard(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCanCreate(false);

    const mail = email.trim().toLowerCase();
    if (!mail || !pass) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    const test = diag || (await runDiag());
    if (!test?.ok) {
      setError(
        "No pudimos contactar a los servicios de autenticación. Desactiva VPN/AdBlock, permite los dominios y vuelve a intentar."
      );
      return;
    }

    try {
      setLoading(true);
      startLoadingGuard();
      await signInWithEmailAndPassword(auth, mail, pass);
      clearLoadingGuard();
      setLoading(false);
      await goAfterLogin();
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, mail);
          if (!methods || methods.length === 0) {
            setCanCreate(true);
            setError("No encontramos una cuenta con ese correo. Puedes crearla ahora.");
          } else {
            setError("Tu cuenta existe, pero la contraseña no coincide.");
          }
        } catch (e2) {
          setError(msgFromFirebaseCode(e2?.code) || "No pudimos verificar el correo.");
        }
      } else if (
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/wrong-password" ||
        err?.code === "auth/invalid-email" ||
        err?.code === "auth/too-many-requests" ||
        err?.code === "auth/operation-not-allowed"
      ) {
        setError(msgFromFirebaseCode(err?.code));
      } else if (err?.code === "auth/network-request-failed") {
        setError("No se pudo contactar a Firebase (posible VPN/AdBlock/firewall). Intenta nuevamente.");
      } else {
        setError(err?.message || "No se pudo iniciar sesión.");
      }
    } finally {
      clearLoadingGuard();
      setLoading(false);
    }
  };

  const goToRegister = () => {
    const url = new URLSearchParams();
    if (email) url.set("email", email.trim());
    if (qs.get("next")) url.set("next", qs.get("next"));
    nav(`/registro?${url.toString()}`);
  };

  const Pill = ({ ok, label, onOpen }) => (
    <div style={{
      display:"flex",alignItems:"center",gap:8,
      padding:"6px 10px",borderRadius:999,
      background: ok ? "#ecfdf5" : "#fff1f2",
      border:`1px solid ${ok ? "#34d399" : "#fda4af"}`,
      color: ok ? "#065f46" : "#7f1d1d",
      fontSize:12, fontWeight:600
    }}>
      <span style={{width:8,height:8,borderRadius:999,background: ok ? "#10b981" : "#ef4444"}}/>
      {label}
      {onOpen && (
        <button onClick={onOpen} style={{marginLeft:6,border:"none",background:"transparent",color:"#0ea5e9",cursor:"pointer"}}>
          probar
        </button>
      )}
    </div>
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>🔐 Iniciar Sesión</h1>

        {/* Panel de diagnóstico */}
        {diag && (
          <div style={{marginBottom:12, padding:10, border:"1px dashed #cbd5e1", borderRadius:8, background:"#f8fafc"}}>
            <div style={{fontSize:13, color:"#334155", marginBottom:6, fontWeight:700}}>
              Diagnóstico rápido
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              <Pill ok={!!diag.online} label="Internet" />
              <Pill ok={!!diag.gstatic} label="gstatic (red básica)" onOpen={() => window.open("https://www.gstatic.com/generate_204","_blank")}/>
              <Pill ok={!!diag.identitytoolkit} label="identitytoolkit (Auth)" onOpen={() => window.open("https://identitytoolkit.googleapis.com/.well-known/openid-configuration","_blank")}/>
              <Pill ok={!!diag.securetoken} label="securetoken (tokens)" onOpen={() => window.open("https://securetoken.googleapis.com/.well-known/openid-configuration","_blank")}/>
            </div>
            {!diag.ok && (
              <div style={{marginTop:8, fontSize:12, color:"#7f1d1d"}}>
                ⚠️ Algo bloquea el acceso a los servicios de Google. Desactiva VPN/AdBlock o permite estos dominios:
                <div><code>identitytoolkit.googleapis.com</code></div>
                <div><code>securetoken.googleapis.com</code></div>
                <div><code>gstatic.com</code> y <code>googleapis.com</code></div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>Correo electrónico</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            style={styles.input}
            disabled={loading}
          />

          <label style={styles.label}>Contraseña</label>
          <input
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Tu clave secreta"
            style={styles.input}
            disabled={loading}
          />

          {error && (
            <div style={styles.error} role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || runningDiag} style={{ ...styles.btnPrimary, opacity: (loading || runningDiag) ? 0.7 : 1 }}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div style={styles.muted}>
          ¿No tienes cuenta?{" "}
          <button onClick={goToRegister} style={styles.linkBtn} disabled={loading}>
            Regístrate aquí
          </button>
        </div>

        {canCreate && (
          <div style={{ marginTop: 8 }}>
            <button onClick={goToRegister} style={styles.btnGhost} disabled={loading}>
              Crear cuenta con <b>{email}</b>
            </button>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Link to="/home" style={styles.link}>
            ↩ Volver al inicio
          </Link>
        </div>

        {error && error.toLowerCase().includes("firebase") && (
          <div style={{ ...styles.smallMuted, marginTop: 12 }}>
            Si persiste: desactiva VPN/AdBlock, prueba modo incógnito u otro navegador.
            Dominios a permitir: identitytoolkit.googleapis.com, securetoken.googleapis.com, firebaseapp.com, gstatic.com, googleapis.com.
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(1200px 600px at 20% -10%, #7dd3fc22, transparent), radial-gradient(1000px 500px at 110% 10%, #a7f3d022, transparent), #f8fafc",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 10px 30px rgba(2,6,23,.08)",
  },
  h1: { margin: 0, marginBottom: 10, fontSize: 22 },
  label: { fontSize: 13, color: "#334155" },
  input: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    outline: "none",
  },
  btnPrimary: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: "#0ea5e9",
    color: "#fff",
    cursor: "pointer",
  },
  btnGhost: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#fff",
    cursor: "pointer",
  },
  btnSecondary: {
    marginTop: 4,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #0ea5e9",
    background: "#e0f2fe",
    color: "#0ea5e9",
    cursor: "pointer",
    width: "100%",
  },
  muted: { marginTop: 12, fontSize: 13, color: "#475569" },
  smallMuted: { marginTop: 4, fontSize: 12, color: "#64748b" },
  link: { color: "#0ea5e9", textDecoration: "none" },
  linkBtn: {
    background: "transparent",
    color: "#0ea5e9",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 13,
  },
};






