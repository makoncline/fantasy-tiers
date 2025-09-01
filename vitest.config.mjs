import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        name: "node",
        test: {
          environment: "node",
          include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
          exclude: ["tests/browser/**/*"],
        },
      },
      {
        name: "browser",
        test: {
          environment: "browser",
          include: ["tests/browser/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
          browser: {
            enabled: true,
            name: "chromium",
            provider: "playwright",
            headless: true,
          },
        },
      },
    ],
  },
});
