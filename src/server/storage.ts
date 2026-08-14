import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Bearer capability for a payment document — 120s, not 15 minutes. It leaks
 * through browser history and the `Referer` header; two minutes covers a
 * slow connection loading the image plus a brief tab-away. See
 * docs/architecture.md, "The proof read path". */
export const PROOF_URL_TTL_SECONDS = 120;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.local.example to .env.local and fill in the Supabase Storage values (docs/database.md).`,
    );
  }
  return value;
}

let client: SupabaseClient | undefined;

/**
 * Lazily constructed for the same reason as `src/server/db.ts`'s client:
 * importing this module must never throw just because `.env.local` is absent,
 * so credential-free tests stay credential-free.
 *
 * Signed with the ANON key, never `service_role`. The bucket is private and an
 * RLS `select` policy on `storage.objects` scoped to it is what lets the anon
 * key read — which keeps this credential read-only by construction. Three
 * reasons that matters, unchanged from when it was a separate read-only token:
 * an admin-side compromise cannot delete or overwrite payment evidence; web's
 * key reaches the client at handover, so one shared key means one rotation
 * breaks two apps; and this app has no legitimate reason to ever write.
 * `service_role` is full-access and would discard all three silently.
 *
 * No session is ever established — this client only signs URLs.
 */
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Mints a signed GET for a private payment proof. `key` is the object KEY
 * stored in `bookings.proof_key` — never a URL, since the bucket has none
 * (docs/database.md). Minted fresh per page render; never cached, never
 * stored, never reused past its `PROOF_URL_TTL_SECONDS` window.
 *
 * The caller hands this straight to a plain `<img src>`. NEVER `next/image`
 * — see CLAUDE.md hard rule 2 and docs/architecture.md, "The proof read path".
 */
export async function presignProofUrl(key: string): Promise<string> {
  const bucket = requireEnv("SUPABASE_PROOFS_BUCKET");
  const { data, error } = await getClient()
    .storage.from(bucket)
    .createSignedUrl(key, PROOF_URL_TTL_SECONDS);

  // Throws rather than returning a falsy URL: an empty `<img src>` renders as
  // a broken image with no explanation, which is the swallowed-error failure
  // docs/dev-rules.md forbids. The caller renders a visible failed state.
  if (error || !data?.signedUrl) {
    throw new Error(`Could not sign a proof URL: ${error?.message ?? "no URL returned"}`);
  }
  return data.signedUrl;
}
