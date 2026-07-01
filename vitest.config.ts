import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Measure the WHOLE source tree, not just files an existing test happens
      // to import — otherwise untested modules vanish from the denominator and
      // the reported percentage is meaningless.
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/types.ts"],
      // Honest baseline measured over the whole tree (the previous 50/40/60/50
      // was measured only over imported files and did not reflect the codebase).
      // Ratchet these up as service/tool coverage lands.
      thresholds: {
        statements: 15,
        branches: 12,
        functions: 20,
        lines: 15,
      },
    },
  },
});
