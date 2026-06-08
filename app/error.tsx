"use client";

import * as React from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: "app-error-boundary",
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        metadata: {
          pathname: window.location.pathname,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { eventId?: string };
      })
      .then((payload) => {
        if (!cancelled) setEventId(payload?.eventId ?? null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <main className="error-shell">
      <section className="error-card">
        <p className="error-eyebrow">Something slipped</p>
        <h1 className="error-title">We hit an unexpected problem.</h1>
        <p className="error-copy">
          Your data should still be safe. You can retry this screen or head back
          home while we inspect the local error log.
        </p>
        {eventId ? <p className="error-meta">Reference: {eventId}</p> : null}
        <div className="error-actions">
          <button className="error-primary" onClick={reset} type="button">
            Try again
          </button>
          <Link className="error-secondary" href="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
