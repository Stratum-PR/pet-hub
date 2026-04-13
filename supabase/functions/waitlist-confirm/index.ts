/**
 * Legacy waitlist confirmation links (double opt-in). Redirects to the app home.
 * New signups no longer use this flow; old emails may still contain these URLs.
 */
function resolveAppBase(req: Request): string {
  const env = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  if (env) return env;
  const origin = (req.headers.get("Origin") ?? "").trim().replace(/\/$/, "");
  if (origin) return origin;
  return "http://localhost:8080";
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const appBase = resolveAppBase(req).replace(/\/$/, "");
  const token = (url.searchParams.get("token") ?? "").trim();

  const target = token ? `${appBase}/` : `${appBase}/?waitlist=invalid`;

  return new Response(null, {
    status: 302,
    headers: { Location: target },
  });
});
