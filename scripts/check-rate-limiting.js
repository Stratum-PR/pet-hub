#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
// RATE LIMITING – CI CHECK (4b)
// Fails CI until rate limiting is implemented.
// Once implemented, set RATE_LIMIT_CONFIGURED=true in CI env
// or create .rate-limit-configured in project root.
// ════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envConfigured = process.env.RATE_LIMIT_CONFIGURED === "true" || process.env.RATE_LIMIT_CONFIGURED === "1";
const markerFile = path.join(root, ".rate-limit-configured");

if (envConfigured || fs.existsSync(markerFile)) {
  console.log("Rate limiting marked as configured. CI check passed.");
  process.exit(0);
}

console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  RATE LIMITING NOT CONFIGURED – CI FAILED                        ║
╚══════════════════════════════════════════════════════════════════╝

Implement rate limiting, then either:

  A) In CI (e.g. Vercel/Netlify/GitHub Actions), set:
       RATE_LIMIT_CONFIGURED=true

  B) Or create a marker file (do not commit if it contains secrets):
       echo "rate limiting implemented" > .rate-limit-configured
     And add .rate-limit-configured to .gitignore if you use this only locally.

Required limits (see docs/SECURITY-CHECKLIST.md):
  - General API: max 100 requests per hour per IP
  - Login: max 10 attempts per IP per 15 min
  - Password reset: max 3 requests per email per hour
  - Costly endpoints (e.g. OpenAI): e.g. 50 requests per user per day

Options: Upstash Redis + @upstash/ratelimit, Supabase Edge + KV, or
Vercel/Cloudflare rate limiting.
`);

process.exit(1);
