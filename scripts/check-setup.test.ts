/**
 * `pnpm check:setup` — the live preflight. Credentials required
 * (`DATABASE_URL` + the four R2 vars in `.env.local`). Proves the
 * connection this app depends on actually works, rather than only that the
 * client code compiles. See docs/architecture.md, "Verification practice".
 */
import { describe, expect, it } from "vitest";

import { sql } from "@/server/db";
import { presignProofUrl } from "@/server/storage";

describe("check:setup — live preflight", () => {
  it("Neon is reachable on the pooled connection string", async () => {
    const rows = (await sql`select 1 as ok`) as Array<{ ok: number }>;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it("R2 credentials are valid and a presigned GET round-trips", async () => {
    // A key that certainly does not exist. The point is not that the object
    // is there — the point is distinguishing a VALID credential that never
    // finds the key (404 NoSuchKey, from R2 itself) from an INVALID one that
    // never gets that far (403, rejected before the key lookup). A bare
    // "the request didn't throw" would also pass with a wrong key.
    const probeKey = `check-setup-probe/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = await presignProofUrl(probeKey);

    const response = await fetch(url);

    expect(
      response.status,
      `expected 404 (valid credentials, missing probe key) — R2 responded ${response.status}. ` +
        `Check R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET in .env.local.`,
    ).toBe(404);
  });
});
