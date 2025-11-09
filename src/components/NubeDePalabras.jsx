import React, { useEffect, useMemo, useRef, useState } from "react";
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
 *
 * Extras opcionales:
 *  - salaCode?: string      → compat: escucha RTDB legacy en salas/{code}/palabras
 *  - roomCode?: string      → NUEVO: escucha RTDB en rooms/{code}/words (estándar)
 *  - rtdbPath?: string      → sobreescribe la ruta completa
 *  - maxItems?: number      → límite de palabras a mostrar (default 120)
 *  - maxWordLength?: number → recorte por palabra (default 28)
 *  - allowNumbers?: boolean → si false, filtra palabras numéricas (default true)
 *  - lowercase?: boolean    → normaliza a minúsculas (default true)
 */

export default function NubeDePalabras({
  items = [],
  palette = "menti",
  minFont = 18,
  maxFont = 78,
  animate = true,
  darkBg = false,

  // extras
  salaCode,         // legacy
  roomCode,         // preferido
  rtdbPath,
  maxItems = 120,
  maxWordLength = 28,
  allowNumbers = true,
  lowercase = true,
}) {
  // =========================
  // Estado: datos desde RTDB
  // =========================
  const [liveItems, setLiveItems] = useState([]);

  // Suscripción RTDB (doble: estándar y legacy) sin romper props.items
  useEffect(() => {
    let cleanups = [];
    (async () => {
      try {
        if (!roomCode && !salaCode && !rtdbPath) return;

        // import dinámico: no rompe si no existe rtdb
        const mod = await import("../firebase").catch(() => null);
        if (!mod || !mod.rtdb) return;

        const { rtdb } = mod;
        const { ref, onValue, off } = await import("firebase/database");

        // 1) Path explícito siempre gana
        const paths = [];
        if (rtdbPath) {
          paths.push(rtdbPath);
        } else {
          // 2) Estándar → rooms/{code}/words
          if (roomCode) paths.push(`rooms/${String(roomCode)}/words`);
          // 3) Compat → salas/{code}/palabras (si viene salaCode)
          if (salaCode) paths.push(`salas/${String(salaCode)}/palabras`);
        }

        if (!paths.length) return;

        const aggregate = new Map();
        const applySnap = (snap) => {
          const val = snap.val();
          if (val && typeof val === "object") {
            Object.values(val).forEach((v) => {
              // admitimos {texto: "..."} o {t: "..."} o string
              const raw =
                (v && (v.texto || v.t || v.text)) ||
                (typeof v === "string" ? v : "");
              const t = String(raw || "").trim();
              if (!t) return;
              const key = t.toLowerCase();
              aggregate.set(key, (aggregate.get(key) || 0) + 1);
            });
          }
          // volcamos a estado
          const arr = [...aggregate.entries()].map(([text, value]) => ({
            text,
            value,
          }));
          setLiveItems(arr);
        };

        paths.forEach((p) => {
          const nodo = ref(rtdb, p);
          const handler = (snap) => applySnap(snap);
          onValue(nodo, handler);
          cleanups.push(() => off(nodo, "value", handler));
        });
      } catch (e) {
        console.warn("[NubeDePalabras] RTDB off/skip:", e?.message || e);
      }
    })();

    return () => {
      try {
        cleanups.forEach((fn) => fn && fn());
      } catch {}
    };
  }, [roomCode, salaCode, rtdbPath]);

  // =========================
  // Normaliza/combina datos
  // =========================
  const combined = useMemo(() => {
    const all = [...items, ...liveItems];
    const map = new Map();

    for (const r of all) {
      let txt = String((r && r.text) || "").trim();
      if (!txt) continue;

      if (lowercase) txt = txt.toLowerCase();
      if (!allowNumbers && /^\d+$/.test(txt)) continue;

      // recorte de palabras MUY largas (evita romper layout móvil)
      if (txt.length > maxWordLength) txt = txt.slice(0, maxWordLength) + "…";

      const v = Number(r?.value ?? 1);
      map.set(txt, (map.get(txt) || 0) + (isFinite(v) ? v : 0));
    }

    return Array.from(map, ([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.max(1, maxItems));
  }, [items, liveItems, allowNumbers, lowercase, maxItems, maxWordLength]);

  // =========================
  // Paletas “estilo menti”
  // =========================
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

  // =========================
  // Escalas rápidas
  // =========================
  const min = combined.length ? Math.min(...combined.map((d) => d.value)) : 0;
  const max = combined.length ? Math.max(...combined.map((d) => d.value)) : 1;

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

  const cloudData = combined.map((d, i) => ({
    ...d,
    text: d.text,
    value: sizeScale(d.value),
    color: colorFor(d.value, i),
    rotate: rotate(),
  }));

  // =========================
  // Responsivo al contenedor
  // =========================
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 520, h: 320 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const w = Math.max(320, Math.floor(r.width - 16));
      // altura proporcional con mínimo
      const h = Math.max(240, Math.floor(w * 0.6));
      setDims({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
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
        height={dims.h}
        width={dims.w}
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
        {combined.length ? "Tamaño = frecuencia" : "Sin palabras aún"}
      </div>
    </div>
  );
}




