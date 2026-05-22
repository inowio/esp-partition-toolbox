import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";
import tailwindcss from '@tailwindcss/vite';

// @ts-expect-error process is a nodejs global
const tauriDevHost = process.env.TAURI_DEV_HOST;

// Bind to all interfaces by default so mobile devices can reach the dev server,
// but avoid using 0.0.0.0 for HMR websocket connections (invalid browser target).
const serverHost = tauriDevHost || "0.0.0.0";
const hmrHost = tauriDevHost || "localhost";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1426,
    strictPort: true,
    host: serverHost || false,
    hmr: serverHost
      ? {
        protocol: "ws",
        host: hmrHost,
        port: 1427,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
