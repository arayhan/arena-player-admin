import type { Metadata } from "next";
import { headers } from "next/headers";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { getClientIp } from "@/server/auth/client-ip";
import { peekRateLimit } from "@/server/auth/rate-limit";

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

async function errorMessage(error: string | undefined): Promise<string | null> {
  if (error === "rate_limited") {
    // THE NUMBER IS MEASURED AT RENDER TIME, NOT THE WINDOW LENGTH. The window
    // is anchored to the FIRST attempt and never extended, so `WINDOW_MS` — the
    // value this string used to interpolate — is the length of the window and
    // not the length of the wait. Five attempts spread over fourteen minutes
    // left one minute on the clock while this line said fifteen. The admin is
    // at the field with a customer waiting: a wait stated wrongly is worse than
    // one not stated at all, and this one overstated it in the only direction
    // that makes them give up and walk away.
    //
    // `headers()` is awaited only in this branch, so an ordinary /login render
    // does none of this work. The IP comes from the same `getClientIp` the
    // login route records against — see that file for why the two must not
    // drift apart.
    const remainingMs = peekRateLimit(getClientIp(await headers()));

    if (remainingMs === null) {
      // No lock this process can see. Usually the window has simply passed;
      // it is also what a restarted process reports, since the counter lives
      // in memory. "Sebentar lagi" is true under every one of those states,
      // which a number would not be — and inventing one here would be the
      // exact defect this branch exists to remove.
      return "Terlalu banyak percobaan. Coba lagi sebentar lagi.";
    }

    // CEIL, NEVER ROUND. Rounding 90s down to "1 menit" sends the admin back to
    // a door that is still shut, and the second failed attempt is the one that
    // makes them stop trusting the message. Ceil bottoms out at 1, so there is
    // no "0 menit". Indonesian does not inflect for plural, so one string
    // serves 1 and 14 alike.
    const minutes = Math.ceil(remainingMs / 60_000);

    // Problem first, then the way out. This is the highest-stakes state in
    // the app — one account, no reset, no MFA — so it says plainly that the
    // lock is temporary and names when it lifts. It does not apologise and
    // it does not soften: a security surface that gets chatty on failure
    // reads as one that is not sure what it is doing.
    return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
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
  const message = await errorMessage(error);

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
            hint={DEV_LOGIN_BYPASS ? "Mode pengembangan: kata sandi apa pun diterima." : undefined}
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
              // FOCUS LANDS ON THE FIELD TO RETYPE, NOT ON THE TEXT EXPLAINING
              // WHY. This used to sit on the error box below, which is static
              // text after the input in DOM order: Tab from it went FORWARD to
              // the submit button and skipped the input entirely, so recovering
              // from a failed login cost a Shift+Tab backwards — on the one
              // screen where failure is the expected case (WCAG 2.4.3).
              //
              // The error is still announced on arrival: `aria-describedby`
              // names it, and focusing a control reads its description out with
              // it.
              //
              // Only on failure. A clean /login does not steal focus, which on
              // a phone would open the keyboard over a page the admin may have
              // opened for another reason.
              autoFocus={Boolean(message)}
              autoComplete="current-password"
              aria-describedby={
                message
                  ? DEV_LOGIN_BYPASS
                    ? "login-error password-hint"
                    : "login-error"
                  : DEV_LOGIN_BYPASS
                    ? "password-hint"
                    : undefined
              }
              aria-invalid={message ? true : undefined}
              className="h-11 rounded-control border border-input-border bg-surface px-3 text-body text-ink transition-colors duration-150 hover:border-ink-muted focus:border-accent"
            />
          </Field>

          {/* NOT FOCUSED, AND NOT FOCUSABLE. The input above claims focus and
              names this box in its `aria-describedby`, so the message is read
              out with the control the admin has to use — putting focus here
              instead only added a keystroke on the way back to the field.

              `role="alert"` stays, but it is NOT what announces this today: an
              alert fires when a live region is inserted, and this arrives on a
              full page load (POST → 303 → GET) where the box is present at
              parse time. It is here so the announcement survives if this ever
              becomes a client-side render. Do not delete the focus above on
              the strength of this role. */}
          {message ? (
            <div
              id="login-error"
              role="alert"
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
