import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status" };

export default async function StatusPage() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const healthy = db;

  return (
    <div className="dark flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            {healthy ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            ) : (
              <XCircle className="h-10 w-10 text-red-400" />
            )}
          </div>
          <h1 className="text-lg font-semibold">
            {healthy ? "All systems operational" : "Service degraded"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {healthy
              ? "ProjectHub is up and running."
              : "The database is unreachable."}
          </p>

          <dl className="mt-6 space-y-2 text-left text-sm">
            <div className="flex items-center justify-between border-t pt-2">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="font-medium text-emerald-400">Online</dd>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <dt className="text-muted-foreground">Database</dt>
              <dd
                className={
                  db ? "font-medium text-emerald-400" : "font-medium text-red-400"
                }
              >
                {db ? "Connected" : "Down"}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <dt className="text-muted-foreground">Checked</dt>
              <dd className="font-medium tabular-nums">
                {new Date().toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-center text-sm">
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to app
          </Link>
        </p>
      </div>
    </div>
  );
}
