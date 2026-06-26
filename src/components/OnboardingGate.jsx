// src/components/OnboardingGate.jsx

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function OnboardingGate({ usuario }) {
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const rutaActual = location.pathname;

    console.log("🔍 Ruta actual:", rutaActual);

    // 🚫 NO bloquear demo
    if (rutaActual === "/demo") return;

    // 🚫 NO bloquear registro
    if (rutaActual === "/registro") return;

    // 🚫 NO bloquear horario
    if (rutaActual === "/horario") return;

    // 🔥 SI NO TIENE HORARIO → obligar
    if (!usuario?.horario || usuario.horario.length === 0) {
      console.log("⚠️ Sin horario → redirigiendo");
      nav("/horario");
      return;
    }

    // 🔥 SI TODO OK → ir a clase
    console.log("✅ Todo listo → InicioClase");
    nav("/InicioClase");

  }, [usuario, nav, location]);

  return null;
}