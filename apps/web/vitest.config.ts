import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Vitest auto-loads .env and .env.local from envDir
    envDir: ".",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["node_modules", ".next", "vitest.setup.ts", "vitest.config.ts"],
    },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
