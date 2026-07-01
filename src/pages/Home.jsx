// src/pages/Home.jsx
import React, { useEffect, useState, useMemo, useRef, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getClaseVigente } from "../services/PlanificadorService";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import AuthModal from "../components/AuthModal";
import { PlanContext } from "../context/PlanContext"; // ✅ NUEVO
import WorldPlatformIntro from "../home/WorldPlatformIntro";
import AutoClassShowcase from "../home/AutoClassShowcase";
import FutureClassDemo from "../components/home/FutureClassDemo";
import EcosystemPlatform from "../components/home/EcosystemPlatform";
import FourWorldsPlatform from "../components/home/FourWorldsPlatform";
import TransformationMessage from "../components/home/TransformationMessage";



const BACKEND_URL =
  (import.meta && import.meta.env && import.meta.env.VITE_BACKEND_URL)
    ? import.meta.env.VITE_BACKEND_URL
    : "https://crearpagoflowhttp-203232076035.us-central1.run.app";

const COLORS = {
  brandA: "#2193b0",
  brandB: "#6dd5ed",
  white: "#ffffff",
  textDark: "#0f172a",
  text: "#1f2937",
  muted: "#475569",
  border: "#e5e7eb",
  cardBg: "#ffffff",
};

const qs = new URLSearchParams(location.search || "");
const bypass =
  window.location.hostname === "localhost" || qs.get("bypass") === "1";

