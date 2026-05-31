import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' -> assets load with relative paths so the build works
// on GitHub Pages project sites (/repo/) and when opened from a subfolder.
export default defineConfig({
  plugins: [vue()],
  base: './',
})
