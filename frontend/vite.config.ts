/**
 * Vite configuration for the terminal-grid frontend.
 *
 * Key decisions
 * -------------
 * - Uses @vitejs/plugin-react for fast HMR via Babel transforms.
 * - Dev server runs on port 5173 (Vite default).
 * - No API proxy is configured because the backend already enables CORS for
 *   all origins.  Absolute URLs (http/ws://localhost:8000) are used instead.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Allow "@/..." imports that mirror the tsconfig.json paths entry.
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    // Automatically open the browser on `npm run dev`
    open: true,
  },
});
