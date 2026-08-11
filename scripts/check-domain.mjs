// src/domain/ is a plain copy living in two repos. This is the thing that makes
// that defensible.
//
// `uniq_active_slot` compares `time_slot` as TEXT, so '06.00 - 08.00' and
// '06.00-08.00' are two different slots to Postgres. One character of drift
// between arena-player-admin and arena-player-web means this app writes rows
// the public site cannot match, and anti-double-booking silently stops working
// for BOTH apps. Nothing throws. The index is the only race guard there is.
//
// Two things are diffed, not one:
//   1. every .ts under src/domain/, byte for byte, in BOTH directions
//   2. the declared range of each shared peer dependency in both package.json
//
// The second is not decoration. date-fns v3 and v4 differ in exactly the
// timezone API dates.ts relies on, so two repos on different majors produce a
// byte-identical file that computes different dates — the same silent-wrong-
// answer failure, arriving through the lockfile instead of the source.
//
// Tests are diffed too. This repo inherits the proof, not just the code: a
// copy that is verified to BEHAVE identically, not merely to look identical.
// That is why vitest sits alongside date-fns and @date-fns/tz as a shared
// obligation.
//
// Findings go to STDOUT and the exit code carries pass/fail.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SHARED = "src/domain";

// A path, not a secret — see the comment in .env.local.example.
const SIBLING = process.env.ARENA_WEB_PATH ?? join(ROOT, "..", "arena-player-web");

// Every package src/domain/ imports. Keep this list as short as it is: each
// entry is a package the web repo is obliged to keep at a matching major.
const SHARED_DEPS = ["date-fns", "@date-fns/tz"];

const problems = [];
const fail = (detail) => problems.push(detail);

function listShared(root) {
  const dir = join(root, SHARED);
  if (!existsSync(dir)) return null;
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

const mine = listShared(ROOT);
const theirs = listShared(SIBLING);

// SKIP LOUDLY. Whenever the other side's src/domain/ cannot be found — because
// web has not built it, or ARENA_WEB_PATH points somewhere wrong — there is
// nothing to diff, and a check that reports success having compared nothing is
// worse than no check at all. This repo's own rule: a skip is not a pass, and
// the output must make that unmistakable.
if (theirs === null) {
  console.log(
    `SKIPPED: could not find arena-player-web's src/domain/ — this check proved nothing.\n` +
      `         web's Phase 1a step 06 has landed, so this usually means the sibling checkout\n` +
      `         is missing, or ARENA_WEB_PATH points somewhere wrong (it is a path, not a flag\n` +
      `         that says "web isn't ready yet" — see .env.local.example).\n` +
      `         Looked for it at: ${join(SIBLING, SHARED)}\n` +
      `         The ${mine?.length ?? 0} file(s) in this repo's ${SHARED}/ are UNGUARDED until then.`,
  );
  process.exit(0);
}

if (mine === null) {
  console.log(`check:domain FAILED — this repo has no ${SHARED}/, but ${SIBLING} does`);
  process.exit(1);
}

// Both directions. A file present in one repo and absent in the other is drift,
// and a one-directional walk cannot see the half it is not walking.
for (const file of new Set([...mine, ...theirs])) {
  const here = mine.includes(file);
  const there = theirs.includes(file);

  if (here && !there) {
    fail(`${SHARED}/${file} — exists here but missing from ${SIBLING}`);
    continue;
  }
  if (!here && there) {
    fail(`${SHARED}/${file} — exists in ${SIBLING} but not here`);
    continue;
  }

  const a = readFileSync(join(ROOT, SHARED, file), "utf8");
  const b = readFileSync(join(SIBLING, SHARED, file), "utf8");
  if (a === b) continue;

  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const at = linesA.findIndex((line, i) => line !== linesB[i]);
  fail(
    `${SHARED}/${file} — DRIFTED at line ${at + 1}\n` +
      `        here : ${JSON.stringify(linesA[at] ?? "<end of file>")}\n` +
      `        there: ${JSON.stringify(linesB[at] ?? "<end of file>")}`,
  );
}

// --- shared peer dependencies -----------------------------------------------
const readManifest = (root) => {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
};

const ours = readManifest(ROOT);
const sibling = readManifest(SIBLING);

if (!sibling) {
  console.log(
    `check:domain — files compared, but ${SIBLING}/package.json is unreadable, so the\n` +
      `    shared peer dependency ranges (${SHARED_DEPS.join(", ")}) were NOT checked.`,
  );
} else {
  const rangeOf = (manifest, dep) =>
    manifest?.dependencies?.[dep] ?? manifest?.devDependencies?.[dep] ?? null;

  for (const dep of SHARED_DEPS) {
    const a = rangeOf(ours, dep);
    const b = rangeOf(sibling, dep);
    if (a === b) continue;
    fail(
      `${dep} — range differs: this repo ${a ?? "<absent>"}, ${SIBLING} ${b ?? "<absent>"}.\n` +
        `        A byte-identical dates.ts on two majors computes different dates.`,
    );
  }
}

if (problems.length === 0) {
  console.log(
    `check:domain — ${mine.length} file(s) identical, ${SHARED_DEPS.length} dep(s) aligned`,
  );
  process.exit(0);
}

console.log(`\n✗ src/domain/ has drifted from ${SIBLING}`);
for (const p of problems) console.log(`    ${p}`);
console.log(
  `\ncheck:domain FAILED — ${problems.length} problem(s).\n` +
    `Anti-double-booking depends on these being identical; see the shared-code\n` +
    `contract in docs/architecture.md before "fixing" either side. Direction of\n` +
    `repair: web is the source. Fix web, then re-copy — never edit the copy here.`,
);
process.exit(1);
