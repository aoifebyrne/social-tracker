import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/social-tracker/',
  define: {
    __APP_PASSWORD__: JSON.stringify(process.env.VITE_APP_PASSWORD || '')
  }
})