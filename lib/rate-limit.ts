/**
 * Minimal in-memory sliding-window rate limiter. Good enough to protect a
 * single-instance deployment from brute-force/spam on sensitive endpoints
 * (register, login, forgot-password, video generation).
 *
 * In a multi-instance production deployment, swap this for a shared store
 * (e.g. Upstash Redis) - the call sites (`checkRateLimit`) stay the same.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

export function getClientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
