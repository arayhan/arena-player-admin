# UI and design

How to write markup and styling in this repo. It holds the procedure only — every colour, ratio, size and spacing value lives in `docs/DESIGN.md`, which is normative.

**Load when:** before writing or editing any `.tsx` that renders markup, or any rule in `src/app/globals.css`.

**Authority elsewhere:**

- [docs/DESIGN.md](../DESIGN.md) — every token value, measured contrast, layout breakpoints, the motion ceiling. **Normative.** If code disagrees with it, the code is wrong.
- [docs/dev-rules.md](../dev-rules.md) — [Accessibility baseline](../dev-rules.md#accessibility-baseline), [Server Component by default](../dev-rules.md#server-component-by-default), [Naming and file layout](../dev-rules.md#naming-and-file-layout).
- [docs/architecture.md](../architecture.md) — [Deliberately absent](../architecture.md#deliberately-absent) (why a dependency you want is missing), [Design tokens: a hand-authored `@theme` block](../architecture.md#design-tokens-a-hand-authored-theme-block).
- [CLAUDE.md](../../CLAUDE.md) — hard rules 2, 7 and 10 all land on UI work.

## Token tiers

`src/app/globals.css` has three tiers and components may address exactly one of them.

1. **Primitives** — the brand palette, type steps and radii, in the `@theme` block. They never swap between themes.
2. **Semantic** — declared in plain `:root` rules below `@theme`, re-exported as utilities by the `@theme static inline` block. This is the only tier that swaps.
3. **Component** — recipes in DESIGN.md's frontmatter `components:` map, each one built out of semantic tokens.

Rules:

- **Reach for the semantic utility.** A component that names a raw primitive (a brand colour utility, or a literal hex) is a bug, even when it looks right in the theme you happen to be viewing. DESIGN.md records seventeen of these caught as one P0 in the sibling repo.
- **A new component token is added to DESIGN.md's `components:` frontmatter first**, expressed in semantic tokens, and only then written as classes. If it needs a semantic token that does not exist, add that pair to DESIGN.md's `semantic:` map first — see the dark-mode procedure below.
- **Never add a value to `globals.css` that DESIGN.md does not carry.** The `@theme` block is a hand transcription; DESIGN.md wins on every disagreement and the CSS gets corrected.

## Tailwind, as practiced here

- **Variants are lookup objects**, not conditional class expressions: `const VARIANT_CLASSES: Record<Variant, string>` in `src/components/button.tsx`, `Record<BookingStatus, string>` in `src/components/status-pill.tsx`. The `Record` key type is load-bearing — it makes an unhandled case a compile error.
- **There is no `cn`, no `clsx`, no `tailwind-merge`, no `cva`.** `src/lib/` is empty and `package.json` has none of them; architecture.md rejects `clsx`/`tailwind-merge` by name. Compose with a template literal: static base classes, then the lookup, then the caller's `className` last so it can override.
- **Arbitrary values are used for layout, never for colour.** `nav-drawer.tsx` uses arbitrary z-index, width and `max-[…]:`/`min-[…]:` breakpoint values for the drawer; `theme-toggle.tsx` uses an arbitrary descendant selector to size its SVG. Colour, radius, type and spacing always go through a token utility.
- **No class sorter is installed** (`.prettierrc` sets `plugins: []`). Order by hand the way the existing primitives do — layout and box first, then colour, then state variants — and do not reflow a file just to re-sort it.
- **Icons are inline SVG** with `aria-hidden="true"`; there is no icon library.

## Motion

No GSAP, no motion library, no `src/lib/motion.ts` — [CLAUDE.md](../../CLAUDE.md) hard rule 7 and [DESIGN.md "Motion"](../DESIGN.md#motion) carry the reasoning; do not re-argue it here.

Practically: transitions are CSS-only, limited to the properties and duration DESIGN.md names, and `transition-colors` is the only one in the codebase today. There are no entrance, scroll or page transitions. **"It would feel nicer" is not a reason to add a dependency** — a request for polish is answered with layout, contrast and copy, or it is escalated as a DESIGN.md change.

## Server Components

`"use client"` needs a stated reason in a comment — see [Server Component by default](../dev-rules.md#server-component-by-default) for the exceptions and their exact form. Every component in `src/components/` is a Server Component except the two that document why they are not.

## Before you claim a component is done

Run each line against your own diff. All six are checkable by reading the changed file.

- [ ] Every input has a `<label htmlFor>` matching the control's `id` — a placeholder is not a label.
- [ ] Every interactive element is a real `<button>` or `<a>`; no `onClick` on a `<div>` or `<span>`.
- [ ] Anything reachable by mouse is reachable by Tab, and no rule in the diff sets `outline: none` without putting a visible replacement back.
- [ ] Error text states the problem in words — colour or a border alone is never the only signal.
- [ ] Every semantic-token class in the diff was checked in both themes, not just the one you rendered.
- [ ] Full checklist run: [Accessibility baseline](../dev-rules.md#accessibility-baseline) — labels, `aria-describedby`/`aria-invalid`, post-mutation focus, keyboard operation, touch targets.

## Copy

UI strings Indonesian, code and comments English — [CLAUDE.md](../../CLAUDE.md) hard rule 10. **`aria-label`, `sr-only` text and `alt` are UI copy** and are therefore Indonesian; [dev-rules.md](../dev-rules.md#naming-and-file-layout) explains why. Component names, props and types stay English.

## Theming a new surface

Theming is wired without a `dark:` prefix on any element: a semantic token changes value, the utility does not change. To add one:

1. Add the pair to DESIGN.md's frontmatter `semantic:` map and its [Dark mode](../DESIGN.md#dark-mode) table, with both values and their measured contrast.
2. In [`src/app/globals.css`](../../src/app/globals.css), declare the variable in **all four** blocks — the bare `:root`, the `prefers-color-scheme: dark` block, `:root[data-theme="dark"]`, and `:root[data-theme="light"]`. Omitting the last one lets a dark OS beat an explicit light choice.
3. Export it as a utility by adding a `--color-*` alias to the `@theme static inline` block.
4. Use the utility in the component. Do not reach for the `dark:` variant — it is the escape hatch for the small non-colour cases (opacity, blend, an asset swap), and `not-dark:` silently compiles to nothing.

The three theme states (`system` is the default; `light` and `dark` are explicit and persisted) are handled by `src/components/theme-toggle.tsx` plus the pre-paint script in `src/app/layout.tsx`. A new surface needs no code in either.
