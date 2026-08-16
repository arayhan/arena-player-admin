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
   * ASSUMPTION NOW CONFIRMED, on the first live run against the real project
   * (2026-08-16). Supabase Storage fails at `createSignedUrl`, not on the GET:
   * it returns `StorageApiError { message: "Object not found", status: 400 }`,
   * so the R2-era 404-vs-403 split on the signed URL never happens and the
   * `signingError` branch below is the one that actually executes.
   *
   * AND THE PART THAT MATTERS MORE, MEASURED THE SAME WAY: a bucket that does
   * not exist AT ALL returns that byte-identical error. Probed both together —
   * the configured bucket and `definitely-not-a-real-bucket` — and the two
   * responses were indistinguishable.
   *
   * So this test CANNOT PROVE THE BUCKET EXISTS, and must not be read as
   * saying so. It proves exactly one thing: the credential is valid and is not
   * being rejected before the lookup. A wrong `SUPABASE_PROOFS_BUCKET` passes
   * here and then makes every proof_key render as the expired-link recovery —
   * the failure .env.local.example warns about.
   *
   * Not tightened with a `listBuckets()` assertion on purpose: bucket listing
   * is RLS-gated for the anon/publishable key, so it returns an empty list
   * both when the bucket is absent and when it exists without a
   * `storage.buckets` select policy. That check would go permanently red on a
   * correctly-working project, which is worse than the gap. Proving the bucket
   * needs a known fixture object to sign against — see docs/PROGRESS.md.
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
