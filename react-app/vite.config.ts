import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-mode proxy to the local server; the built app is served BY the server.
export default defineConfig({
  plugins: [react()],
  // The build embeds its own timestamp so "which build are you on?" answers itself.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  server: { proxy: { "/api": "http://localhost:5182" } },
});
