import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 60,
        lines: 50,
      },
    },
  },
});
