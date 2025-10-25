// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'server/frontend/build',   // <<< AQUI el server lo encontrará
    emptyOutDir: true
  },
  server: { port: 5174 }
})
