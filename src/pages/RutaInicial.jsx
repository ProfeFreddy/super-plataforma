// src/pages/RutaInicial.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import Home from "./Home";

/*
  RutaInicial (ruta "/"):
  - Usuario SIN sesión real (sin login con correo):
      -> mostrar <Home /> (landing pública)
      -> aunque exista sesión anónima de Firebase, NO redirigimos
         porque es alguien probando / evaluando.

  - Usuario YA autenticado "de verdad" (no anónimo):
      -> redirigir a /InicioClase automáticamente.

  Esto evita que la página raíz te "secuestren"
  directo al flujo docente solo porque existe
  una sesión anónima previa.
*/

export default function RutaInicial() {
  const navigate = useNavigate();

  const [checkedAuth, setCheckedAuth] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState({
    hasUser: false,
    isAnon: false,
  });

  React.useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!alive) return;

      if (u) {
        setUserInfo({
          hasUser: true,
          isAnon: !!u.isAnonymous,
        });
      } else {
        setUserInfo({
          hasUser: false,
          isAnon: false,
        });
      }
      setCheckedAuth(true);
    });

    return () => {
      alive = false;
      unsub && unsub();
    };
  }, []);

  // Redirección automática SOLO si:
  // - hay usuario
  // - y NO es anónimo
  React.useEffect(() => {
    if (!checkedAuth) return;
    if (userInfo.hasUser && !userInfo.isAnon) {
      navigate("/InicioClase", { replace: true });
    }
  }, [checkedAuth, userInfo, navigate]);

  // Render:
  // Caso 1: Usuario logeado normal -> tal vez ya estamos navegando.
  //         Para ese cuadro negro rápido mostramos mensajito suave.
  if (userInfo.hasUser && !userInfo.isAnon) {
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

  // Caso 2: visitante nuevo O usuario anónimo de prueba gratis
  // -> mostramos Home, que es la landing/marketing
  return <Home />;
}





