import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    headers: {
      "Content-Security-Policy": "script-src 'self' 'unsafe-eval'; connect-src *",
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})