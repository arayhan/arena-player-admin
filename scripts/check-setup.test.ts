/**
 * `pnpm check:setup` — the live preflight. Credentials required
 * (`DATABASE_URL` + the Supabase Storage values in `.env.local`). Proves the
 * connections this app depends on actually work, rather than only that the
 * client code compiles. See docs/architecture.md, "Verification practice".
 */
import { describe, expect, it } from "vitest";

import { sql } from "@/server/db";
import { presignProofUrl } from "@/server/storage";

describe("check:setup — live preflight", () => {
  it("Supabase Postgres is reachable on the transaction pooler", async () => {
    const rows = (await sql`select 1 as ok`) as unknown as Array<{ ok: number }>;
    expect(rows.length).toBe(1);
    expect(rows[0]?.ok).toBe(1);
  });

  /**
   * The point is not that the probe object exists — it certainly does not.
   * The point is distinguishing a VALID credential that simply cannot find
   * the key from an INVALID one that is rejected before the lookup ever
   * happens. A bare "the call didn't throw" would pass with a wrong key.
   *
   * ASSUMPTION FLAGGED — CONFIRM ON THE FIRST LIVE RUN. Under R2 this was a
   * clean 404-vs-403 split on the signed GET. Supabase Storage may instead
   * fail at `createSignedUrl` for a missing object, and its exact status and
   * message are NOT verified here. So this asserts the property that holds
   * either way — the failure must not be an auth failure — and the precise
   * shape gets pinned down the first time this runs against a real project.
   */
  it("Supabase Storage credentials are valid and a signed GET round-trips", async () => {
    const probeKey = `check-setup-probe/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const credentialHint =
      "Check SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_PROOFS_BUCKET in .env.local, " +
      "and that the RLS select policy on storage.objects covers this bucket.";

    let signedUrl: string | null = null;
    let signingError: string | null = null;
    try {
      signedUrl = await presignProofUrl(probeKey);
    } catch (error) {
      signingError = error instanceof Error ? error.message : String(error);
    }

    if (signingError !== null) {
      // Signing refused. Acceptable only if it refused because the object is
      // absent — never because the credential was rejected.
      expect(
        /not.?found|does not exist|no such/i.test(signingError),
        `signing a probe key failed for a reason that is not "object missing": ${signingError}. ${credentialHint}`,
      ).toBe(true);
      return;
    }

    const response = await fetch(signedUrl!);

    expect(
      response.status === 401 || response.status === 403,
      `the signed URL was rejected as unauthorized (${response.status}). ${credentialHint}`,
    ).toBe(false);

    expect(
      response.ok,
      `a probe key that cannot exist returned ${response.status} OK — the bucket or key prefix is not what this app expects. ${credentialHint}`,
    ).toBe(false);
  });
});
