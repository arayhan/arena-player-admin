import type { Metadata } from "next";

import { Button } from "@/components/button";
import { Field } from "@/components/field";

// Server Component. No client-side JS: the form posts to
// `/api/auth/login` as a plain HTML `<form>`, and a failed login redirects
// back here with `?error=...` so the error copy and the focus move on
// reload rather than needing a hook. See src/app/api/auth/login/route.ts's
// `wantsHtml()` for the content-negotiation this depends on, and
// docs/tasks/1a-step-07-auth.md: the only client component in v1 is the
// proof-image reload button, not this page.

export const metadata: Metadata = {
  title: "Masuk — Arena Player Admin",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function errorMessage(error: string | undefined): string | null {
  if (error === "rate_limited") {
    return "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit.";
  }
  if (error === "invalid") {
    return "Kata sandi salah.";
  }
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(error);

  return (
    <main className="flex flex-1 items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-8">
        <h1>Masuk</h1>
        <p className="mt-1 text-sm text-ink-muted">Arena Player — back office admin.</p>

        <form
          method="POST"
          action="/api/auth/login"
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <Field label="Kata sandi" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-describedby={message ? "login-error" : undefined}
              aria-invalid={message ? true : undefined}
              className="h-10 rounded-control border border-input-border bg-surface px-3 text-body text-ink"
            />
          </Field>

          {message ? (
            <div
              id="login-error"
              role="alert"
              tabIndex={-1}
              autoFocus
              className="rounded-control border border-red-border bg-red-bg px-3 py-2 text-sm text-red-ink"
            >
              {message}
            </div>
          ) : null}

          <Button type="submit">Masuk</Button>
        </form>
      </div>
    </main>
  );
}
