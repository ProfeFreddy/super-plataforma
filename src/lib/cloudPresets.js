// src/lib/cloudPresets.js
export const SHOWTIME_PRESET = {
  id: "showtime",
  colors: ["#0f172a", "#0ea5e9", "#22c55e", "#ef4444", "#f59e0b", "#a855f7"],
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontWeight: [600, 800],
  fontSizes: [18, 72],
  padding: 1,
  spiral: "rectangular",
  shuffle: true,
  rotate: {
    mode: "steep",
    angles: [-90, -60, -30, 0, 30, 60, 90],
    probabilityTilted: 0.75,
  },
  contrastBoost: 1.25,
  rendering: { fontKerning: "none", pixelRatio: 1.0 },
};
