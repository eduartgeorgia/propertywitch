import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  
  return {
    plugins: [react()],
    define: {
      // Make API URL available to the app
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL || ""),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": env.VITE_API_URL || "http://localhost:4000",
        "/reports": env.VITE_API_URL || "http://localhost:4000",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
