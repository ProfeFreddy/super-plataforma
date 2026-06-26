import React, { useEffect, useMemo, useRef, useState } from "react";
import WordCloud from "react-d3-cloud";

export default function NubeDePalabras({
  items = [],
  palette = "menti",
  minFont = 18,
  maxFont = 78,
  animate = true,
  darkBg = false,
  salaCode,
  roomCode,
  rtdbPath,
  maxItems = 120,
  maxWordLength = 28,
  allowNumbers = true,
  lowercase = true,
}) {
  const [liveItems, setLiveItems] = useState([]);

  useEffect(() => {
    let cleanups = [];
    (async () => {
      try {
        if (!roomCode && !salaCode && !rtdbPath) return;
        const mod = await import("../firebase").catch(() => null);
        if (!mod || !mod.rtdb) return;
        const { rtdb } = mod;
        const { ref, onValue, off } = await import("firebase/database");
        const paths = [];
        if (rtdbPath) { paths.push(rtdbPath); }
        else {
          if (roomCode) paths.push(`rooms/${String(roomCode)}/words`);
          if (salaCode) paths.push(`salas/${String(salaCode)}/palabras`);
        }
        if (!paths.length) return;
        const aggregate = new Map();
        const applySnap = (snap) => {
          const val = snap.val();
          if (val && typeof val === "object") {
            Object.values(val).forEach((v) => {
              const raw = (v && (v.texto || v.t || v.text)) || (typeof v === "string" ? v : "");
              const t = String(raw || "").trim();
              if (!t) return;
              const key = t.toLowerCase();
              aggregate.set(key, (aggregate.get(key) || 0) + 1);
            });
          }
          const arr = [...aggregate.entries()].map(([text, value]) => ({ text, value }));
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
    return () => { try { cleanups.forEach((fn) => fn && fn()); } catch {} };
  }, [roomCode, salaCode, rtdbPath]);

  const combined = useMemo(() => {
    const all = [...items, ...liveItems];
    const map = new Map();
    for (const r of all) {
      let txt = String((r && r.text) || "").trim();
      if (!txt) continue;
      if (lowercase) txt = txt.toLowerCase();
      if (!allowNumbers && /^\d+$/.test(txt)) continue;
      if (txt.length > maxWordLength) txt = txt.slice(0, maxWordLength) + "…";
      const v = Number(r?.value ?? 1);
      map.set(txt, (map.get(txt) || 0) + (isFinite(v) ? v : 0));
    }
    return Array.from(map, ([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.max(1, maxItems));
  }, [items, liveItems, allowNumbers, lowercase, maxItems, maxWordLength]);

  const palettes = {
    menti: [
      "#1abc9c", "#2ecc71", "#3498db", "#9b59b6",
      "#e67e22", "#e74c3c", "#16a085", "#27ae60",
      "#2980b9", "#8e44ad", "#f39c12", "#c0392b",
      "#7f8c8d", "#2c3e50", "#d35400", "#f1c40f",
    ],
    pastel: ["#A3E4D7","#AED6F1","#D2B4DE","#F9E79F","#F5CBA7","#F1948A","#A9DFBF","#85C1E9"],
    warm: ["#ef4444","#f97316","#f59e0b","#eab308","#dc2626"],
    cool: ["#22c55e","#06b6d4","#3b82f6","#6366f1","#14b8a6"],
  };

  const min = combined.length ? Math.min(...combined.map((d) => d.value)) : 0;
  const max = combined.length ? Math.max(...combined.map((d) => d.value)) : 1;

  const sizeScale = (val) => {
    const v = Math.max(1, val - min + 1);
    const log = Math.log10(v) / Math.log10(Math.max(10, max - min + 1));
    return Math.round(minFont + (maxFont - minFont) * log);
  };

  const colors = palettes[palette] || palettes.menti;
  const colorFor = (val, i) => {
    if (max === min) return colors[i % colors.length];
    const q = (val - min) / (max - min);
    const idx = Math.floor(q * (colors.length - 1));
    return colors[Math.max(0, Math.min(idx, colors.length - 1))];
  };

  const rotate = () => {
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

  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 520, h: 320 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const w = Math.max(320, Math.floor(r.width - 16));
      const h = Math.max(240, Math.floor(w * 0.6));
      setDims({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ✅ FIX PRODUCCIÓN: forzar colores en el SVG tras render
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const timeout = setTimeout(() => {
      const texts = el.querySelectorAll("svg text");
      texts.forEach((node, i) => {
        const word = cloudData[i];
        if (word?.color) {
          node.setAttribute("fill", word.color);
          node.style.fill = word.color;
        }
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [cloudData]);

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
      {/* ✅ FIX: override CSS global que pueda pisar fill en SVG text */}
      <style>{`
        .pragma-wordcloud svg text {
          fill: inherit !important;
        }
      `}</style>

      <div className="pragma-wordcloud" ref={svgRef} style={{ width: "100%", height: "100%" }}>
        <WordCloud
          data={cloudData}
          font={font}
          fontSize={(w) => w.value}
          rotate={(w) => w.rotate}
          padding={2}
          spiral="archimedean"
          height={dims.h}
          width={dims.w}
          random={(a) => a}
          onWordMouseOver={(e) => {
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
          // @ts-ignore
          fill={(w) => w.color || "#2979ff"}
          transitionDuration={animate ? 800 : 0}
        />
      </div>

      <div style={{
        position: "absolute", right: 8, bottom: 8,
        fontSize: 11, opacity: 0.7, userSelect: "none",
      }}>
        {combined.length ? "Tamaño = frecuencia" : "Sin palabras aún"}
      </div>
    </div>
  );
}