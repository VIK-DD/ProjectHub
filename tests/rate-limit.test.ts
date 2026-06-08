import assert from "node:assert/strict";
import { test } from "node:test";

import { rateLimit } from "../lib/rate-limit";

test("rateLimit allows up to the limit then blocks within the window", () => {
  const key = `rl-${Math.random()}`;
  let allowed = 0;
  for (let i = 0; i < 35; i++) {
    if (rateLimit(key, 30, 60_000)) allowed++;
  }
  assert.equal(allowed, 30, "exactly `limit` calls are allowed");
  assert.equal(rateLimit(key, 30, 60_000), false, "further calls are blocked");

  // A different key has its own independent bucket.
  assert.equal(rateLimit(`other-${Math.random()}`, 30, 60_000), true);
});

test("rateLimit resets once the window elapses", () => {
  const key = `rl-${Math.random()}`;
  assert.equal(rateLimit(key, 1, 1), true); // 1 request per 1ms
  assert.equal(rateLimit(key, 1, 1), false); // immediately exhausted

  const until = Date.now() + 5;
  while (Date.now() < until) {
    /* brief spin to outlast the 1ms window */
  }
  assert.equal(rateLimit(key, 1, 1), true, "bucket resets after the window");
});
