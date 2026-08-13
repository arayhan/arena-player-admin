import type { ReactNode } from "react";

// Server Component. The one surface container every screen composes with —
// bg-surface/border-border/rounded-panel per DESIGN.md's `row`/`panel`
// tokens, swapped automatically by the semantic tier in globals.css.

type PanelProps = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, action, children, className = "" }: PanelProps) {
  return (
    <section className={`rounded-panel border border-border bg-surface p-6 ${className}`}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
