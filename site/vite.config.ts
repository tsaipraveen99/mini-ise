import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // The engine imports the shared test cases from ../fixtures.
  server: { fs: { allow: ['..'] } },
  test: { environment: 'node' },
})
