import type { ButtonHTMLAttributes } from "react";

// Server Component — a styled <button>, nothing more. No client state lives
// here; the caller (a form, a Server Action, a client island elsewhere)
// decides what onClick/type does.

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

// Lookup objects, not a conditional class expression — same reason
// StatusPill is a lookup keyed by the four DB states: docs/architecture.md
// rejects clsx/tailwind-merge by name, and a lookup is the plain-Tailwind
// substitute for both.
//
// Colour comes from bg-accent/text-accent-ink/hover:bg-accent-hover rather
// than DESIGN.md's original navy-900/navy-700 button-primary recipe: that
// recipe predates the dark-mode semantic layer and does not swap themes —
// a navy-900 button on the dark `surface` (#0C1830) nearly disappears.
// `accent` is the one primary-action colour the dark-mode token table
// actually defines for both themes (docs/DESIGN.md "Dark mode" section).
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  ghost: "bg-transparent text-ink hover:bg-border",
  danger: "border border-red-border bg-surface text-red-ink hover:bg-red-bg",
};

// Heights are floored by the 44px touch target dev-rules.md asks for: the
// admin works this app one-handed on a phone at the field, not at a desk.
// `md` is the default and carries the login submit, so it is exactly 44px.
// `sm` keeps a 36px ink box — the dense surfaces it is meant for cannot
// afford a taller control — and reaches 44px with a transparent
// pseudo-element that overflows the box without moving anything around it.
const SIZE_CLASSES: Record<Size, string> = {
  sm: "relative h-9 px-3 text-sm before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-body",
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:bg-grey-bg disabled:text-ink-muted disabled:hover:bg-grey-bg ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

export type { ButtonProps, Variant as ButtonVariant, Size as ButtonSize };
