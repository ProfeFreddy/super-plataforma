// src/pages/Registro.jsx
import React from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

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

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

function withGentleTimeout(promise, ms = 15000, slowRef = null) {
  let timer;
  if (slowRef) {
    slowRef.current = false;
    timer = setTimeout(() => {
      slowRef.current = true;
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
  const [success, setSuccess] = React.useState(false);
  const [isSlow, setIsSlow] = React.useState(false);

  const slowRef = React.useRef(false);

  React.useEffect(() => {
    const id = setInterval(() => setIsSlow(!!slowRef.current), 300);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess(false);

    const mail = String(email || "").trim().toLowerCase();
    const pwd = String(pass || "");
    const pwd2 = String(pass2 || "");
    const display = String(nombre || "").trim();

    if (!mail || !pwd) return setError("Completa correo y contraseña.");
    if (!isEmail(mail)) return setError("El correo no parece válido.");
    if (pwd.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (pwd !== pwd2) return setError("Las contraseñas no coinciden.");

    try {
      setLoading(true);
      console.log("[Registro] Intentando crear usuario…");

      const cred = await withGentleTimeout(
        createUserWithEmailAndPassword(auth, mail, pwd),
        15000,
        slowRef
      );

      const user = cred?.user;
      console.log("[Registro] Usuario creado:", user?.uid || "(sin uid)");

      if (!user) {
        setError("No se pudo completar el registro. Inténtalo nuevamente.");
        return;
      }

      // Nombre visible (si se ingresó)
      if (display) {
        try {
          await updateProfile(user, { displayName: display });
          console.log("[Registro] Perfil actualizado con nombre:", display);
        } catch (errProfile) {
          console.warn("[Registro] updateProfile falló:", errProfile);
        }
      }

      // Enviar verificación (no bloquea flujo)
      try {
        await sendEmailVerification(user);
        console.log("[Registro] Verificación enviada a:", user.email);
      } catch (errVerif) {
        console.warn("[Registro] sendEmailVerification falló:", errVerif);
      }

      // Escribir en Firestore (colección principal)
      try {
        await setDoc(
          doc(db, "usuarios", user.uid),
          {
            nombre: display || user.displayName || "",
            email: mail,
            rol: "profesor",
            creadoEn: serverTimestamp(),
            horario: null, // placeholder
            horarioConfig: {
              bloquesGenerados: [],
              marcas: [],
            },
            onboarding: {
              fase: "registro",
              ts: serverTimestamp(),
            },
          },
          { merge: true }
        );
        console.log("[Registro] Guardado en Firestore: usuarios/", user.uid);
      } catch (errDB) {
        console.warn("[Registro] setDoc usuarios falló:", errDB);
      }

      // Fallback opcional: profesores/{uid}
      try {
        await setDoc(
          doc(db, "profesores", user.uid),
          {
            nombre: display || user.displayName || "",
            email: mail,
            slogan: "",
            actualizadoEn: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e2) {
        console.warn("[Registro] setDoc profesores falló:", e2);
      }

      // Flags anti-rebote
      try {
        localStorage.setItem("uid", user.uid);
        localStorage.setItem("nombre", display || user.displayName || "");
        localStorage.setItem("email", mail);
        localStorage.setItem("justRegisteredAt", String(Date.now()));
        localStorage.setItem("skipRutaInicialOnce", "1");
        localStorage.setItem("forceHorarioOnce", "1");
      } catch {}

      setSuccess(true);
      setError("");
      console.log("[Registro] ✅ Registro completo, redirigiendo a /horario…");

      try {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      } catch {}

      nav("/horario", { replace: true, state: { from: "registro" } });

      setTimeout(() => {
        const now =
          window.location.pathname + window.location.hash + window.location.search;
        const isInHorario =
          now.startsWith("/horario") ||
          now.includes("#/horario") ||
          now.includes("#%2Fhorario");
        if (!isInHorario) {
          window.location.assign("/#/horario");
        }
      }, 450);
    } catch (err) {
      console.warn("[Registro] catch err:", err);
      const nice = msgFromFirebaseCode(err?.code);
      setError(nice || "No se pudo crear la cuenta. Inténtalo nuevamente.");
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
          />

          <label style={styles.label}>Correo electrónico</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            style={styles.input}
          />

          <label style={styles.label}>Contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            style={styles.input}
          />

          <label style={styles.label}>Repite la contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            placeholder="Confirma tu contraseña"
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}
          {success && (
            <div style={styles.success}>✅ Cuenta creada correctamente. Redirigiendo...</div>
          )}

          <button type="submit" disabled={loading} style={styles.btnPrimary}>
            {loading ? (isSlow ? "Creando… (puede tardar)" : "Creando…") : "Crear cuenta"}
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
  success: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0", // ← fix aquí
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 13,
  },
};












