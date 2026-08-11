import { argon2id } from "hash-wasm";
import { describe, expect, it } from "vitest";

import { verifyPassword } from "./password";

/**
 * No credentials, no env var, no network — this proves the compare logic
 * itself, independent of ADMIN_PASSWORD_HASH ever being set. The login
 * route (src/app/api/auth/login/route.ts) is what wires this to the real
 * env var and is exercised separately in that route's own test.
 */
describe("verifyPassword", () => {
  it("accepts the correct plaintext against its own argon2id hash", async () => {
    const hash = await argon2id({
      password: "correct horse battery staple",
      salt: Buffer.alloc(16, 7),
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: "encoded",
    });

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong plaintext against a valid hash", async () => {
    const hash = await argon2id({
      password: "correct horse battery staple",
      salt: Buffer.alloc(16, 7),
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: "encoded",
    });

    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("never throws on a malformed hash — returns false instead", async () => {
    await expect(verifyPassword("anything", "not-an-argon2-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});
