import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Must stay identical to tsconfig.json's paths entry. If the two drift,
      // a test resolves a different file from the one the app ships and passes
      // against code nobody runs.
      "@": fileURLToPath(new URL("./src", import.meta.url)),

      // `server-only`'s package.json resolves to `empty.js` (a no-op) ONLY
      // under Next's "react-server" export condition; plain Node/Vitest
      // resolves its default export, which unconditionally throws. That
      // throw is exactly what makes hard rule 3 real at build time — a
      // client component importing db.ts or storage.ts fails the build. This
      // alias exists ONLY inside the Vitest test runtime, scoped to this one
      // package, so colocated tests under src/server/ (starting with
      // db.test.ts) can import server-only modules without weakening that
      // build-time guarantee, which this alias never touches.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // Both colocated tests (src/**) and the two live-credential scripts
    // (scripts/**) need to be discoverable, because `check:schema` and
    // `check:setup` each pass an explicit `scripts/check-*.test.ts` path on
    // the command line and Vitest only runs CLI-specified files that also
    // match `include`. `check:unit` passes `src` on the command line, which
    // narrows the match down to colocated tests — scripts/check-schema.test.ts
    // and scripts/check-setup.test.ts (live Supabase Postgres + Storage credentials) stay out
    // of that run by construction, not by remembering to exclude them.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    environment: "node",

    // See vitest.setup.ts — bare `vitest` never loads `.env.local` the way
    // `next dev`/`next build` do, so check:schema/check:setup need this to
    // see real credentials at all.
    setupFiles: ["./vitest.setup.ts"],

    // passWithNoTests intentionally NOT set (Vitest 4 default is false, i.e.
    // it fails on zero matched test files). Step 03 set this to true because
    // it landed before step 05 copied the first colocated test in; step 05
    // landed 8 files / 67 tests, so the justification expired and leaving it
    // true let check:unit — this repo's only behavioural gate — pass
    // vacuously if the include glob or run target ever broke. See
    // docs/PROGRESS.md step 08 checkpoint.

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
