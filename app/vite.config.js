import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built assets work when served from any path (e.g. a Pi http.server)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
})
