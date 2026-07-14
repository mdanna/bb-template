import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    // Non raccogliere i test dei git worktree annidati (.claude/worktrees/*): sono checkout
    // di altri branch e i loro file, obsoleti rispetto a questo branch, inquinerebbero il run.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/data/**"],
      exclude: ["src/lib/db.ts", "src/lib/stripe.ts", "src/lib/email.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
