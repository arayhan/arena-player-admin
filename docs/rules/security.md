# Security

How an agent handles secrets, credentials, and private payment documents while working in this repo — agent behaviour, not application design.

**Load when:** touching anything under `src/server/`, the login route, middleware, the proof view, or any file that names an environment variable.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) hard rule 3 — `DATABASE_URL` and the Supabase keys never reach the client; never `NEXT_PUBLIC_*`.
- [CLAUDE.md](../../CLAUDE.md) hard rule 2 — never `next/image` on a payment proof.
- [CLAUDE.md](../../CLAUDE.md) hard rule 8 — argon2 cannot run on Edge; the password compare stays in the Node login route.
- [docs/architecture.md](../architecture.md#auth) — the Edge/Node split, hashing, the session cookie, login rate limiting.
- [docs/architecture.md](../architecture.md#the-proof-read-path) — why the proof credential is separate and read-only, and why the presign TTL is what it is.
- [.env.local.example](../../.env.local.example) — the only place to learn which variables exist and what each one is for.

The reasoning behind each pointer lives at the link. This file does not repeat it.

## Never surface a secret

1. **Never read, open, or print `.env.local`.** It is deny-listed. When you need to know which variables exist or what one means, read `.env.local.example` instead.
2. Treat all of these as secret: the connection string, the Supabase anon key, the argon2id password hash, the session signing key, the cron bearer token, a session JWT, and a presigned URL.
3. Never write one into the transcript, a log line, a test fixture, a comment, a doc, a commit message, or a command you print. This includes partial values — a truncated key is still a key.
4. Never run a command whose output would contain one: no dumping the environment, no echoing a variable, no printing a `set-cookie` header's value. Assert on a _property_ instead — a prefix, a flag, a length, a status code.
5. Never put a real credential in an example file. `.env.local.example` carries empty values and comments; keep it that way.
6. When a demo or a test needs a value, make it obviously fake — a documentation-range IP, a self-describing placeholder string, a hash generated on the spot. The login route test is the pattern to copy.
7. Never pass a password as a command-line argument, and never write a plaintext password anywhere, including a comment. Use the prompting hash script — see architecture.md, "Hashing".

## New files under `src/server/`

8. Any new file here that reads an environment variable, holds a credential, or constructs a client starts with `import "server-only"` on the first line. `db.ts`, `storage.ts`, and every file under `auth/` do.
9. The only exemption is a module that holds no secret and reaches nothing — the pure schema-definition and string-parsing helpers. If you are unsure whether a new file qualifies, it does not; add the import.
10. Read credentials at first use, never at module scope. The lazy client construction in `db.ts` and `storage.ts` is what lets credential-free tests import these modules at all; an eager read at the top of the file breaks that with no visible failure.

## Presigned proof URLs

11. A presigned URL is a bearer capability for a payment document carrying a real person's name, amount, and bank transfer. Anyone holding it can fetch the document for its lifetime.
12. Mint it per render, hand it straight to a plain `<img>`, and let it expire. `presignProofUrl` is the only place one is ever created.
13. **Never persist one** — not in a database column, not in `localStorage`, not in a cache, not in a build artifact, not in a doc, not in a bug report, not in a screenshot you attach.
14. Never log one and never paste one into the transcript. When you need to show that presigning works, report the response status, the way the live setup check does — it fetches the URL and asserts the status code, never the URL.
15. The TTL is defined once, in `src/server/storage.ts`, and the number is a deliberate trade-off documented in architecture.md. Do not lengthen it to make a manual test more convenient.

## Auth surface

16. Authentication failures are uniform by design: an unset hash, a malformed hash, a wrong password, an expired token, and a forged token all look identical to the caller. Never add a response body, status, log line, or timing difference that lets them be told apart.
17. An unknown state is a closed door. A missing password hash must reject even the correct password — the login route test asserts this, and any new gate must hold to it.
18. Take the client IP from the **rightmost** `X-Forwarded-For` entry, the hop this app's own proxy appended. Everything to its left is attacker-supplied and rotates freely. Any new IP-keyed limit follows the same rule.
19. Middleware never touches a password (hard rule 8). If a change would pull the password module into the middleware's import graph — directly or transitively, through a barrel file or a shared helper — the change is wrong.

## When something has leaked

20. **Stop.** Do not commit, do not push, do not include the leaked value in your report or your next command.
21. Tell the human immediately: what leaked and where it now lives (file and line, or "in the output of an earlier command"), without reprinting the value.
22. Rotation is the human's call. Do not rotate, regenerate, or replace a credential on your own — rotating the session key logs the admin out, and rotating a Supabase key can break the sibling app.
23. If it already reached a commit, say so plainly. Deleting it in a follow-up commit does not remove it from history, and the human needs to know that before deciding.
