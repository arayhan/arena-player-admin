# Code style

What tooling cannot check when writing TypeScript and React in this repo.

**Load when:** before writing or editing any `.ts` / `.tsx` file under `src/` or `scripts/`.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) — hard rules and folder structure
- [docs/dev-rules.md](../dev-rules.md) — naming, where a thing goes, import zones, Server Component default, data fetching, accessibility, error handling
- [docs/architecture.md](../architecture.md) — SQL contracts, the dependency decisions, the proof read path
- [docs/DESIGN.md](../DESIGN.md) — normative colour, type, spacing, contrast

## Already enforced — do not re-argue it

1. **Formatting belongs to Prettier** (`.prettierrc.json`, `.editorconfig`). Never hand-format, never raise it in review. `pnpm format:check` settles it.
2. **Import zones belong to ESLint** (`no-restricted-imports` in `eslint.config.mjs`, with the reasoning in each rule's message). `pnpm lint` settles it. The prose version lives in dev-rules.md.
3. **Types belong to `strict` tsconfig.** `pnpm typecheck` settles it.

Everything below is honour-system: no command fails when it is ignored.

## TypeScript as practiced in `src/`

- **`type` by default; `interface` only when it extends something or describes a database row shape.** `SessionPayload extends JWTPayload`, the `Required*` shapes in `src/server/required-schema.ts`, and the row types in `scripts/check-schema.test.ts` are interfaces. Props, unions, and derived aliases are all `type`.
- **Never `enum`.** There is not one in the repo. A closed set is a `const` array with `as const`, and its type is derived from it — see `src/domain/slots.ts` and `src/domain/status.ts`. This keeps the runtime list and the type from drifting apart.
- **No `any`, anywhere.** There is none in `src/`. Type assertions are permitted but rare, always as narrow as possible, and always carry a comment saying what makes them safe — see the postgres.js proxy in `src/server/db.ts` and the row cast in `src/server/schema-guard.ts`.
- **`satisfies` only to constrain a literal without widening it.** One use in the repo (`ACTIVE_STATUSES` in `src/domain/status.ts`). It is not a default habit.
- **Function declarations, not arrow constants,** for components and module-level functions. There is no `export const Foo = () => …` in this codebase.
- **Prefer an exhaustive lookup object to a conditional.** A `Record<Union, string>` keyed by a domain union makes a new member a compile error instead of an unstyled fallthrough — `src/components/status-pill.tsx` and `src/components/button.tsx` both do this, and architecture.md rejects `clsx`/`tailwind-merge` on the same grounds.
- **Props type placement is not settled** — follow the file you are editing. Most components keep the props type file-local; a one-prop component types it inline in the signature; `src/components/button.tsx` re-exports its types in a single `export type { … }` block at the bottom. Only export a props type when another file actually needs it.

## Imports

- Placement rules (which folder may import which) are dev-rules.md's, and ESLint enforces them.
- **Ordering is not linted** — no sort plugin is installed. The observed order is: directives and side-effect imports (`"use client"`, `import "server-only"`), then external packages, then `@/` aliases, then relative paths, with a blank line between groups.
- Use `import type` or an inline `type` specifier for type-only imports.
- `src/app/api/auth/login/route.ts` puts `export const runtime` **above** its imports on purpose, with a comment explaining why. Leave deliberate placements like that alone rather than tidying them.

## Comments

Comments explain **why**, and name the document that owns the decision — usually `docs/architecture.md` plus a section title, sometimes a line number. Restating what the code does is noise; recording the constraint that made it look like this is the point.

```tsx
// Lookup objects keyed by the four database states — never a conditional
// class expression. docs/architecture.md rejects clsx/tailwind-merge by
// name and names this exact case: a status pill is a surface + border +
// ink triple per DESIGN.md, not a hue picked by an if/else chain.
```

Exported functions and constants use a JSDoc block for the same purpose; internal groupings use a `//` block above them. Comments and identifiers are English — the Indonesian seam is described in dev-rules.md's naming section.
