import React, { useEffect, useState } from "react";
import "./HomeHero.css"; // asegúrate de importar el CSS
// Reemplaza la ruta del logo por la que uses en tu proyecto
import logoSrc from "../assets/logo.png";

export default function HomeHero({ className = "" }) {
  const [animating, setAnimating] = useState(true);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    // Duración total de la animación: 5s
    const t = setTimeout(() => {
      setAnimating(false);
      // deja un pequeño delay para el fade-in del tagline
      setTimeout(() => setShowTagline(true), 250);
    }, 5000);

    return () => clearTimeout(t);
  }, []);

  return (
    <section className={`home-hero ${className}`}>
      <div className="hero-inner">
        <div
          className={`logo-wrap ${animating ? "logo-anim" : "logo-rest"}`}
          aria-hidden={animating ? "false" : "true"}
        >
          <img src={logoSrc} alt="Logo" className="logo-img" />
        </div>

        <div className="slogan-wrap">
          <h1 className={`slogan ${animating ? "slogan-anim" : "slogan-rest"}`}>
            Aprende, cobra, crece
          </h1>

          <p
            className={`tagline ${
              showTagline ? "tagline-visible" : "tagline-hidden"
            }`}
            aria-live="polite"
          >
            La plataforma de profes para profes
          </p>
        </div>
      </div>
    </section>
  );
}
