// Server Component. Promoted out of `(dashboard)/_components/` once /login
// became a third consumer: a route group's `_components/` folder is private
// to that group, and `src/app/login/` reaching into `(dashboard)` would be
// exactly the import direction this repo forbids. Copying it into the login
// page instead would have duplicated the white-chip exception below, and a
// copied rule is a rule that drifts.
//
// Plain <img>, never next/image — same rule as the payment proof (hard
// rule 2), kept uniform rather than reached-for only where it is load-
// bearing.
//
// `public/logo.jpeg` IS EXPORTED AT 132px, WHICH IS `MARK.lg * 3` AND NOT A
// ROUND NUMBER BY ACCIDENT. The client supplied a 1254x1254 / 53KB master, and
// with next/image banned nothing downscales it: the browser decoded a 1254²
// bitmap — around 6MB in memory — to paint a 44px chip. The transfer was never
// the problem on one admin's wifi; the decode was. 132px covers a 3x display at
// the largest size this component renders (`MARK.lg`), and the file is now
// ~4.9KB.
//
// IF `MARK.lg` EVER GROWS, THIS ASSET MUST BE RE-EXPORTED, and nothing will
// tell you: an undersized JPEG does not fail, it just goes soft on the one
// screen the client sees first. The master is kept at
// `docs/assets/logo-master.jpeg` for exactly that — re-export from there,
// never from the served copy, which has already been through one lossy pass.
//
// The white chip behind the mark is a deliberate, narrow exception to
// "colour comes only from the semantic tier": logo.jpeg is a flat JPEG
// with no alpha, painted on white by the source asset itself, not a
// themable surface. A navy mark directly on the dark `surface`
// (#0C1830, itself near-navy) would be close to invisible — the chip has
// to stay light in both themes for the mark to read at all. The mockup's
// own `.brand-mark` carries the same unconditional #ffffff.

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  /**
   * The "Arena Player / Admin" wordmark beside the chip. Off on /login,
   * where the card's own <h1> already names the app one line below — the
   * same words twice in one card reads as a rendering bug, not as brand.
   */
  showWordmark?: boolean;
};

const CHIP = { sm: 32, md: 36, lg: 56 } as const;
const MARK = { sm: 24, md: 28, lg: 44 } as const;

export function BrandMark({ size = "md", showWordmark = true }: BrandMarkProps) {
  const chip = CHIP[size];
  const mark = MARK[size];

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex flex-none items-center justify-center overflow-hidden rounded-control border border-border bg-white"
        style={{ width: chip, height: chip }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image
            is banned repo-wide (hard rule 2 in CLAUDE.md), kept uniform
            here rather than reached for only on the payment proof. */}
        <img src="/logo.jpeg" alt="" width={mark} height={mark} className="block object-contain" />
      </span>
      {showWordmark ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-ink">Arena Player</span>
          <span className="text-xs text-ink-muted">Admin</span>
        </span>
      ) : null}
    </div>
  );
}
