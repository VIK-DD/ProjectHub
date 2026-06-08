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
