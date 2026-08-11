import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Must stay identical to tsconfig.json's paths entry. If the two drift,
      // a test resolves a different file from the one the app ships and passes
      // against code nobody runs.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // check:unit passes `src` on the command line. Restricting the include
    // glob to colocated tests keeps scripts/check-schema.test.ts and
    // scripts/check-setup.test.ts (live Neon + R2 credentials) out of this
    // run by construction rather than by remembering to exclude them.
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",

    // Deliberate divergence from arena-player-web's vitest.config.ts: this
    // step (1a-step-03) must leave check:unit passing before step 05 copies
    // the first colocated test in. Vitest 4 exits non-zero on zero matched
    // test files by default; without this, "pnpm check:unit" would be red on
    // a clean scaffold for no reason a developer caused. Harmless once real
    // tests exist — it only changes the zero-test outcome.
    passWithNoTests: true,

    // NOT decoration. This machine runs on Asia/Jakarta, which is the
    // timezone src/domain/dates.ts (copied at step 05) exists to compute in —
    // every date test would pass even with the { in: tz("Asia/Jakarta") }
    // context missing entirely, proving the developer's clock rather than
    // the code. Pinning UTC is what makes that difference visible in CI and
    // here alike. Mirrors arena-player-web/vitest.config.ts exactly, since
    // the copied tests assume it.
    env: {
      TZ: "UTC",
    },
  },
});
