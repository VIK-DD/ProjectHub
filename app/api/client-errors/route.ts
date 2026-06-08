import { NextResponse } from "next/server";

import { errorMessage, errorStack, logAppError } from "@/lib/error-logger";
import { rateLimit } from "@/lib/rate-limit";

// Hardening: this endpoint is intentionally unauthenticated — the React error
// boundaries (error.tsx / global-error.tsx) must be able to report even when
// the session is broken or on the login page. Abuse is contained by:
//   1. a same-origin check (blocks cross-site posting),
//   2. a per-IP rate limit (blocks spam / disk-fill),
//   3. strict size caps on every field (bounds each log entry).
const RATE_LIMIT = 30; // requests…
const RATE_WINDOW_MS = 60_000; // …per minute, per IP

const MAX_AREA = 64;
const MAX_MESSAGE = 2_000;
const MAX_STACK = 8_000;
const MAX_META_KEYS = 20;
const MAX_META_VALUE = 500;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin — don't block
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

function cap(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function capMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (n++ >= MAX_META_KEYS) break;
    out[key.slice(0, MAX_AREA)] =
      typeof value === "number" || typeof value === "boolean"
        ? value
        : String(value ?? "").slice(0, MAX_META_VALUE);
  }
  return out;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (!rateLimit(`client-errors:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await req.json()) as {
      area?: unknown;
      message?: unknown;
      stack?: unknown;
      digest?: unknown;
      metadata?: unknown;
    };

    const eventId = await logAppError({
      area: cap(body.area, MAX_AREA) || "client",
      message: cap(body.message, MAX_MESSAGE) || "Unknown client error",
      stack: cap(body.stack, MAX_STACK) ?? null,
      digest: cap(body.digest, MAX_AREA) ?? null,
      metadata: capMeta(body.metadata),
    });

    return NextResponse.json({ ok: true, eventId });
  } catch (error) {
    void logAppError({
      area: "client-errors-route",
      message: errorMessage(error),
      stack: errorStack(error),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
