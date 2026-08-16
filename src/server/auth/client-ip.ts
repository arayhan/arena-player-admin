import "server-only";

/**
 * The subset of `Headers` this needs, so both callers pass their own bag
 * unchanged: `NextRequest.headers` in the login route handler, and the
 * `ReadonlyHeaders` that `next/headers` hands a Server Component. Typing it
 * structurally rather than as `Headers` keeps this file free of any request
 * shape — it reads two header names and knows nothing else.
 */
type HeaderBag = { get(name: string): string | null };

/**
 * Takes the RIGHTMOST `X-Forwarded-For` entry, not the leftmost. Every hop
 * a request passes through APPENDS its own view of the client to this
 * header — the leftmost entry is whatever the original caller claimed to
 * be, which is attacker-controlled and free to rotate on every request,
 * defeating the rate limiter entirely (or, run in reverse, letting an
 * attacker spoof the real admin's IP to lock them out for 15 minutes). The
 * rightmost entry is the one hop closest to this process, appended by
 * infrastructure this app trusts (its own reverse proxy), not by the
 * client.
 *
 * ASSUMPTION FLAGGED FOR PHASE 5: this repo has no documented Sumopod
 * deployment notes confirming what header its edge/proxy layer sets or
 * whether it appends to `X-Forwarded-For` at all (a platform-provided
 * header, if one exists, would be a stronger signal than any hop count in
 * a client-supplied header). Rightmost-XFF is the safer default absent
 * that confirmation. Whoever runs step 08 / Phase 5 against the real
 * platform must verify this against an actual multi-hop request and
 * correct it here if Sumopod's proxy behaves differently.
 *
 * IT LIVES HERE RATHER THAN IN THE LOGIN ROUTE because two surfaces now key on
 * it and they must agree: the route records an attempt against this IP, and the
 * login page reads that same IP's lockout back out to tell the admin how long
 * is left. Two copies of this rule would put the counter and the countdown on
 * different keys, and nothing would throw — the page would simply never find
 * the bucket the route had just filled.
 */
export function getClientIp(headers: HeaderBag): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    return hops[hops.length - 1]!.trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
