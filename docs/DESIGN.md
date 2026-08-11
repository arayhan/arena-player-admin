---
version: alpha
name: Arena Player Admin
description: Dense, quiet back-office surface. Same palette as the public site, none of its motion.
colors:
  navy-900: "#011A43"
  navy-700: "#0A2E6B"
  blue-600: "#2563EB"
  blue-700: "#1D4ED8"
  blue-50: "#EFF6FF"
  white: "#FFFFFF"
  grey-50: "#F9FAFB"
  grey-200: "#E5E7EB"
  navy-400: "#4A5A78"
  amber-100: "#FEF3C7"
  amber-700: "#B45309"
  amber-800: "#92400E"
  red-100: "#FEE2E2"
  red-600: "#DC2626"
  red-800: "#991B1B"
  green-100: "#DCFCE7"
  green-700: "#15803D"
  green-800: "#166534"
typography:
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: 10px
  panel: 14px
  full: 9999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
  12: 48px
  16: 64px
components:
  status-pending:
    backgroundColor: "{colors.amber-100}"
    borderColor: "{colors.amber-700}"
    textColor: "{colors.amber-800}"
    rounded: "{rounded.control}"
  status-confirmed:
    backgroundColor: "{colors.green-100}"
    borderColor: "{colors.green-700}"
    textColor: "{colors.green-800}"
    rounded: "{rounded.control}"
  status-rejected:
    backgroundColor: "{colors.red-100}"
    borderColor: "{colors.red-600}"
    textColor: "{colors.red-800}"
    rounded: "{rounded.control}"
  status-expired:
    backgroundColor: "{colors.grey-50}"
    borderColor: "{colors.navy-400}"
    textColor: "{colors.navy-400}"
    rounded: "{rounded.control}"
  row:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.grey-200}"
    textColor: "{colors.navy-900}"
    padding: 12px 16px
  row-hover:
    backgroundColor: "{colors.grey-50}"
  button-primary:
    backgroundColor: "{colors.navy-900}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: 0 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.navy-700}"
  button-danger:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.red-600}"
    textColor: "{colors.red-800}"
    rounded: "{rounded.control}"
    padding: 0 16px
    height: 40px
  button-disabled:
    backgroundColor: "{colors.grey-200}"
    textColor: "{colors.navy-400}"
  input:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.grey-200}"
    textColor: "{colors.navy-900}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 40px
  input-error:
    backgroundColor: "{colors.red-100}"
    borderColor: "{colors.red-600}"
    textColor: "{colors.red-800}"
---

# Design System: Arena Player Admin

Machine-readable tokens are the frontmatter above. This prose says how to apply them, and — more usefully — what was deliberately left out.

## What this borrows, and what it does not

The palette comes from [`arena-player-web/docs/DESIGN.md`](../../arena-player-web/docs/DESIGN.md), unchanged. Navy `#011A43` is sampled from the client's logo and blue `#2563EB` is the client's accent; both are brand commitments, not choices available here.

**What is deliberately not copied:** Orbitron display type, the fluid `clamp()` scale, the section-transition language, the scroll-animation budget, the hero language, the WebGL allowance, and the entire motion layer. That is landing-page art direction. A data table does not want it.

The admin's language, stated once so every later decision has something to be checked against: **same palette, none of the motion.** Dense, boring, fast. The admin is doing data entry under time pressure, with a customer waiting on WhatsApp. Delight is a tax here.

## Radius follows web, on purpose, unlike everything else in this section

`control` (10px) and `panel` (14px) are copied from web's Phase 1b client checkpoint (2026-08-11), which moved its own radius from 2px/4px to these same values on a direct client ask for "noticeably rounder geometry." Named `control`/`panel` rather than `sharp`/`card` for the same reason web renamed its own: a token called `sharp` holding 10px is the stale-name trap this project keeps catching.

This is a deliberate exception to "same palette, none of the motion" above — radius is shape, not motion or marketing art direction, and a client asking for rounder geometry is plausibly asking for it everywhere they will see their own product, not just the page they happened to be looking at when they said it. Decided here rather than left silently unmatched. No admin code existed yet when this landed, so it cost a frontmatter edit rather than a rebuild.

## Three additions the web palette does not have

1. **A green triple** (`green-100` / `green-700` / `green-800`). The public site has no `confirmed` state to render — its API collapses `confirmed` into `booked` (red). This app shows all four database statuses and needs a fourth colour family.
2. **A monospace scale**, for `id`, `proof_key`, and timestamps. Truncated UUIDs in a proportional face are unreadable and unscannable.
3. **Fixed type sizes, not fluid.** The public site's `clamp()` scale exists to survive 375px → 1440px on a marketing page. This app wants the same reading size on both, and a table that reflows rather than a headline that grows.

## One divergence from web's palette, and why

The status borders use the **`-600`/`-700` tier**, not the `-300` tier web carries. That is a correction, not a preference.

