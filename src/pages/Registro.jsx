import React from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../firebase";

/* Traducción de errores reales de Firebase */
function msgFromFirebaseCode(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Ese correo ya está registrado. Inicia sesión o usa otro correo.";
    case "auth/invalid-email":
      return "El formato del correo no es válido.";
    case "auth/weak-password":
      return "La contraseña es muy débil. Usa al menos 6 caracteres.";
    case "auth/operation-not-allowed":
      return "El método de registro no está habilitado para este proyecto.";
    case "auth/network-request-failed":
      return "Problema de conexión. Revisa tu red o intenta de nuevo.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/timeout":
      return "Se agotó el tiempo de espera. Revisa tu conexión.";
    default:
      return "No se pudo crear la cuenta. Inténtalo nuevamente.";
  }
}

/* Validación de email */
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

/*
  Timer suave: marcamos si se demoró mucho, pero NO hacemos reject automático.
  Esto evita que el usuario vea un error rojo inventado aunque Firebase sí creó la cuenta.
*/
function withGentleTimeout(promise, ms = 15000, slowRef = null) {
  let timer;
  if (slowRef) {
    slowRef.current = false;
    timer = setTimeout(() => {
      slowRef.current = true; // solo lo marcamos, no rechazamos
    }, ms);
  }

  return promise.finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default function Registro() {
  const nav = useNavigate();
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);

  const [nombre, setNombre] = React.useState("");
  const [email, setEmail] = React.useState(qs.get("email") || "");
  const [pass, setPass] = React.useState("");
  const [pass2, setPass2] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Para saber si se tardó más de lo normal
  const slowRef = React.useRef(false);

  // Debug útil en consola (no se ve en UI)
  React.useEffect(() => {
    try {
      const opts = auth?.app?.options || {};
      console.log(
        "[Registro][FB] projectId:",
        opts.projectId,
        "| authDomain:",
        opts.authDomain,
        "| apiKey defined:",
        Boolean(opts.apiKey)
      );
    } catch {}
  }, []);

  // A dónde vamos después de registrar
  const goAfterRegister = () => {
    const next = qs.get("next");
    const dest = next || "/horario"; // tu destino por defecto
    nav(dest, { replace: true });

    // fallback por si HashRouter no navega como esperamos
    try {
      setTimeout(() => {
        if (!location.pathname.startsWith(dest)) {
          window.location.assign(dest);
        }
      }, 150);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const mail = String(email || "").trim().toLowerCase();
    const pwd = String(pass || "");
    const pwd2 = String(pass2 || "");
    const display = String(nombre || "").trim();

    // Validaciones de formulario
    if (!mail || !pwd) {
      setError("Completa correo y contraseña.");
      return;
    }
    if (!isEmail(mail)) {
      setError("El correo no parece válido.");
      return;
    }
    if (pwd.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (pwd !== pwd2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    // Validación rápida de config
    try {
      const opts = auth?.app?.options || {};
      if (!opts.apiKey) {
        setError(
          "Falta la apiKey de Firebase en la configuración local. Ajusta src/firebase.js."
        );
        return;
      }
    } catch {}

    try {
      setLoading(true);

      // Creamos usuario en Firebase Auth.
      // OJO: si esto funciona, Firebase YA creó la cuenta aunque la UI se quede pegada.
      let cred;
      await withGentleTimeout(
        (async () => {
          cred = await createUserWithEmailAndPassword(auth, mail, pwd);
        })(),
        15000,
        slowRef
      );

      // Si por alguna razón cred no existe, significa que se cayó en mitad de la creación.
      // Eso es súper raro, pero evitemos crashear.
      if (!cred || !cred.user) {
        console.warn("[Registro] cred.user ausente después de crear cuenta");
        setError(
          slowRef.current
            ? "La conexión está muy lenta. Intenta nuevamente."
            : "No se pudo terminar el registro. Intenta nuevamente."
        );
        return;
      }

      // Actualizar displayName (no bloquea)
      if (display) {
        try {
          await updateProfile(cred.user, { displayName: display });
        } catch (errProfile) {
          console.warn("[Registro] updateProfile falló:", errProfile);
        }
      }

      // Enviar verificación al correo (tampoco bloquea)
      try {
        await sendEmailVerification(cred.user);
      } catch (errVerif) {
        console.warn("[Registro] sendEmailVerification falló:", errVerif);
      }

      // ✨ ÉXITO REAL ✨
      // limpiamos cualquier error viejo por si estaba pintado en rojo
      setError("");

      // y navegamos al siguiente paso
      goAfterRegister();
    } catch (err) {
      console.warn("[Registro] catch err:", err);

      // Mapeamos errores de Firebase conocidos
      const nice = msgFromFirebaseCode(err?.code);

      // Si no es un código auth/* pero trae un mensaje genérico tipo timeout viejo,
      // damos algo menos técnico:
      const fallbackMsg = slowRef.current
        ? "Está tardando más de lo normal. Revisa tu conexión e inténtalo otra vez."
        : "No se pudo crear la cuenta. Inténtalo nuevamente.";

      setError(
        err?.message?.includes?.("Firebase:") || err?.code?.startsWith?.("auth/")
          ? nice
          : fallbackMsg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>📝 Crear cuenta</h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>Nombre y Apellido</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Ana Pérez"
            style={styles.input}
            autoComplete="name"
            name="name"
          />

          <label style={styles.label}>Correo electrónico</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            style={styles.input}
            name="email"
            inputMode="email"
          />

          <label style={styles.label}>Contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            style={styles.input}
            name="new-password"
          />

          <label style={styles.label}>Repite la contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            placeholder="Confirma tu contraseña"
            style={styles.input}
            name="confirm-password"
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.btnPrimary}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <div style={styles.muted}>
          ¿Ya tienes una cuenta?{" "}
          <Link
            to={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            style={styles.link}
          >
            Inicia sesión
          </Link>
        </div>

        <div style={{ marginTop: 8 }}>
          <Link to="/home" style={styles.link}>
            ← Volver al inicio
          </Link>
        </div>
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
    maxWidth: 520,
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
    background: "#10b981",
    color: "#fff",
    cursor: "pointer",
  },
  muted: { marginTop: 12, fontSize: 13, color: "#475569" },
  link: { color: "#0ea5e9", textDecoration: "none" },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 13,
  },
};







