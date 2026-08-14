import type { ReactNode } from "react";

// Server Component. Layout only — label + the caller's own input + an
// optional hint/error line. The input itself stays the caller's, so this
// works for a plain <input>, a <select>, or anything else without Field
// needing to know about every control's props.
//
// The hint and error lines carry `<htmlFor>-hint` / `<htmlFor>-error` ids so
// the caller can name them in the control's `aria-describedby`. Field cannot
// set that itself — the control belongs to the caller — and an unassociated
// hint is markup a screen reader never reaches. See docs/dev-rules.md,
// "Accessibility baseline".

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-red-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
