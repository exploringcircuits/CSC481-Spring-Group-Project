import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Backend default: 127.0.0.1:8001. Override with VITE_BACKEND_URL if needed.
      '/api': process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8001',
    },
  },
})
