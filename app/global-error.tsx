"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="error-shell">
        <section className="error-card">
          <p className="error-eyebrow">App error</p>
          <h1 className="error-title">ProjectHub could not render this page.</h1>
          <p className="error-copy">
            Try loading again. If it keeps happening, the local log will include
            this digest: {error.digest ?? "n/a"}.
          </p>
          <div className="error-actions">
            <button className="error-primary" onClick={reset} type="button">
              Reload
            </button>
            <Link className="error-secondary" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </section>
      </body>
    </html>
  );
}