Web's `DESIGN.md` states the surface + border + ink rule in prose but **its component tokens name no `borderColor` at all**, so the rule was never tested against a measured border. Specifying one here made it testable, and the `-300` tier failed immediately:

| Border, measured      | vs the white page | vs its own fill |
| --------------------- | ----------------- | --------------- |
| `amber-300` `#FCD34D` | **1.44**          | **1.29**        |
| `green-300` `#86EFAC` | **1.40**          | **1.28**        |
| `red-300` `#FCA5A5`   | **1.90**          | **1.55**        |

Against a 3:1 requirement, on both sides. Those borders were decorative while being documented as one third of a state signal — which is worse than having no border, because the document claimed a guarantee the pixels did not deliver.

The replacements clear it on both sides:

| Token                          | vs white | vs fill |
| ------------------------------ | -------- | ------- |
| `amber-700` `#B45309`          | 5.02     | 4.51    |
| `green-700` `#15803D`          | 5.02     | 4.57    |
| `red-600` `#DC2626`            | 4.83     | 3.95    |
| `navy-400` `#4A5A78` (expired) | 6.94     | 6.64    |

**Worth telling the web repo**, and deliberately not fixed from here: if its Phase 2 slot cells ever grow a state-carrying border, `amber-300` and `red-300` will fail the same way. Its `slot-available` cell already borders in `blue-600`, which measures 5.17 on white and is fine.

## Measured contrast — recomputed, not carried forward

Every figure below was computed against the sRGB formula at the time this file was last edited. **An earlier draft of this document claimed 7.4:1 for `green-800` on `green-100`; the true figure is 6.49.** It still passes AA, and it was still wrong — recorded here rather than quietly corrected, because the other repo shipped two overstated ratios and the lesson is that a plausible number is the easiest kind to not check.

| Pair                                       | Ratio | Needs |
| ------------------------------------------ | ----- | ----- |
| `amber-800` on `amber-100` — pending ink   | 6.37  | 4.5   |
| `green-800` on `green-100` — confirmed ink | 6.49  | 4.5   |
| `red-800` on `red-100` — rejected ink      | 6.80  | 4.5   |
| `navy-400` on `grey-50` — expired ink      | 6.64  | 4.5   |
| `navy-900` on `white` — body               | 17.07 | 4.5   |
| `navy-400` on `white` — muted              | 6.94  | 4.5   |
| `white` on `navy-900` — primary button     | 17.07 | 4.5   |
| `white` on `navy-700` — primary hover      | 12.99 | 4.5   |
| `red-800` on `white` — danger button       | 8.31  | 4.5   |
| `blue-600` on `white` — focus ring         | 5.17  | 3.0   |

**One deliberate exemption:** `grey-200` row dividers measure 1.24 on white. They separate rows; they carry no state and no information. 1.4.11 governs boundaries that _are_ the signal, and a table rule is not one. Noted so it does not read as the same oversight as the one above.

## Rules carried over unchanged

- **Status is a surface + border + ink triple, never a single hue.** A status the admin misreads is a booking they action wrongly. This is the one visual rule in the system that is an accessibility requirement rather than a preference.
- **A border carrying a state must clear 3:1 against both the page and its own fill** (WCAG 1.4.11). Both sides, measured — checking only one side is how the `-300` tier passed a casual eye. Figures above.
- **Component CSS routes through a semantic tier.** A component rule reaching a raw hex is a defect. The web repo's finish review caught seventeen of these as a single P0.
- **Contrast ratios are computed, not carried forward.** Two overstated figures shipped once in the other repo, and a third was caught in this file — see above.
- **Focus rings are restyled, never removed.** This app is keyboard-heavy by nature; the admin is tabbing through a queue.
- UI copy Indonesian, code and comments English.

## Layout

**375px is a real target, not a courtesy.** The admin runs a field and is frequently on a phone. At that width the bookings list is **not a table** — one card per booking: date and slot as the heading, team name, status pill, age. The desktop table appears at ≥720px.

Container max 1100px, matching the web repo, so the two apps do not feel like different products when the client sees them side by side.

## Motion

Transitions on `background-color` and `border-color` only, ≤160ms, and nothing else. No GSAP, no scroll effects, no page transitions, no entrance animations.

`prefers-reduced-motion` still removes even those — cheap to honour and there is no argument for skipping it. But there is no `src/lib/motion.ts` here and there should not be: the web repo's wrapper exists because GSAP has no built-in reduced-motion handling, and this repo has no GSAP.

## Not under `check:domain`

**This file is not byte-diffed against the web repo, and must not be added to that check.** `check:domain` covers `src/domain/*.ts` only.

The two are different classes of problem. Token drift between the repos is cosmetic — the admin's green pills looking slightly off is a thing someone notices and fixes. Slot-string drift silently disables anti-double-booking in both apps with nothing throwing. Putting a documentation file under a byte-diff would train people to skim past that check's failures, which is the one check in this project that must never be skimmed past.
