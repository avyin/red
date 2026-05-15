import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.PORT ?? 3001);

  return {
    root: "src/client",
    plugins: [react()],
    server: {
      allowedHosts: ["trixie"],
      proxy: {
        "/api": `http://localhost:${port}`,
        "/health": `http://localhost:${port}`,
        "/openapi.yaml": `http://localhost:${port}`
      }
    },
    build: {
      outDir: "../../dist/client",
      emptyOutDir: true
    }
  };
});
