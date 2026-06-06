import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/AtollSim/',       // must match repo name for GitHub Pages
  build: {
    outDir: 'docs',          // GH Pages serves from docs/ on master
    emptyOutDir: true,
  },
})
