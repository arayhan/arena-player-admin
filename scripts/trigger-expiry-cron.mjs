#!/usr/bin/env node

/**
 * scripts/trigger-expiry-cron.mjs
 *
 * Manual or scheduled CLI runner to invoke the auto-expiry endpoint.
 * Useful for local testing, GitHub Actions cron workflows, or external schedulers.
 *
 * Usage:
 *   node scripts/trigger-expiry-cron.mjs
 *   ADMIN_URL=https://admin.arenaplayer.com CRON_SECRET=... node scripts/trigger-expiry-cron.mjs
 */

const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET || "cron_secret_arena_player_dev_2026";

async function run() {
  const targetEndpoint = `${adminUrl.replace(/\/$/, "")}/api/jobs/expire`;
  console.log(`[cron] Invoking auto-expiry job at: ${targetEndpoint}`);

  try {
    const res = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const status = res.status;
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`[cron] Success (${status}):`, JSON.stringify(body, null, 2));
    } else {
      console.error(`[cron] Failed with status ${status}:`, JSON.stringify(body, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error("[cron] Network error triggering expiry job:", error);
    process.exit(1);
  }
}

run();
