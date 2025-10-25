// src/pages/RutaInicial.jsx
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// 🔹 Si ya tienes estos helpers, úsalos.
//     Si no, igual navega a /home como fallback.
import { getClaseVigente } from "../services/PlanificadorService";
import { auth } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

export default function RutaInicial() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 🚫 Seguridad: este componente SOLO decide al entrar a "/"
    if (location.pathname !== "/") return;

    let unsub = () => {};

    const ensureAuthAndRoute = async (user) => {
      try {
        // 🔐 Asegura sesión anónima
        const u = user || (await signInAnonymously(auth)).user;

        // ✅ Intenta detectar clase activa (si tienes el servicio)
        if (typeof getClaseVigente === "function") {
          const clase = await getClaseVigente(u?.uid);
          if (clase) {
            navigate("/InicioClase", { replace: true });
            return;
          }
          // Sin clase activa
          navigate("/proximas-clases", { replace: true });
          return;
        }

        // 🟡 Si no tienes getClaseVigente aún, manda a Home
        navigate("/home", { replace: true });
      } catch (e) {
        // Fallback robusto
        navigate("/home", { replace: true });
      }
    };

    unsub = onAuthStateChanged(auth, (user) => {
      ensureAuthAndRoute(user);
    });

    return () => unsub();
  }, [location.pathname, navigate]);

  // Nada visual: es una ruta “puente”
  return null;
}
