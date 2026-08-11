# Handover checkpoint — who owns the expiry scheduler

**Decided by:** the developer and the client together. It is an account, a cost, and an ongoing responsibility — none of which the build side can assign alone.
**Blocks:** Phase 3's Definition of Done · Phase 5 handover
**Status:** not yet held
**Format:** a short conversation with the client, held **before** the scheduler is configured, not after.
**Date held:** _____

## Why this is a gate

The expiry rule — a `pending` booking older than 24h becomes `expired` and frees the slot — is the only mechanism that returns abandoned slots to the public site. It runs from an HTTP call made by something outside both repos.

**A scheduler nobody owns is a scheduler that stops firing**, and the failure is silent in the worst way: nothing errors, no page breaks, and the public site slowly accumulates slots that appear taken forever. The first person to notice is a customer who cannot book a field that is empty.

This is deliberately not solved with `node-cron`. An in-process timer dies with a container restart, a redeploy, or an idle scale-down — silently — which trades a cache-starved expiry for a lifecycle-starved one and learns nothing. The trigger lives outside the app on purpose, and the price of that is that somebody has to own it.

The compensating control already built: the dashboard shows **"umur booking pending tertua"**, the age of the oldest pending booking. Over ~25h means the cron is not firing. It surfaces the symptom on the page the admin opens daily, with no schema and no infrastructure. **It is a detector, not a fix** — it tells whoever is looking that something is wrong, and this gate decides who that is and what they do next.

## Questions that must not be left unasked

### 1. Which scheduler? — **BLOCKS Phase 3 task 2**

Requirements are modest: an HTTP POST every 15 minutes with a bearer header, failure notification, and a visible run history.

| Candidate | Cost | Notes |
|---|---|---|
| `cron-job.org` | free | Purpose-built, has failure email and run history. The default recommendation |
| A crontab on any always-on machine running `curl` | free | Fine if such a machine exists and outlives the project. Usually it does not |
| Sumopod's own scheduler, if it has one | included | Best answer if it exists — one fewer account at handover. Check during `5-gate-subdomain` |

- Chosen: _____
- Reason: _____

### 2. Whose account? — **BLOCKS handover**

This is the actual question. A scheduler in the developer's personal account works perfectly until the developer moves on.

- Account owner during the build: _____
- Account owner after handover: _____
- If they differ: when does it transfer, and is that a handover checklist item? _____

### 3. Where does a failure notification go? — **BLOCKS Phase 3's Definition of Done**

A run history nobody reads is not monitoring.

- Failure email address: _____
- Is that address monitored by someone who knows what to do? _____
- Does the client know this alert exists and what it means? _____

### 4. What does the admin do when the oldest-pending age goes red? — **BLOCKS the user guide**

The dashboard indicator is useless if the person seeing it has no next action. This needs to be a sentence in the Indonesian user guide, not tribal knowledge.

- Immediate action (press "Jalankan sekarang"): _____
- Who they call: _____
- Written into the handover user guide? _____

### 5. Who holds `CRON_SECRET`, and what happens when it rotates?

Rotating it without updating the scheduler stops expiry silently — the endpoint starts returning 401 and nothing user-facing changes.

- Where is the value recorded at handover: _____
- Rotation procedure documented: _____

### 6. Is 15 minutes still right?

The rule is ">24h", so 15-minute granularity releases a slot at most 15 minutes late, at 96 requests a day. Confirm rather than assume; a free tier may impose a floor.

- Interval: _____
- Any provider minimum that changes it: _____

## Outcome — fill in during or immediately after

| Question | Answer |
|---|---|
| Scheduler | _____ |
| Account owner (build / after handover) | _____ |
| Failure notifications go to | _____ |
| Admin's action when the indicator goes red | _____ |
| `CRON_SECRET` custody + rotation | _____ |
| Interval | _____ |

### Sign-off

- ☐ Scheduler chosen, account owner named for both periods, notifications wired and tested
- ☐ Agreed with deviations — recorded above
- ☐ Deferred — **and Phase 3 cannot close**, because expiry has no trigger

**Signed off by:** _____
**Date:** _____

## After this gate

1. Record the answers in `docs/PRD.md` Phase 5 and in the handover user guide.
2. Trigger one failure deliberately — point the scheduler at a wrong path once — and confirm the notification actually arrives. An alert that has never fired is an alert nobody has tested, which is the same rule every check in this repo is held to.
