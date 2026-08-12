import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Para probar en local con `netlify dev` (recomendado) esto no hace falta,
      // pero si corrés `vite` solo, esto evita error 404 en /.netlify/functions
      "/.netlify/functions": "http://localhost:9999",
    },
  },
});
