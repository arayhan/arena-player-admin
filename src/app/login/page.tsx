import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { WINDOW_MINUTES } from "@/server/auth/rate-limit";

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
    // The wait is interpolated, never written as a literal: the admin is at
    // the field with a customer waiting, and a wait stated wrongly is worse
    // than one not stated at all.
    //
    // Problem first, then the way out. This is the highest-stakes state in
    // the app — one account, no reset, no MFA — so it says plainly that the
    // lock is temporary and names when it lifts. It does not apologise and
    // it does not soften: a security surface that gets chatty on failure
    // reads as one that is not sure what it is doing.
    return `Terlalu banyak percobaan. Masuk dikunci ${WINDOW_MINUTES} menit, setelah itu bisa dicoba lagi.`;
  }
  if (error === "empty") {
    return "Kata sandi belum diisi.";
  }
  if (error === "invalid") {
    return "Kata sandi salah.";
  }
  return null;
}

// Mirrors DEV_LOGIN_BYPASS in src/app/api/auth/login/route.ts. The form must
// not silently claim to want a password it will accept anything in place of.
const DEV_LOGIN_BYPASS = process.env.NODE_ENV === "development";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(error);

  return (
    // `bg-login-plate` is the client's own navy behind the card in light mode,
    // and the unchanged dark ground in dark mode — see the token's comment in
    // globals.css for the measurements behind that split. Nothing textual sits
    // on the plate; the card keeps `surface`, so every contrast pair in here is
    // the one it already was.
    <main className="flex flex-1 items-center justify-center bg-login-plate px-4 py-10">
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-8">
        {/* The mark alone — the wordmark is off because the <h1> and the line
            under it already name the app, and the same words twice in one
            card reads as a bug rather than as brand. */}
        <BrandMark size="lg" showWordmark={false} />
        <h1 className="mt-6">Masuk</h1>
        <p className="mt-1 text-sm text-ink-muted">Arena Player — back office admin.</p>

        {/* No `noValidate`: the input's `required` is the cheapest guard there
            is. It stops an empty submit in the browser, before a request that
            would otherwise have cost the admin one of their attempts. The
            route still refuses an empty password on its own — this is the
            first of two fences, not the only one. */}
        <form method="POST" action="/api/auth/login" className="mt-6 flex flex-col gap-4">
          <Field
            label="Kata sandi"
            htmlFor="password"
            hint={
              DEV_LOGIN_BYPASS
                ? "Mode pengembangan: kata sandi apa pun diterima."
                : "Kata sandi admin diberikan saat serah terima."
            }
          >
            {/* border-color at 150ms is the whole motion budget DESIGN.md
                allows, and it is spent here because this is the only control
                on the page. The global :focus-visible ring in globals.css
                sits on top of this and is NOT replaced by it. */}
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-describedby={message ? "password-hint login-error" : "password-hint"}
              aria-invalid={message ? true : undefined}
              className="h-11 rounded-control border border-input-border bg-surface px-3 text-body text-ink transition-colors duration-150 hover:border-ink-muted focus:border-accent"
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
