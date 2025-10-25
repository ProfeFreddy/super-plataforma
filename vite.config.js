export default {
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // Para poder llamar /mineduc o /shape/generate desde el front en 5174
      '^/(mineduc|shape|ping)': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: { outDir: 'dist' }
}




