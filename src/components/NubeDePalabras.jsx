// src/components/NubeDePalabras.jsx
import React, { useMemo } from "react";
import WordCloud from "react-d3-cloud";

/**
 * Nube de palabras “estilo Mentimeter”
 * - Colores vivos y diferenciados por frecuencia
 * - Tamaño proporcional (log)
 * - Rotaciones suaves (-30 a +30)
 * - Animación de aparición
 * - Hover con foco
 *
 * Props:
 *  - items: Array<{ text: string, value: number }>
 *  - palette: "menti" | "pastel" | "warm" | "cool"
 *  - minFont: number (px)
 *  - maxFont: number (px)
 *  - animate: boolean
 *  - darkBg: boolean (si el fondo es oscuro)
 */
export default function NubeDePalabras({
  items = [],
  palette = "menti",
  minFont = 18,
  maxFont = 78,
  animate = true,
  darkBg = false,
}) {
  // Normaliza/filtra (por si llegan duplicados o vacíos)
  const data = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      const k = String(r.text || "").trim();
      if (!k) continue;
      const v = Number(r.value || 0);
      map.set(k, (map.get(k) || 0) + (isFinite(v) ? v : 0));
    }
    return Array.from(map, ([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 120); // límite razonable
  }, [items]);

  // Paletas “estilo menti”
  const palettes = {
    menti: [
      "#1abc9c", "#2ecc71", "#3498db", "#9b59b6",
      "#e67e22", "#e74c3c", "#16a085", "#27ae60",
      "#2980b9", "#8e44ad", "#f39c12", "#c0392b",
      "#7f8c8d", "#2c3e50", "#d35400", "#f1c40f",
    ],
    pastel: [
      "#A3E4D7", "#AED6F1", "#D2B4DE", "#F9E79F",
      "#F5CBA7", "#F1948A", "#A9DFBF", "#85C1E9",
    ],
    warm: ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#dc2626"],
    cool: ["#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#14b8a6"],
  };

  // Escalas rápidas
  const min = data.length ? Math.min(...data.map(d => d.value)) : 0;
  const max = data.length ? Math.max(...data.map(d => d.value)) : 1;

  const sizeScale = (val) => {
    // escala log para diferenciar sin aplastar los chicos
    const v = Math.max(1, val - min + 1);
    const log = Math.log10(v) / Math.log10(Math.max(10, max - min + 1));
    return Math.round(minFont + (maxFont - minFont) * log);
  };

  const colors = palettes[palette] || palettes.menti;
  const colorFor = (val, i) => {
    if (max === min) return colors[i % colors.length];
    // rank por cuantiles
    const q = (val - min) / (max - min);
    const idx = Math.floor(q * (colors.length - 1));
    return colors[Math.max(0, Math.min(idx, colors.length - 1))];
  };

  const rotate = () => {
    // leve y legible
    const choices = [-30, -15, 0, 15, 30];
    return choices[Math.floor(Math.random() * choices.length)];
  };

  const font = "Inter, system-ui, Segoe UI, Roboto, sans-serif";

  const cloudData = data.map((d, i) => ({
    ...d,
    text: d.text,
    value: sizeScale(d.value),
    color: colorFor(d.value, i),
    rotate: rotate(),
  }));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 280,
        position: "relative",
        padding: 8,
        borderRadius: 12,
        background: darkBg ? "rgba(255,255,255,.04)" : "#fff",
        boxShadow: darkBg
          ? "inset 0 0 0 1px rgba(255,255,255,.06)"
          : "0 6px 18px rgba(16,24,40,.06), 0 2px 6px rgba(16,24,40,.03)",
      }}
    >
      <WordCloud
        data={cloudData}
        font={font}
        fontSize={(w) => w.value}
        rotate={(w) => w.rotate}
        padding={2}
        spiral="archimedean"
        height={320}
        width={520}
        random={(a) => a} // estable
        onWordMouseOver={(e, d) => {
          const el = e?.target;
          if (el && el.style) {
            el.style.filter = "drop-shadow(0 1px 6px rgba(0,0,0,.25))";
            el.style.opacity = "0.95";
            el.style.cursor = "pointer";
          }
        }}
        onWordMouseOut={(e) => {
          const el = e?.target;
          if (el && el.style) {
            el.style.filter = "none";
            el.style.opacity = "1";
            el.style.cursor = "default";
          }
        }}
        // @ts-ignore: lib no tipa fill
        fill={(w, i) => w.color}
        transitionDuration={animate ? 800 : 0}
      />
      {/* mini leyenda opcional */}
      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          fontSize: 11,
          opacity: 0.7,
          userSelect: "none",
        }}
      >
        {data.length ? "Tamaño = frecuencia" : "Sin palabras aún"}
      </div>
    </div>
  );
}


