import { defineConfig } from 'vite'

export default defineConfig({
  root: './dashboard',
  server: { port: 5174 },
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
  },
})
