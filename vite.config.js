import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Labyrinth/', // Make sure this matches your repo name exactly
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  assetsInclude: ['**/*.riv'],
  server: {
    port: 3000,
  },
})
