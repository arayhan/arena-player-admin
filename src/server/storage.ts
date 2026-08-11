import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * R2 (Cloudflare) rejects the AWS SDK's default flexible-checksum headers on
 * some paths. `responseChecksumValidation` is the READ-side half, and this
 * app only reads — leaving it at the SDK default makes GETs fail validation
 * in a way that looks like a credentials problem and is not. Both flags set
 * identically to web's client so the two never diverge for no reconstructable
 * reason. See docs/database.md.
 */
const CHECKSUM_CONFIG = {
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
} as const;

/** Bearer capability for a payment document — 120s, not 15 minutes. It leaks
 * through browser history and the `Referer` header; two minutes covers a
 * slow connection loading the image plus a brief tab-away. See
 * docs/architecture.md, "The R2 read path". */
export const PROOF_URL_TTL_SECONDS = 120;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.local.example to .env.local and fill in R2's read-only credentials (docs/database.md).`,
    );
  }
  return value;
}

let client: S3Client | undefined;

/**
 * Lazily constructed for the same reason as `src/server/db.ts`'s Neon
 * client: importing this module must never throw just because
 * `.env.local` is absent, so credential-free tests stay credential-free.
 */
function getClient(): S3Client {
  if (!client) {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
      ...CHECKSUM_CONFIG,
    });
  }
  return client;
}

/**
 * Mints a presigned GET for a private payment proof. `key` is the R2 object
 * KEY stored in `bookings.proof_key` — never a URL, since the bucket has
 * none (docs/database.md). Minted fresh per page render; never cached,
 * never stored, never reused past its `PROOF_URL_TTL_SECONDS` window.
 *
 * The caller hands this straight to a plain `<img src>`. NEVER `next/image`
 * — see CLAUDE.md hard rule 2 and docs/architecture.md, "The R2 read path".
 */
export async function presignProofUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: requireEnv("R2_BUCKET"),
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn: PROOF_URL_TTL_SECONDS });
}
