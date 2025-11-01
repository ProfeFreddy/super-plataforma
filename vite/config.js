// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // ⬇️ Genera directamente donde tu server lee los estáticos
    outDir: path.resolve(__dirname, 'server', 'frontend', 'build'),
    emptyOutDir: true,
  },
  server: { port: 5174 },
  preview: { port: 5174 },
});

