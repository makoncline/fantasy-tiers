import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "node_modules/**",
      "**/node_modules/**",
      "**/.pnpm/**",
      "**/dist/**",
      "**/.next/**",
      // Exclude Playwright E2E tests from Vitest run
      "tests/e2e/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
