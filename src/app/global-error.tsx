"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Global error boundary — catches root layout errors and React render errors.
 * Required for Sentry to capture client-side crashes in the App Router.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
