import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Expõe na rede local (acesso de celular/outros PCs)
  server: { host: true, port: 5173 },
})
