import { NextResponse } from "next/server";

import { errorMessage, errorStack, logAppError } from "@/lib/error-logger";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      area?: string;
      message?: string;
      stack?: string | null;
      digest?: string | null;
      metadata?: Record<string, unknown>;
    };

    const eventId = await logAppError({
      area: body.area?.trim() || "client",
      message: body.message?.trim() || "Unknown client error",
      stack: body.stack ?? null,
      digest: body.digest ?? null,
      metadata: body.metadata,
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
