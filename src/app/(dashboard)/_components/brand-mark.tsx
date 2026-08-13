// Server Component, colocated under (dashboard) rather than src/components/:
// it has exactly one consumer, the dashboard shell's own layout, used twice
// within it (sidebar header, mobile top bar) — not a cross-module primitive.
//
// Plain <img>, never next/image — same rule as the payment proof (hard
// rule 2), kept uniform rather than reached-for only where it is load-
// bearing.
//
// The white chip behind the mark is a deliberate, narrow exception to
// "colour comes only from the semantic tier": logo.jpeg is a flat JPEG
// with no alpha, painted on white by the source asset itself, not a
// themable surface. A navy mark directly on the dark `surface`
// (#0C1830, itself near-navy) would be close to invisible — the chip has
// to stay light in both themes for the mark to read at all. The mockup's
// own `.brand-mark` carries the same unconditional #ffffff.

type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const chip = size === "sm" ? 32 : 36;
  const mark = size === "sm" ? 24 : 28;

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
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink">Arena Player</span>
        <span className="text-xs text-ink-muted">Admin</span>
      </span>
    </div>
  );
}
