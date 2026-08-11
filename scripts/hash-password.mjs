#!/usr/bin/env node
// Prints an argon2id hash for `ADMIN_PASSWORD_HASH`. Reads the plaintext
// from a prompt, never from argv (a process listing or shell history would
// otherwise carry it) and never writes the plaintext anywhere — not to a
// file, not to a log, not to this comment. Same cost parameters as
// docs/architecture.md's inline one-liner: parallelism 1, iterations 3,
// memorySize 65536 (64 MiB), hashLength 32. See docs/architecture.md,
// "Hashing: hash-wasm, not @node-rs/argon2".
//
// Prints TWO forms. Next.js's built-in .env loader expands `$name` in a
// value by looking up another env var called `name` — an argon2id hash is
// entirely `$`-delimited fields, so pasting it into `.env.local` unescaped
// gets silently mangled into a short garbage string that never matches any
// password, and the failure looks exactly like "wrong password" with no
// error anywhere to find it. The second line below is pre-escaped and is
// the one to paste.
//
// Usage:
//   node scripts/hash-password.mjs
//   > paste the password at the prompt, press Enter

import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { argon2id } from "hash-wasm";

async function readPasswordHidden(promptText) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Suppress terminal echo so the plaintext never lands in scrollback.
  const output = process.stdout;
  let muted = false;
  const originalWrite = output.write.bind(output);
  rl._writeToOutput = (chunk) => {
    if (!muted) originalWrite(chunk);
  };

  originalWrite(promptText);
  muted = true;
  const password = await rl.question("");
  muted = false;
  originalWrite("\n");
  rl.close();
  return password;
}

async function main() {
  const password = await readPasswordHidden("Password: ");
  if (!password) {
    console.error("No password entered. Nothing hashed.");
    process.exitCode = 1;
    return;
  }

  const hash = await argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "encoded",
  });

  console.log("\nHash:");
  console.log(hash);
  console.log("\nPaste into .env.local (every $ pre-escaped as \\$):");
  console.log(`ADMIN_PASSWORD_HASH=${hash.replaceAll("$", "\\$")}`);
}

main();
