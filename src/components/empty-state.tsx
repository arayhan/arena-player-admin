import type { ReactNode } from "react";

// Server Component. One shape for "nothing to show" — an empty queue, a
// missing-migration screen, a search with no results — so every screen
// that needs a placeholder reaches for this instead of hand-rolling one.

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-border bg-surface px-6 py-12 text-center">
      <h2>{title}</h2>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
