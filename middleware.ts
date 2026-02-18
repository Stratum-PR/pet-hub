/**
 * Vercel Edge Middleware – rate limit by IP (100 requests per hour).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env.
 * See docs/RATE-LIMITING-GUIDE.md for setup.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { next, ipAddress } from "@vercel/functions";

const RATE_LIMIT_WINDOW = "1 h";
const RATE_LIMIT_MAX = 100;

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip static assets so images/fonts don't burn the limit
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") && /\.(ico|png|webp|svg|js|css|woff2?|ttf|eot)$/i.test(pathname)
  ) {
    return next();
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return next();
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
    prefix: "pet-hub-rate",
  });

  const ip = ipAddress(request) ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Too many requests</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;">
  <h1 style="color:#b91c1c;font-size:1.5rem;">Too many requests</h1>
  <p style="color:#374151;line-height:1.6;">Too many requests from your network. To protect the site, we limit how often you can load pages.</p>
  <p style="color:#6b7280;font-size:0.95rem;">Please wait <strong>1 hour</strong>, then try again.</p>
  <p style="margin-top:24px;"><a href="/" style="color:#2563eb;text-decoration:underline;">Return to home</a></p>
</body>
</html>`;
    return new Response(html, {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3600",
      },
    });
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
