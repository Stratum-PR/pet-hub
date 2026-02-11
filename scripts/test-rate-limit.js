#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
// Test rate limit: fetch SITE_URL repeatedly until 429 or max.
// Usage: SITE_URL=https://yoursite.vercel.app node scripts/test-rate-limit.js
//    or: node scripts/test-rate-limit.js https://yoursite.vercel.app [maxRequests]
// Default maxRequests = 105 (so after 100 you should get 429).
// ════════════════════════════════════════════════════════════
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const siteUrl = process.env.SITE_URL || args[0];
const maxRequests = parseInt(process.env.MAX_REQUESTS || args[1] || "105", 10);

if (!siteUrl) {
  console.error(`
Usage:
  SITE_URL=https://your-production-site.vercel.app node scripts/test-rate-limit.js
  node scripts/test-rate-limit.js https://your-production-site.vercel.app [maxRequests]

Examples:
  node scripts/test-rate-limit.js https://stratum-hub.vercel.app
  node scripts/test-rate-limit.js https://stratum-hub.vercel.app 105

The middleware allows 100 requests per hour per IP. So request 101+ should return 429.
`);
  process.exit(1);
}

const url = siteUrl.replace(/\/$/, "") + "/";

console.log(`Testing rate limit: ${url}`);
console.log(`Max requests: ${maxRequests}`);
console.log("");

let lastStatus = 0;
let first429At = null;

for (let i = 1; i <= maxRequests; i++) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    lastStatus = res.status;
    if (res.status === 429) {
      if (!first429At) first429At = i;
      const retryAfter = res.headers.get("Retry-After");
      console.log(`Request ${i}: 429 Too Many Requests${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ""}`);
      break;
    }
    if (i % 20 === 0 || i === maxRequests) {
      console.log(`Request ${i}: ${res.status}`);
    }
  } catch (e) {
    console.error(`Request ${i} failed:`, e.message);
    process.exit(1);
  }
}

console.log("");
if (first429At !== null) {
  console.log("Rate limit is working. First 429 at request", first429At);
  process.exit(0);
} else {
  console.log("No 429 received. Either the limit is higher than", maxRequests, "or middleware/env is not active.");
  process.exit(0);
}
