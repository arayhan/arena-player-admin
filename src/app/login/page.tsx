import type { Metadata } from "next";

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
    <main className="flex flex-1 items-center justify-center bg-grey-50 px-4">
      <div className="w-full max-w-sm rounded-panel border border-grey-200 bg-white p-8">
        <h1>Masuk</h1>
        <p className="mt-1 text-sm text-navy-400">Arena Player — back office admin.</p>

        <form
          method="POST"
          action="/api/auth/login"
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-navy-900">
              Kata sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-describedby={message ? "login-error" : undefined}
              aria-invalid={message ? true : undefined}
              className="rounded-control border border-grey-200 px-3 py-2 text-body"
            />
          </div>

          {message ? (
            <div
              id="login-error"
              role="alert"
              tabIndex={-1}
              autoFocus
              className="rounded-control border border-red-600 bg-red-100 px-3 py-2 text-sm text-red-800"
            >
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            className="h-10 rounded-control bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-700"
          >
            Masuk
          </button>
        </form>
      </div>
    </main>
  );
}
