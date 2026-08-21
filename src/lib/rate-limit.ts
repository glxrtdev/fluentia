import 'server-only'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Small in-process limiter. Enough to blunt credential stuffing and runaway
 * API usage on a single-instance deployment; swap for Redis if this ever runs
 * on more than one node.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}

// Keep the map from growing without bound in long-lived processes.
const globalForSweep = globalThis as { __fluentiaRateLimitSweep?: NodeJS.Timeout }
if (!globalForSweep.__fluentiaRateLimitSweep) {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
  }, 5 * 60_000)
  timer.unref()
  globalForSweep.__fluentiaRateLimitSweep = timer
}
