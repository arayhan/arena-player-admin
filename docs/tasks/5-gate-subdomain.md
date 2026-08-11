# Client / host checkpoint — `admin.arena-player.com`

**Decided by:** the client's hosting account, and Sumopod's capabilities. Nobody on the build side can answer these.
**Blocks:** admin Phase 5 entirely · and, indirectly, Phase 3's scheduler, which needs a stable production URL to call
**Status:** not yet held
**Format:** a check against the Sumopod account, then a decision if the answer is no.
**Date held:** _____

## What is open

Carried over from `arena-player-web/docs/PRODUCT.md:59` and `docs/PRD.md:462`, where it was recorded as an open question during planning:

> Open questions: subdomain configuration on Sumopod — only Node capability was confirmed, and subdomains matter for `admin.arena-player.com` in the other repo.

At the time it affected one thing: where the admin app would live. It now affects two, because the expiry scheduler needs a stable authenticated URL to POST to every 15 minutes, and that URL is the public site's launch dependency.

**Hold this gate early.** It is a question about someone else's hosting account, and the answer may be "no" — in which case a fallback has to be chosen and implemented, not discovered at deploy.

## Questions that must not be left unasked

### 1. Does the Sumopod plan support a second Node app on a subdomain? — **BLOCKS Phase 5**

Only Node capability was confirmed during planning. Two apps, two ports, one domain is a different question from "does Node run".

- Second Node app supported on this plan? _____
- Subdomain routing available, or is it path-based only? _____
- Any additional cost? _____ _(a fixed-budget freelance project — a per-app charge is a client decision, not a technical one)_

### 2. Is HTTPS available on the subdomain? — **BLOCKS Phase 5, hard**

Not cosmetic. The session cookie is `Secure`, so **it will not be set over plain HTTP** and login will fail in a way that looks like a wrong password. Automatic certificate provisioning on a subdomain is a separate feature from having it on the apex.

- HTTPS on `admin.arena-player.com`? _____
- Automatic renewal, or manual? _____ _(manual renewal is a handover item with a calendar date attached)_

### 3. Who controls the DNS? — **BLOCKS the subdomain existing at all**

- Registrar / DNS provider: _____
- Who has access today: _____
- Who has it after handover: _____

### 4. If the answer to 1 or 2 is no — which fallback? — **BLOCKS Phase 5**

Decide here rather than at deploy. Three options, in preference order:

| Option                                                            | Cost                        | Consequence                                                                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path-based on the same host — `arena-player.com/admin`            | none                        | Two apps behind one origin, or the admin merged into web's deploy. **The second reverses the separate-repo decision**; the first needs a reverse proxy the plan may not offer |
| A different host for the admin app only                           | a second small hosting bill | Cleanest technically. Two accounts at handover instead of one                                                                                                                 |
| A subdomain on a domain the developer controls, transferred later | none now                    | Works, but the credential handover then includes a domain, and "later" has a way of not arriving                                                                              |

- Fallback chosen: _____
- Reason: _____

### 5. What URL does the scheduler call? — **BLOCKS Phase 3's completion**

The expiry cron must point at production, not at a staging or preview URL. If the URL changes after the scheduler is configured, expiry silently stops and the only symptom is the dashboard's oldest-pending age creeping past 25 hours.

- Final production URL for `POST /api/jobs/expire`: _____
- Confirmed the scheduler was repointed after the final deploy? _____

## Outcome — fill in during or immediately after

| Question                              | Answer |
| ------------------------------------- | ------ |
| Subdomain supported                   | _____  |
| HTTPS available                       | _____  |
| DNS controller (now / after handover) | _____  |
| Fallback chosen, if needed            | _____  |
| Final expiry endpoint URL             | _____  |

### Sign-off

- ☐ `admin.arena-player.com` confirmed available over HTTPS — proceed as planned
- ☐ Fallback adopted — recorded above, and `docs/PRD.md` Phase 5 updated to match
- ☐ Blocked — client action needed before Phase 5 can start

**Signed off by:** _____
**Date:** _____

## After this gate

1. Update `docs/PRD.md` Phase 5 and `docs/PRODUCT.md`'s open-decisions list with the answer.
2. Tell the web repo: `arena-player-web/docs/PRODUCT.md:59` and `docs/PRD.md:462` both still carry this as open, and one of them is where the next person will look.
3. If a fallback was adopted, `5-gate-cron-owner.md`'s endpoint URL changes with it.
