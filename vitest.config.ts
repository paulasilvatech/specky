import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests spawn the MCP server and run hooks in temp workspaces;
    // the default 5s timeout is too tight for cold-start and CI variance.
    testTimeout: 30_000,
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
      // Ratcheted after Wave 3 and again after the coverage push (90 test files).
      thresholds: {
        statements: 85,
        branches: 71,
        functions: 94,
        lines: 86,
      },
    },
  },
});
