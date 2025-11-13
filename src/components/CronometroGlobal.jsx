// src/components/CronometroGlobal.jsx 
// Cronómetro global compartido entre Inicio → Desarrollo → Cierre
// - OCULTA el preset cuando está corriendo (evita "dos cronómetros" en pantalla)
// - Mantiene compat con COUNT_KEY legacy y clave por slot/semana/usuario

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../firebase";
import { getYearWeek } from "../services/PlanificadorService";

// ====== estilos mínimos (coinciden con tus tarjetas) ======
const COLORS = {
  text: "#0f172a",
  muted: "#475569",
  border: "#e5e7eb",
};
const btnTiny = {
  background: "#fff",
  color: "#111",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: ".32rem .55rem",
  fontWeight: 600,
  cursor: "pointer",
};

// ====== storage keys ======
const COUNT_KEY_LEGACY = "inicioClase_countdown_end";
const makeCountKey = (slotId = "0-0") => {
  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
  const yw = getYearWeek();
  return `ic_countdown_end:${uid}:${yw}:${slotId}`;
};

// utils
const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
const pad2 = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${pad2(mm)}:${pad2(ss)}`;
};
const now = () => Date.now();

export default function CronometroGlobal({
  // minutos por defecto cuando se (re)inicia manualmente
  duracion = 10,
  // identifica la clase/bloque; si no viene, usa el último recordado
  slotId: slotIdProp,
  // etiqueta libre (“inicio” | “desarrollo” | “cierre”)
  fase = "",
  // mostrar preset cuando NO está corriendo
  showPresetWhenStopped = true,
  // mostrar botones ↺ y +1 al lado del reloj grande mientras corre
  showInlineControls = true,
  // callback al llegar a 0
  onEnd,
}) {
  const slotId =
    slotIdProp ||
    localStorage.getItem("__lastSlotId") ||
    "0-0";

  const storageKey = useMemo(() => makeCountKey(slotId), [slotId]);

  // estado base
  const [endMs, setEndMs] = useState(() => {
    const s =
      localStorage.getItem(storageKey) ||
      localStorage.getItem(COUNT_KEY_LEGACY);
    return s ? Number(s) : 0;
  });
  const [tick, setTick] = useState(now());

  const prevRunningRef = useRef(false);

  // ✅ NUEVO: referencia segura al callback (evita llamar 0 como función)
  const onEndRef = useRef(null);
  useEffect(() => {
    onEndRef.current =
      typeof onEnd === "function" ? onEnd : null;
  }, [onEnd]);

  const diffMs = Math.max(0, (endMs || 0) - tick);
  const running = diffMs > 0;

  // interval de 1s
  useEffect(() => {
    const id = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(id);
  }, []);

  // persistencia al cambiar endMs
  useEffect(() => {
    if (!endMs) return;
    try {
      localStorage.setItem(storageKey, String(endMs));
      localStorage.setItem(COUNT_KEY_LEGACY, String(endMs)); // compat
    } catch {}
  }, [endMs, storageKey]);

  // ✅ disparar onEnd exactamente una vez al pasar de running → no running,
  //   y SOLO si onEnd es realmente una función
  useEffect(() => {
    const prevRunning = prevRunningRef.current;
    if (prevRunning && !running && onEndRef.current) {
      try {
        onEndRef.current();
      } catch (e) {
        console.error("[CronometroGlobal] onEnd error:", e);
      }
    }
    prevRunningRef.current = running;
  }, [running]);

  // acciones
  const start = () => {
    const end = now() + duracion * 60 * 1000;
    setEndMs(end);
  };
  const reset = () => {
    const end = now() + duracion * 60 * 1000;
    setEndMs(end);
  };
  const add1 = () => {
    const base = running ? endMs : now();
    setEndMs(base + 60 * 1000);
  };

  // UI
  const relojGrande = (
    <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: COLORS.text }}>
        {fmt(diffMs)}
      </div>
      {showInlineControls && running && (
        <>
          <button style={btnTiny} title="Reiniciar a duración" onClick={reset}>
            ↺
          </button>
          <button style={btnTiny} title="+1 minuto" onClick={add1}>
            +1
          </button>
        </>
      )}
    </div>
  );

  const presetFila =
    !running && showPresetWhenStopped ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          marginTop: 6,
          color: COLORS.muted,
        }}
      >
        <div style={{ fontWeight: 800 }}>{pad2(duracion)}:00</div>
        <button style={btnTiny} title="Iniciar" onClick={start}>
          ▶
        </button>
        <button style={btnTiny} title="Reiniciar a duración" onClick={reset}>
          ↺
        </button>
        <button style={btnTiny} title="+1 minuto" onClick={add1}>
          +1
        </button>
      </div>
    ) : null;

  return (
    <div>
      {relojGrande}
      {/* etiqueta informativa bajo el reloj */}
      {(slotId || fase) && (
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
          {slotId ? `slot ${slotId}` : ""}
          {slotId && fase ? " — " : ""}
          {fase ? `fase ${fase}` : ""}
        </div>
      )}
      {presetFila}
    </div>
  );
}

// Compatibilidad por si en algún lugar se usa import { CronometroGlobal } ...
export { CronometroGlobal };


