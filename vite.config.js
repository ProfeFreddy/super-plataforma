// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      // reenvía TODO lo que empiece con /api hacia tu server cjs en 8081
      "^/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        // opcional: no reescribas el path, lo dejamos tal cual
        // rewrite: (p) => p
      },
    },
  },
  build: { outDir: "dist" },
});






