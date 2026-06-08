import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Lightweight health check — handy when running 24/7 on a Pi (uptime monitors,
// load balancers, `curl localhost:3000/api/health`).
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  return NextResponse.json(
    {
      status: db ? "ok" : "degraded",
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  );
}
