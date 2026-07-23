"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="error-shell">
          <span className="section-kicker">Coast Bookings</span>
          <h1>We could not load this page</h1>
          <p>The error has been recorded. No payment or booking status is changed by this screen.</p>
          <button className="button" type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
