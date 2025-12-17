import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Detect Docker environment (DOCKER_ENV is set in docker-compose.yml)
const isDocker = process.env.DOCKER_ENV === 'true'
const backendUrl = isDocker ? 'http://backend:8000' : 'http://localhost:8000'

console.log(`[Vite Config] Docker: ${isDocker}, Backend URL: ${backendUrl}`)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
