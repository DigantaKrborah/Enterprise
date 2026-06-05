// In-memory sliding-window rate limiter.
// Fine for single-process demo. Replace with Redis for multi-instance.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Returns true if the request is allowed, false if it should be blocked.
export function rateLimit(key: string, limitPerWindow: number, windowSeconds: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (bucket.count >= limitPerWindow) return false;

  bucket.count += 1;
  return true;
}

// Pre-configured limiters matching PRD values
export const chatRateLimit   = (userId: string) => rateLimit(`chat:${userId}`,   10, 60);
export const uploadRateLimit = (userId: string) => rateLimit(`upload:${userId}`, 20, 60);
export const authRateLimit   = (ip: string)     => rateLimit(`auth:${ip}`,       10, 60);
