import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Tauri 期望固定的 port，并支持移动端 host
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // 忽略 Rust 目录变化
      ignored: ["**/src-tauri/**"],
    },
  },
}));
