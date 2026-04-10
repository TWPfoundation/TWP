import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",

  // Source map upload auth token — set SENTRY_AUTH_TOKEN env var
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack traces
  widenClientFileUpload: true,

  // Proxy Sentry requests through /monitoring to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
