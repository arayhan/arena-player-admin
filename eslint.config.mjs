import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

// ---------------------------------------------------------------------------
// Import zones. Mirrors arena-player-web's eslint.config.mjs (its half of the
// extraction boundary — the relative-import half is check:docs there, which
// this repo deliberately does not build; see docs/architecture.md ~L460).
// Only the two rules that apply to THIS repo's structure are ported: no
// SERVER_ONLY zone (Server Components read Neon directly here, there is no
// bundle-budget reason to confine src/server/ to route handlers), and none of
// AXIOS / RHF / ZOD / GSAP / MOCKS (those packages are not installed here at
// all — see the deliberately-absent table in docs/architecture.md).
// ---------------------------------------------------------------------------

// The extraction boundary. src/app/ composes modules and routes; anything
// below it must stay movable to another app without dragging routing along —
// which is what keeps src/domain/ shareable with arena-player-web.
const APP = {
  group: ["@/app", "@/app/*"],
  message:
    "Nothing under src/ imports from src/app/ — the extraction boundary. src/app/ composes modules; anything below it must stay movable without dragging routing along.",
};

// Feature modules never import each other. Shared vocabulary belongs in
// src/domain/.
const CROSS_MODULE = {
  group: ["@/modules/*/*", "@/modules/*"],
  message: "Feature modules never import each other. Shared vocabulary belongs in src/domain/.",
};

const DEFAULT_PATTERNS = [APP];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: DEFAULT_PATTERNS }],
    },
  },

  // src/modules/, src/components/ and src/hooks/: components/ and hooks/ sit
  // BELOW modules, so a shared hook reaching into @/modules/bookings is not
  // shared — it is a bookings hook in the wrong folder, and it drags
  // whatever that module imports onto every surface using it.
  {
    files: ["src/modules/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [...DEFAULT_PATTERNS, CROSS_MODULE] }],
    },
  },

  // src/app/ IS the composition layer, so it is the one place the @/app ban
  // must not apply — a layout importing its own page is the boundary
  // working, not breaking.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // src/domain/ is copied byte-identical into arena-player-web. It must stay
  // dependency-light, must not reach upward into the rest of src/, and must
  // import its own siblings relatively so the copy resolves the same in both
  // repos regardless of either tsconfig.
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message:
                "src/domain/ is byte-identical with arena-player-web. Import siblings relatively (./slots) so the copy resolves the same in both repos regardless of either tsconfig, and never reach upward — domain is the bottom of the import graph.",
            },
            {
              group: ["../*"],
              message:
                "src/domain/ is the bottom of the import graph and is copied byte-identical into arena-player-web, which has no src/utils/ or src/server/ to resolve against. Import siblings with ./ and nothing else.",
            },
          ],
        },
      ],
    },
  },

  // Must come last: turns off stylistic rules Prettier owns.
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
