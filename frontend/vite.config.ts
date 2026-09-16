import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api goes to the local policy API. In Kubernetes, nginx does the same job.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.POLICY_API_URL ?? 'http://localhost:8001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