const page = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.brandA} 0%, ${COLORS.brandB} 100%)`,
  color: COLORS.white,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

const container = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "24px 16px 40px",
};

const card = {
  background: COLORS.cardBg,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(2,6,23,.08)",
};

const section = {
  ...card,
  padding: 16,
  marginTop: 16,
};

const h2 = { margin: "0 0 8px", fontSize: 22, color: COLORS.textDark };
const h3 = { margin: "0 0 6px", fontSize: 18, color: COLORS.textDark };
const pMuted = { color: COLORS.muted, margin: 0 };

const btnPrimary = {
  display: "inline-block",
  background: "#0ea5e9",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const btnGhost = {
  display: "inline-block",
  background: "#ffffff",
  color: "#0ea5e9",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #7dd3fc",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const grid = (min = 260) => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  gap: 12,
});

/* ───────────────── Header + hamburguesa ──────────────── */
const headerWrap = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
  background: "rgba(255,255,255,.92)",
  borderBottom: `1px solid ${COLORS.border}`,
  backdropFilter: "saturate(150%) blur(6px)",
};
const headerInner = {
  ...container,
  padding: "10px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const brand = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: COLORS.textDark,
  textDecoration: "none",
  fontWeight: 900,
};
const burgerBtn = {
  background: "#ffffff",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
};
const burgerBar = {
  width: 20,
  height: 2,
  background: "#0f172a",
  borderRadius: 999,
};
const menuPanel = {
  position: "absolute",
  right: 16,
  top: "100%",
  marginTop: 8,
  background: "#fff",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(2,6,23,.15)",
  minWidth: 220,
  overflow: "hidden",
};
const menuItem = {
  display: "block",
  padding: "10px 12px",
  textDecoration: "none",
  color: COLORS.text,
  fontWeight: 600,
  borderBottom: `1px solid ${COLORS.border}`,
};
const menuFooter = {
  padding: 10,
  display: "grid",
  gap: 8,
};

/* ───────────────── Splash ────────────── */
function Splash({ seconds = 5, onDone = () => {} }) {
  const [logoSrc, setLogoSrc] = useState(null);
  const candidates = ["/logo512.png", "/logo192.png", "/logo.svg"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of candidates) {
        if (cancelled) break;
        const ok = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = c + `?v=${Date.now()}`;
          return;
        });
        if (ok && !cancelled) {
          setLogoSrc(c);
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    try {
      document.body.style.overflow = "hidden";
    } catch (e) {}
    const t = setTimeout(() => {
      try {
        document.body.style.overflow = prevOverflow || "";
      } catch (e) {}
      onDone();
    }, seconds * 1000);
    return () => {
      clearTimeout(t);
      try {
        document.body.style.overflow = prevOverflow || "";
      } catch (e) {}
    };
  }, [seconds, onDone]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "linear-gradient(180deg,#ffffff, #e6f7fb)",
        }}
        aria-hidden={false}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{
            width: 260,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 12px 40px rgba(2,6,23,.12)",
            background: `linear-gradient(135deg,#2193b0,#6dd5ed)`,
            padding: 16,
          }}
        >
          {logoSrc ? (
            <motion.img
              src={logoSrc}
              alt="PragmaProfe"
              style={{
                maxWidth: "90%",
                maxHeight: 180,
                objectFit: "contain",
                transformOrigin: "center center",
                display: "block",
              }}
              initial={{ scale: 1, x: 0, rotate: 0, opacity: 0 }}
              animate={{
                x: [0, -6, 6, -4, 4, -2, 2, 0],
                y: [0, -3, 3, -2, 2, -1, 1, 0],
                rotate: [0, -3, 3, -2, 2, 0],
                scale: [1, 1.1, 1.02, 1.08, 0.98, 1.06, 1.01, 1],
                opacity: 1,
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : (
            <div
              style={{
                color: "#0f172a",
                fontWeight: 900,
                fontSize: 48,
                border: "1px dashed #94a3b8",
                padding: 4,
              }}
            >
              PragmaProfe
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{
            marginTop: 16,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: ".2px",
            color: "#0b1220",
            textAlign: "center",
          }}
          data-test="slogan-splash"
        >
          La plataforma de un profe para los profes
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────────────── HeroIntro ────────────── */
function HeroIntro() {
  const [animComplete, setAnimComplete] = useState(false);
  const [logoSrc, setLogoSrc] = useState(null);
  const candidates = ["/logo512.png", "/logo192.png", "/logo.svg"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of candidates) {
        if (cancelled) break;
        const ok = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = c + `?v=${Date.now()}`;
          return;
        });
        if (ok && !cancelled) {
          setLogoSrc(c);
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAnimComplete(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const logoVariants = {
    initial: { y: 0, scale: 0.9, rotate: -2, opacity: 0.9 },
    animate: {
      y: [0, -8, 0, 8, 0],
      scale: [1, 1.12, 1, 0.96, 1],
      rotate: [0, -3, 0, 3, 0],
      opacity: 1,
    },
    rest: { y: 0, scale: 1, rotate: 0, opacity: 1 },
  };
  const containerVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="hp-hero"
        initial="hidden"
        animate="show"
        variants={containerVariants}
        style={{
          margin: "18px 0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Intro PragmaProfe"
      >
        <motion.div
          className="hp-logo-wrap"
          variants={logoVariants}
          initial="initial"
          animate={animComplete ? "rest" : "animate"}
          transition={{
            duration: 1,
            ease: "easeInOut",
            repeat: animComplete ? 0 : Infinity,
          }}
          style={{
            width: 110,
            height: 110,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: `linear-gradient(135deg, ${COLORS.brandA}, ${COLORS.brandB})`,
            boxShadow: "0 6px 18px rgba(2,8,20,0.08)",
          }}
        >
          {logoSrc ? (
            <motion.img
              src={logoSrc}
              alt="PragmaProfe"
              style={{
                maxWidth: "68%",
                maxHeight: "68%",
                objectFit: "contain",
                borderRadius: 8,
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <div
              style={{
                color: "#fff",
                fontWeight: 900,
                fontSize: 28,
              }}
            >
              P
            </div>
          )}
        </motion.div>

        <motion.div
          className="hp-slogan"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 6,
            marginLeft: 14,
          }}
        >
          <motion.h3
            style={{
              margin: 0,
              fontSize: 20,
              color: "#07203a",
              fontWeight: 800,
            }}
          >
            La plataforma de un profe para los profes
          </motion.h3>

          <motion.p
            style={{ margin: 0, fontSize: 14, color: "#0b3a57" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: animComplete ? 1 : 0.9, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Convierte tus clases en experiencias activas e inolvidables.
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────────────── HintButton ────────────── */
function HintButton({
  as = "button",
  style = {},
  children,
  hint,
  disabled,
  onClick,
  to,
}) {
  const [show, setShow] = React.useState(false);

  const baseWrap = {
    position: "relative",
    display: "inline-block",
  };

  const bubble = {
    position: "absolute",
    zIndex: 9999,
    bottom: "100%",
    left: "50%",
    transform: "translateX(-50%) translateY(-8px)",
    background: "#0f172a",
    color: "#fff",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 500,
    padding: "8px 10px",
    borderRadius: 8,
    boxShadow: "0 12px 30px rgba(0,0,0,.4)",
    maxWidth: 220,
    textAlign: "center",
    pointerEvents: "none",
    whiteSpace: "normal",
  };

  const bubbleArrow = {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: "6px solid #0f172a",
  };

  const commonProps = {
    style,
    onClick,
    disabled,
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
  };

  const InnerEl =
    as === "link" ? (
      <Link
        to={to}
        style={{ ...style, textDecoration: "none" }}
        {...commonProps}
      >
        {children}
      </Link>
    ) : (
      <button type="button" {...commonProps} style={style}>
        {children}
      </button>
    );

  return (
    <div style={baseWrap}>
      {InnerEl}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={bubble}
          >
            {hint}
            <div style={bubbleArrow} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Helper para detectar idioma actual (es/en) */
function detectLanguage() {
  let lang = "es";
  try {
    const stored =
      localStorage.getItem("pragma_lang") ||
      localStorage.getItem("appLanguage") ||
      localStorage.getItem("language");

    if (stored === "en" || stored === "es") {
      lang = stored;
    } else {
      const navLang = (navigator.language || navigator.userLanguage || "es")
        .toLowerCase()
        .slice(0, 2);
      if (navLang === "en") lang = "en";
    }
  } catch (e) {
    // si algo falla, nos quedamos con "es"
  }
  return lang;
}

// 🔑 clave de storage para la Clase especial
const SPECIAL_CLASS_KEY = "pragma:specialClass";

/* ───────────────── MAIN COMPONENT ────────────── */
export default function Home() {
  const nav = useNavigate();
  const location = useLocation();

  // 👇 estas dos líneas son IMPORTANTES y deben ir DENTRO del componente
  const pathnameLower = (location.pathname || "").toLowerCase();
  const hideBurgerInHome = pathnameLower === "/home";

  const [claseVigente, setClaseVigente] = useState(null);
  const [loadingClase, setLoadingClase] = useState(true);

  const [splashDone, setSplashDone] = useState(false);

  // usuario Firebase
  const [user, setUser] = useState(() => auth?.currentUser || null);

  // modal auth / loaders
  const [authOpen, setAuthOpen] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSub, setLoadingSub] = useState(false);
  const [msg, setMsg] = useState("");

  // menú hamburguesa
  const [menuOpen, setMenuOpen] = useState(false);

  // tooltip / ayuda (no se usa, pero no se elimina)
  const [hoverHelp, setHoverHelp] = useState("");

  // 🔐 Para evitar spam de redirecciones
  const hasRedirectedRef = useRef(false);

  // 🔗 contexto de plan (para Clase especial)
  const planCtx = useContext(PlanContext); // ✅

  // 🧪 Modal para Clase especial
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialLanguage, setSpecialLanguage] = useState(() => detectLanguage() || "es");
  const [showSpecialForm, setShowSpecialForm] = useState(false);

  const [specialFormData, setSpecialFormData] = useState({
    teacherName: "",
    subject: "",
    modoEspecial: true,
    language: "en", // se actualizará con el idioma elegido
    unit: "",
    objective: "",
    skills: "",
  });

  // 🔎 Bloque legado (ahora reemplazado por launchSpecialClass)
  // Queda comentado para referencia, pero no se ejecuta ni rompe nada.
  /*
  const meta = {
    ...specialFormData,
    language: "en",
    modoEspecial: true,
  };
  // 1) Guardar en localStorage para que InicioClase lo lea si entra por URL
  localStorage.setItem("pragma:specialClassMeta", JSON.stringify(meta));
  // 2) Pasarlo también por state al navegar
  nav("/InicioClase?special=1&lang=en", {
    state: {
      from: "home-clase-especial",
      specialMeta: meta,
    },
  });
  */

  const updateSpecialField = (field, value) => {
    setSpecialFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  async function hardLocalLogout() {
    try {
      await signOut(auth);
      console.log("[hardLocalLogout] signOut(auth) OK");
    } catch (err) {
      console.warn("[hardLocalLogout] signOut error:", err);
    }

    try {
      indexedDB.deleteDatabase("firebaseLocalStorageDb");
      indexedDB.deleteDatabase("firebaseAuthLocalStorageDb");
      console.log("[hardLocalLogout] borré indexedDB firebase*");
    } catch (err) {
      console.warn("[hardLocalLogout] indexedDB cleanup error:", err);
    }

    try {
      localStorage.setItem("forceGuest", "1");
    } catch (err) {}

    try {
      sessionStorage.clear();
    } catch (err) {}

    setUser(null);
  }

  useEffect(() => {
    console.log("[Home] mounted ✓");
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log(
        "[AuthStateChanged] usuario detectado:",
        u ? u.email || u.uid : "NO AUTH"
      );
      setUser(u || null);
    });
    return () => unsub();
  }, []);

  // NO forzar logout automático si forceGuest
  useEffect(() => {
    let forcedGuest = false;
    try {
      forcedGuest = localStorage.getItem("forceGuest") === "1";
    } catch (e) {}
    if (forcedGuest) {
      console.log(
        "[Home] forceGuest=1 detectado, PERO ya NO forzamos hardLocalLogout automático."
      );
    }
  }, [user]);

  // Redirección automática a /InicioClase solo si eres profe real
  useEffect(() => {
    try {
      if (hasRedirectedRef.current) return;
      if (!user || user.isAnonymous) return;

      if (pathnameLower !== "/home") return;

      const fromState = location?.state?.from || "";
      const isAuthOrPagoFlow =
        fromState === "suscripcion" ||
        fromState === "auto-redirect-login" ||
        fromState === "menu-login-alreadyAuth";

      if (isAuthOrPagoFlow) return;

      const params = new URLSearchParams(location.search || "");
      const forced = params.get("force");

      let forcedGuest = false;
      try {
        forcedGuest = localStorage.getItem("forceGuest") === "1";
      } catch (err) {
        forcedGuest = false;
      }
      if (forced === "1" || forcedGuest) return;

      hasRedirectedRef.current = true;

      nav("/InicioClase", {
        replace: true,
        state: { from: "auto-redirect" },
      });
    } catch (err) {
      console.warn("[Home] auto-redirect ultra-blind error:", err);
    }
  }, [user, location, nav, pathnameLower]);

  // scroll suave
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  const goAnchor = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  // obtener clase vigente
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoadingClase(true);
        const res = await getClaseVigente(new Date());
        if (!cancel) setClaseVigente(res || null);
      } catch {
        if (!cancel) setClaseVigente(null);
      } finally {
        if (!cancel) setLoadingClase(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const claseText = useMemo(() => {
    if (!claseVigente) return null;
    const parts = [];
    if (claseVigente.unidad) {
      parts.push(
        `Unidad: ${claseVigente.unidad}${
          claseVigente.evaluacion ? " · (Evaluación)" : ""
        }`
      );
    }
    if (claseVigente.objetivo) {
      parts.push(`Objetivo: ${claseVigente.objetivo}`);
    }
    if (claseVigente.habilidades) {
      const hab = Array.isArray(claseVigente.habilidades)
        ? claseVigente.habilidades.join(", ")
        : claseVigente.habilidades;
      if (hab) parts.push(`Habilidades: ${hab}`);

      function HeaderMenu() {
        const navigate = useNavigate();

        const [loggedIn, setLoggedIn] = useState(false); // hay usuario firebase cargado
        const [isAnon, setIsAnon] = useState(true); // por defecto asumimos anónimo

        useEffect(() => {
          const unsub = onAuthStateChanged(auth, (u) => {
            if (!u) {
              // no hay user (tal vez todavía no terminó de crear anon)
              setLoggedIn(false);
              setIsAnon(true);
              return;
            }
            setLoggedIn(true);
            setIsAnon(!!u.isAnonymous);
          });
          return () => unsub();
        }, []);

        // cerrar sesión solo aplica si NO eres anónimo
        const handleLogout = async () => {
          try {
            await signOut(auth);
            // opcional: limpiar algunas cosas de profe
            localStorage.removeItem("uid");
            // mandar de vuelta al landing
            navigate("/home", { replace: true });
          } catch (e) {
            console.error("signOut error", e);
          }
        };

        return (
          <div className="tu-menu-ejemplo">
            {/* ...links comunes tipo Producto / Cómo funciona / etc... */}

            {loggedIn && !isAnon ? (
              <>
                <button onClick={() => navigate("/perfil")} className="btn">
                  Mi perfil
                </button>

                <button onClick={handleLogout} className="btn btn-secundario">
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="btn btn-primario"
                >
                  Iniciar sesión
                </button>
              </>
            )}
          </div>
        );
      }
    }

    const cursoBits = [];
    if (claseVigente.nivel)
      cursoBits.push(claseVigente.nivel.replace(/basico/gi, "básico"));
    if (claseVigente.seccion) cursoBits.push(claseVigente.seccion);
    if (cursoBits.length) parts.push(`Curso: ${cursoBits.join(" ")}`);
    if (claseVigente.asignatura)
      parts.push(`Asignatura: ${claseVigente.asignatura}`);
    return parts.join(" • ");
  }, [claseVigente]);

  const guard = (setter) => (fn) => async (...args) => {
    setter(true);
    try {
      await fn(...args);
    } finally {
      setter(false);
    }
  };

  const goLogin = guard(setLoadingLogin)(async (e) => {
    try {
      if (e) e.preventDefault();
    } catch {}
    setMsg("");

    const inCommercialFlow =
      pathnameLower.startsWith("/pago") ||
      pathnameLower.startsWith("/planes") ||
      pathnameLower.startsWith("/login");

    if (user && !user.isAnonymous) {
      if (!inCommercialFlow) {
        nav("/InicioClase", {
          replace: true,
          state: { from: "menu-login-alreadyAuth" },
        });
      }
      return;
    }

    setAuthOpen(true);

    setTimeout(() => {
      try {
        nav("/login?force=1", {
          state: { from: "auto-redirect-login" },
        });
      } catch {
        window.location.assign("/login?force=1");
      }
    }, 120);
  });

  const goInicioClaseNow = (payload = {}) => {
    nav("/InicioClase", {
      replace: true,
      state: { from: "home", autostart: true, ...payload },
    });
  };

  useEffect(() => {
    try {
      const st = location?.state || {};
      const qp = new URLSearchParams(location?.search || "");
      const wantsAutostart =
        st?.autostart === true ||
        st?.tryStart === "inicioClase" ||
        qp.get("autostart") === "1";

      if (wantsAutostart) {
        setSplashDone(true);
        const payload = {};
        if (st?.slot) payload.slot = st.slot;
        if (st?.label) payload.label = st.label;
        goInicioClaseNow(payload);
      }
    } catch {}
  }, [location?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const goSuscribir = guard(setLoadingSub)(async (e) => {
    try {
      if (e) e.preventDefault();
    } catch {}
    nav("/pago", { state: { from: "suscripcion" } });
  });

  async function crearPago(plan) {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) {
      setAuthOpen(true);
      setMsg("Primero inicia sesión para asociar tu suscripción.");
      try {
        nav("/login?next=/pago", { state: { from: "auto-redirect-login" } });
      } catch {
        window.location.assign("/login?next=/pago");
      }
      return null;
    }
    try {
      const resp = await fetch(`${BACKEND_URL}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          email: u.email || "test@flow.cl",
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.url) {
        throw new Error(
          data?.detalle?.message ||
            data?.error ||
            "No se pudo crear el pago."
        );
      }
      return data.url;
    } catch (err) {
      console.warn("[Home] crearPago error:", err);
      setMsg(err?.message || "No se pudo iniciar el pago.");
      return null;
    }
  }

  const suscribirsePlan = guard(setLoadingSub)(async (plan) => {
    setMsg("");
    const url = await crearPago(plan);
    if (url) window.location.assign(url);
  });

  const doSignOut = async () => {
    console.log("[doSignOut] >>> click cerrar sesión");
    await hardLocalLogout();
    try {
      window.location.replace("/#/home?force=1");
      console.log("[doSignOut] replace -> /#/home?force=1");
    } catch (err) {
      console.warn("[doSignOut] redirect error:", err);
    }
  };

  // ⚙️ Handler para abrir el modal de "Clase especial"
  const handleClaseEspecialClick = () => {
    const currentLanguage = detectLanguage();
    setSpecialLanguage(currentLanguage === "en" ? "en" : "es");
    setShowSpecialModal(true);
  };

  // ✅ Guardar idioma y abrir formulario
  const confirmSpecialClass = () => {
    const chosenLanguage = specialLanguage || detectLanguage() || "es";

    try {
      localStorage.setItem("pragma_lang", chosenLanguage);
      const payload = {
        modoEspecial: true,
        language: chosenLanguage,
        createdAt: Date.now(),
      };
      localStorage.setItem(SPECIAL_CLASS_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("[Home] no se pudo guardar Clase especial en storage:", e);
    }

    // cerramos modal idioma y abrimos formulario de datos
    setShowSpecialModal(false);
    setShowSpecialForm(true);
  };

  // ✅ Lanzar realmente la clase especial con los datos del formulario
  const launchSpecialClass = () => {
    const chosenLanguage = specialLanguage || detectLanguage() || "es";

    // Plan base
    let planEspecialBase =
      chosenLanguage === "en"
        ? {
            asignatura: "Mathematics",
            eje: "Algebra and Functions",
            unidad: "Special Class: Quadratic Functions",
            objetivo:
              "Understand and apply quadratic functions in real-life contexts.",
            habilidades: ["Analyze", "Model", "Reason", "Communicate"],
          }
        : {
            asignatura: "Matemática",
            eje: "Álgebra y funciones",
            unidad: "Clase especial: Funciones cuadráticas",
            objetivo:
              "Comprender y aplicar funciones cuadráticas en contextos reales.",
            habilidades: ["Analizar", "Modelar", "Razonar", "Comunicar"],
          };

    // Overrides desde formulario
    const subj = specialFormData.subject?.trim();
    const unit = specialFormData.unit?.trim();
    const objective = specialFormData.objective?.trim();
    const skillsArray = specialFormData.skills
      ? specialFormData.skills
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const overrides = {};
    if (subj) overrides.asignatura = subj;
    if (unit) overrides.unidad = unit;
    if (objective) overrides.objetivo = objective;
    if (skillsArray && skillsArray.length) overrides.habilidades = skillsArray;
    if (specialFormData.teacherName)
      overrides.profesor = specialFormData.teacherName;

    // Contexto global de plan
    if (planCtx) {
      const { setPlan, setModoEspecial, setLanguage } = planCtx;

      if (typeof setLanguage === "function") {
        setLanguage(chosenLanguage);
      }

      if (typeof setModoEspecial === "function") {
        setModoEspecial(true);
      }

      if (typeof setPlan === "function") {
        setPlan((prev) => ({
          ...(prev && typeof prev === "object" ? prev : {}),
          ...planEspecialBase,
          ...overrides,
          esEspecial: true,
          language: chosenLanguage,
        }));
      }
    }

    // Guardar meta en localStorage para que InicioClase lo recupere si hace falta
    try {
      const meta = {
        ...specialFormData,
        language: chosenLanguage,
        modoEspecial: true,
        createdAt: Date.now(),
      };
      localStorage.setItem("pragma:specialClassMeta", JSON.stringify(meta));
    } catch (e) {
      console.warn("[Home] no se pudo guardar specialClassMeta:", e);
    }

    const url = `/InicioClase?special=1&lang=${encodeURIComponent(
      chosenLanguage
    )}`;

    try {
      nav(url, {
        state: {
          from: "home-clase-especial",
          modoEspecial: true,
          language: chosenLanguage,
          special: true,
          specialMeta: { ...specialFormData },
        },
      });
    } catch (err) {
      window.location.assign(url);
    } finally {
      setShowSpecialForm(false);
    }
  };

  // 👇 footer del menú hamburguesa
  const renderMenuFooter = () => {
    // si estoy en /home => FORZAR versión pública SIEMPRE
    if (hideBurgerInHome) {
      return (
        <Link
          to="/login?force=1"
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(false);
            try {
              localStorage.removeItem("forceGuest");
              console.log("[Iniciar sesión link] forceGuest removed");
            } catch {}
            goLogin(e);
          }}
          style={{
            ...btnGhost,
            textAlign: "center",
            opacity: loadingLogin ? 0.7 : 1,
          }}
        >
          {loadingLogin ? "Abriendo…" : "Iniciar sesión"}
        </Link>
      );
    }

    // lógica normal para pantallas internas:
    let forcedGuest = false;
    try {
      forcedGuest = localStorage.getItem("forceGuest") === "1";
    } catch (err) {
      forcedGuest = false;
    }

    const uid = user?.uid || null;
    const email = user?.email || "";
    const isAnon = !!user?.isAnonymous;
    const loggedInReal = !!uid && !!email && !isAnon;

    const isTeacherContext = [
      "/inicio",
      "/inicioclase",
      "/desarrollo",
      "/cierre",
      "/planificaciones",
      "/perfil",
      "/horario",
    ].some((p) => pathnameLower.startsWith(p));

    const canShowProfileAndLogout =
      loggedInReal && !forcedGuest && isTeacherContext;

    if (canShowProfileAndLogout) {
      return (
        <>
          <Link
            to="/perfil"
            onClick={() => setMenuOpen(false)}
            style={{ ...btnGhost, textAlign: "center" }}
          >
            Mi perfil
          </Link>

          <button
            onClick={() => {
              setMenuOpen(false);
              doSignOut();
            }}
            style={{ ...btnGhost }}
          >
            Cerrar sesión
          </button>
        </>
      );
    }

    return (
      <Link
        to="/login?force=1"
        onClick={(e) => {
          e.preventDefault();
          setMenuOpen(false);
          try {
            localStorage.removeItem("forceGuest");
            console.log("[Iniciar sesión link] forceGuest removed");
          } catch {}
          goLogin(e);
        }}
        style={{
          ...btnGhost,
          textAlign: "center",
          opacity: loadingLogin ? 0.7 : 1,
        }}
      >
        {loadingLogin ? "Abriendo…" : "Iniciar sesión"}
      </Link>
    );
  };

  return (
    <div style={page}>
      {!splashDone && (
        <Splash seconds={5} onDone={() => setSplashDone(true)} />
      )}

      {/* Header */}
      <div style={headerWrap}>
        <div style={{ ...headerInner, position: "relative" }}>
          <Link to="/home" style={brand} aria-label="PragmaProfe Home">
            <img
              src="/logo512.png"
              alt="PragmaProfe"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                objectFit: "cover",
                background: `linear-gradient(135deg, ${COLORS.brandA}, ${COLORS.brandB})`,
              }}
              onError={(e) => {
                try {
                  if (
                    e &&
                    e.target &&
                    typeof e.target.src === "string" &&
                    e.target.src.endsWith("/logo512.png")
                  ) {
                    e.target.src = "/logo192.png";
                  } else if (
                    e &&
                    e.target &&
                    typeof e.target.src === "string" &&
                    e.target.src.endsWith("/logo192.png")
                  ) {
                    e.target.style.display = "none";
                  }
                } catch {}
              }}
            />
            <span>PragmaProfe</span>
          </Link>

          {/* Menú hamburguesa (oculto en /home si así lo pedimos) */}
          {!hideBurgerInHome && (
            <>
              <button
                aria-label="Abrir menú"
                style={burgerBtn}
                onClick={() => setMenuOpen((s) => !s)}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={burgerBar} />
                  <span style={burgerBar} />
                  <span style={burgerBar} />
                </div>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={menuPanel}
                  >
                    <button
                      style={{
                        ...menuItem,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        width: "100%",
                      }}
                      onClick={() => goAnchor("producto")}
                    >
                      Producto
                    </button>

                    <button
                      style={{
                        ...menuItem,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        width: "100%",
                      }}
                      onClick={() => goAnchor("como-funciona")}
                    >
                      Cómo funciona
                    </button>

                    <button
                      style={{
                        ...menuItem,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        width: "100%",
                      }}
                      onClick={() => goAnchor("docentes")}
                    >
                      Para docentes
                    </button>

                    <button
                      style={{
                        ...menuItem,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        width: "100%",
                      }}
                      onClick={() => goAnchor("faq")}
                    >
                      FAQ
                    </button>

                    <button
                      style={{
                        ...menuItem,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        width: "100%",
                      }}
                      onClick={() => goAnchor("soporte")}
                    >
                      Soporte
                    </button>

                    <div style={menuFooter}>{renderMenuFooter()}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <div style={container}>
        <HeroIntro />
         <WorldPlatformIntro />
         <FutureClassDemo />
         <TransformationMessage />
         <EcosystemPlatform />
         <FourWorldsPlatform />
        {/* Cómo funciona */}
        <div id="como-funciona" style={{ ...section }}>
          <h2 style={h2}>Un día con PragmaProfe</h2>
          <div style={grid()}>
            <StepCard
              step="07.55"
              title="Llegas al Colegio"
              text="La clase ya está abierta"
            />
            <StepCard
              step="08:00"
              title="La IA detecta"
              text="Curso, Asignatura, OA, Unidad, Contenido específico"
            />
            <StepCard
              step="08:03"
              title="Los alumnos escanean el QR"
              text="
██████████████

32 estudiantes conectados"
            />
            <StepCard
              step="08:05"
              title="Empieza una nube de palabras"
              text="██████████

━━━━━━━━━━━━━━━━━━━━━━"
            />
            <StepCard
              step="08:15"
              title="Comienza Gincana Nexus"
              text="Juego de Aventura con estaciones y emociones"
            />
            <StepCard
              step="08:35"
              title="Gincana Nexus da las calificaciones del juego"
              text="Tienes registros evaluativos de la clase"
            />
          </div>
        </div>
        {/* Eslogan bajo Hero */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <div
            style={{
              color: "#0b1220",
              fontWeight: 900,
              fontSize: 28,
            }}
            data-test="slogan-under-hero"
          >
          </div>
        </div>

        {/* HERO / Producto */}
        <div
          id="producto"
          style={{
            ...card,
            background: "rgba(255,255,255,.92)",
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 16,
          }}
        >
          {/* Video */}
          <div
            style={{
              background: "#000",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                paddingTop: "56.25%",
              }}
            >
              <iframe
                title="Video introductorio"
                src="https://www.youtube.com/embed/5RzhipypTFA"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </div>
            <div style={{ padding: 8, background: "#fff" }}>
              <small style={{ ...pMuted }}>
                Vídeo explicativo (1:08) — qué es PragmaProfe y cómo acelera tu
                clase.
              </small>
            </div>
          </div>

          {/* Texto + CTAs */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <h1 style={{ margin: 0, color: COLORS.textDark }}>
              Planifica, dinamiza y evalúa tu clase en minutos.
            </h1>

            <p style={{ ...pMuted, fontSize: 16 }}>
              PragmaProfe alinea objetivos al currículo, activa a tus
              estudiantes con QR, nubes de palabras y carreras, y cierra con
              evidencias… sin complicarte.
            </p>
           
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

  {/* BOTÓN PRINCIPAL */}
  <HintButton
    as="button"
    style={{
      ...btnPrimary,
      background: "linear-gradient(90deg,#0ea5e9,#0284c7)",
    }}
    hint="Comienza inmediatamente con PragmaProfe y descubre cómo preparar una clase completa en minutos."
    onClick={() => nav("/registro")}
  >
    🎁 Comenzar ahora
  </HintButton>

  {/* VIDEO */}
  <HintButton
    as="button"
    style={{
      ...btnPrimary,
      background: "linear-gradient(90deg,#22c55e,#16a34a)",
    }}
    hint="Observa una demostración real de una clase preparada automáticamente con PragmaProfe."
    onClick={() => {
      const video = document.querySelector("iframe");
      if (video) {
        video.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }}
  >
    ▶️ Ver clase en acción
  </HintButton>

  {/* EXPLORAR */}
  <HintButton
    as="button"
    style={btnGhost}
    hint="Recorre todas las funciones de PragmaProfe y descubre cómo trabaja todo el ecosistema."
    onClick={() => {
      const seccion = document.getElementById("producto");
      if (seccion) {
        seccion.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        window.scrollTo({
          top: window.innerHeight,
          behavior: "smooth",
        });
      }
    }}
  >
    📖 Explorar PragmaProfe
  </HintButton>

</div>

            {hoverHelp && (
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  color: "#0c4a6e",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 500,
                  maxWidth: "28rem",
                }}
              >
                {hoverHelp}
              </div>
            )}

            {msg ? (
              <div
                style={{
                  marginTop: 8,
                  color: "#b45309",
                  fontWeight: 600,
                }}
              >
                ⚠️ {msg}
              </div>
            ) : null}

            {/* Currículo actual */}
            <div style={{ ...section, marginTop: 12 }}>
              <h3 style={h3}>📚 Currículo de la clase actual</h3>
              {loadingClase ? (
                <div style={pMuted}>Detectando clase vigente…</div>
              ) : claseText ? (
                <div>{claseText}</div>
              ) : (
                <div style={pMuted}>No se detectó clase vigente ahora.</div>
              )}
            </div>

            {/* Aviso si vienes desde Horario */}
            {location?.state?.from === "horario" && (
              <div
                style={{
                  ...section,
                  borderStyle: "dashed",
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ ...h3, marginBottom: 4 }}>✅ Horario guardado</h3>
                <p style={{ ...pMuted, marginBottom: 8 }}>
                  ¿Deseas iniciar la clase ahora mismo?
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      goInicioClaseNow({
                        slot: location.state?.slot,
                        label: location.state?.label,
                      })
                    }
                    style={btnPrimary}
                  >
                    Ir a Inicio de Clase
                  </button>

                  <button
                    type="button"
                    onClick={() => nav("/planificaciones")}
                    style={btnGhost}
                  >
                    Ver planificaciones
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contacto / Soporte */}
        <div id="soporte" style={{ ...section }}>
          <h2 style={h3}>Contacto</h2>
          <p style={pMuted}>
            ¿Tienes dudas o quieres implementar PragmaProfe en tu escuela?
          </p>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <a
              href="mailto:contactocolegios@pragmaprofe.com"
              style={{
                color: "#0ea5e9",
                textDecoration: "none",
              }}
            >
              administracion@pragmaprofe.com
            </a>
            <span>·</span>
          </div>
        </div>

        {/* Footer legal */}
        <div
          style={{
            textAlign: "center",
            marginTop: 18,
            opacity: 0.9,
          }}
        >
          <small>
            © 2025 PragmaProfe ·{" "}
            <Link
              to="/terminos"
              style={{
                color: "#0ea5e9",
                textDecoration: "none",
              }}
            >
              Términos
            </Link>{" "}
            ·{" "}
            <Link
              to="/privacidad"
              style={{
                color: "#0ea5e9",
                textDecoration: "none",
              }}
            >
              Privacidad
            </Link>{" "}
            ·{" "}
            <Link
              to="/status"
              style={{
                color: "#0ea5e9",
                textDecoration: "none",
              }}
            >
              Estado del servicio
            </Link>
          </small>
        </div>
      </div>

      {/* Banner fijo (puede quedarse vacío) */}
      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 100000,
          background: "#111827",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.35)",
          fontWeight: 800,
          fontSize: 16,
        }}
        data-test="slogan-banner"
      ></div>

      {/* 🧪 Modal para elegir idioma de Clase especial */}
      {showSpecialModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200000,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 360,
              width: "90%",
              padding: 20,
              boxShadow: "0 18px 45px rgba(15,23,42,0.35)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.textDark,
              }}
            >
              Special Class / Clase especial
            </h2>
            <p
              style={{
                ...pMuted,
                marginBottom: 12,
                fontSize: 14,
              }}
            >
              Choose the language for this special class.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setSpecialLanguage("es")}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border:
                    specialLanguage === "es"
                      ? "2px solid #0ea5e9"
                      : "1px solid #e5e7eb",
                  background:
                    specialLanguage === "es" ? "#f0f9ff" : "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Español
              </button>
              <button
                type="button"
                onClick={() => setSpecialLanguage("en")}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border:
                    specialLanguage === "en"
                      ? "2px solid #0ea5e9"
                      : "1px solid #e5e7eb",
                  background:
                    specialLanguage === "en" ? "#f0f9ff" : "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                English
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowSpecialModal(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSpecialClass}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(90deg,#2193b0,#6dd5ed)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Start special class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 Modal para datos de la Clase especial */}
      {showSpecialForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200001,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 480,
              width: "95%",
              padding: 20,
              boxShadow: "0 18px 45px rgba(15,23,42,0.35)",
            }}
          >
            {specialLanguage === "en" ? (
              <>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 8,
                    fontSize: 20,
                    fontWeight: 800,
                    color: COLORS.textDark,
                  }}
                >
                  Configure your special class
                </h2>
                <p style={{ ...pMuted, marginBottom: 12, fontSize: 14 }}>
                  These details will appear in <strong>InicioClase</strong> in
                  English (Unit, Objective, Skills, etc.).
                </p>
              </>
            ) : (
              <>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 8,
                    fontSize: 20,
                    fontWeight: 800,
                    color: COLORS.textDark,
                  }}
                >
                  Configura tu clase especial
                </h2>
                <p style={{ ...pMuted, marginBottom: 12, fontSize: 14 }}>
                  Estos datos aparecerán en <strong>InicioClase</strong> (Unidad,
                  Objetivo, Habilidades, etc.).
                </p>
              </>
            )}

            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {/* Nombre profesor */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {specialLanguage === "en"
                    ? "Teacher name"
                    : "Nombre del profesor"}
                </label>
                <input
                  type="text"
                  value={specialFormData.teacherName}
                  onChange={(e) =>
                    updateSpecialField("teacherName", e.target.value)
                  }
                  placeholder={
                    specialLanguage === "en"
                      ? "e.g. Professor Freddy Contreras"
                      : "Ej: Profesor Freddy Contreras"
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Asignatura */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {specialLanguage === "en" ? "Subject" : "Asignatura"}
                </label>
                <input
                  type="text"
                  value={specialFormData.subject}
                  onChange={(e) =>
                    updateSpecialField("subject", e.target.value)
                  }
                  placeholder={
                    specialLanguage === "en"
                      ? "e.g. Mathematics"
                      : "Ej: Matemática"
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Unidad */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {specialLanguage === "en" ? "Unit" : "Unidad"}
                </label>
                <input
                  type="text"
                  value={specialFormData.unit}
                  onChange={(e) => updateSpecialField("unit", e.target.value)}
                  placeholder={
                    specialLanguage === "en"
                      ? "e.g. Numbers and operations"
                      : "Ej: Números y operaciones"
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Objetivo */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {specialLanguage === "en"
                    ? "Objective"
                    : "Objetivo de la clase"}
                </label>
                <textarea
                  value={specialFormData.objective}
                  onChange={(e) =>
                    updateSpecialField("objective", e.target.value)
                  }
                  rows={3}
                  placeholder={
                    specialLanguage === "en"
                      ? "Describe the learning objective for this special class..."
                      : "Describe el objetivo de aprendizaje de esta clase especial..."
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Habilidades */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {specialLanguage === "en"
                    ? "Skills (comma separated)"
                    : "Habilidades (separadas por comas)"}
                </label>
                <input
                  type="text"
                  value={specialFormData.skills}
                  onChange={(e) =>
                    updateSpecialField("skills", e.target.value)
                  }
                  placeholder={
                    specialLanguage === "en"
                      ? "e.g. Analyze, Reason, Communicate"
                      : "Ej: Analizar, Razonar, Comunicar"
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setShowSpecialForm(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {specialLanguage === "en" ? "Back" : "Volver"}
              </button>
              <button
                type="button"
                onClick={launchSpecialClass}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(90deg,#22c55e,#16a34a)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {specialLanguage === "en"
                  ? "Start class with these details"
                  : "Iniciar clase con estos datos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de autenticación */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          setMsg("Sesión iniciada. Ahora puedes suscribirte.");
        }}
      />
    </div>
  );
}

/* ───────────────── Subcomponentes simples ────────────── */
function FeatureCard({ title, text }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div
        style={{
          fontWeight: 800,
          marginBottom: 4,
          color: COLORS.textDark,
        }}
      >
        {title}
      </div>
      <div style={pMuted}>{text}</div>
    </div>
  );
}

function StepCard({ step, title, text }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div
        style={{
          fontWeight: 800,
          color: "#0369a1",
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontWeight: 800,
          margin: "2px 0 4px",
          color: COLORS.textDark,
        }}
      >
        {title}
      </div>
      <div style={pMuted}>{text}</div>
    </div>
  );
}

function FAQ({ q, a }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div
        style={{
          fontWeight: 800,
          marginBottom: 4,
          color: COLORS.textDark,
        }}
      >
        {q}
      </div>
      <div style={pMuted}>{a}</div>
    </div>
  );
}







