// A tiny in-memory rate limiter — perfect for a single-instance app on a Pi.
// Used to throttle failed login attempts (brute-force protection).
const store = new Map<string, { count: number; resetAt: number }>();

const LIMIT = 8; // failed attempts…
const WINDOW_MS = 15 * 60 * 1000; // …per 15 minutes

export function isRateLimited(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    store.delete(key);
    return false;
  }
  return entry.count >= LIMIT;
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string): void {
  store.delete(key);
}

// Generic fixed-window limiter (separate namespace from the login throttle).
// Returns true if the call is allowed, false if the key is over `limit` within
// `windowMs`. Used to throttle the client-error reporting endpoint per IP.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
