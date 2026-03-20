import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import build from "@hono/vite-build/bun";
import devServer, { defaultOptions } from "@hono/vite-dev-server";
import bunAdapter from "@hono/vite-dev-server/bun";

export default defineConfig(({ command, mode }) => {
  if (mode === "client") {
    return {
      plugins: [react(), tailwindcss()],
      build: {
        outDir: "dist/static",
        emptyOutDir: true,
      },
    };
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      command === "serve"
        ? devServer({
            entry: "./src/server.ts",
            adapter: bunAdapter,
            exclude: [/.*\.(svg|png|webp|ico)$/i, /^\/assets\/.*/, ...defaultOptions.exclude],
          })
        : build({
            entry: "./src/server.ts",
            outputDir: "./dist",
            output: "index.js",
            emptyOutDir: false,
          }),
    ],
  };
});
