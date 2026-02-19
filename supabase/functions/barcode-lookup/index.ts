// Barcode lookup: tries Open Food Facts (free, no key) first, then Barcode Lookup API if BARCODE_LOOKUP_API_KEY is set.
// Auth: requires Supabase JWT. Rate limit: 60 requests per user per minute (in-memory).

const RATE_LIMIT_PER_MINUTE = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getCorsOrigin(req: Request): string {
  try {
    const origin = req.headers.get("Origin") ?? "";
    // Credentialed requests (JWT) require a specific origin, not *. Reflect localhost for dev.
    if (origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
      return origin;
    }
    const allowed = Deno.env.get("ALLOWED_ORIGINS")?.trim();
    if (allowed) {
      const origins = allowed.split(",").map((o) => o.trim()).filter(Boolean);
      if (origins.includes(origin)) return origin;
      if (origins.length > 0) return origins[0];
    }
    return origin || "*";
  } catch {
    return "*";
  }
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/** Safe CORS headers for OPTIONS only - no request dependency that could throw. */
function preflightCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))
      ? origin
      : origin || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const VALID_LENGTHS = [8, 12, 13, 14];

function validateBarcode(barcode: string): { valid: boolean; error?: string } {
  const trimmed = barcode.trim();
  if (!trimmed) return { valid: false, error: "Barcode is required" };
  if (trimmed.length > 20) return { valid: false, error: "Barcode too long" };
  if (!/^\d+$/.test(trimmed)) return { valid: false, error: "Barcode must contain only digits" };
  if (!VALID_LENGTHS.includes(trimmed.length)) {
    return { valid: false, error: "Barcode length must be 8, 12, 13, or 14 digits" };
  }
  return { valid: true };
}

function checkRateLimit(userId: string): { allowed: boolean } {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = rateLimitMap.get(userId);
  if (!entry) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) return { allowed: false };
  entry.count += 1;
  return { allowed: true };
}

export interface BarcodeLookupProduct {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  barcode: string;
}

const OFF_USER_AGENT = "PetHub-Inventory/1.0 (Inventory barcode lookup)";

function normalizeOpenFoodFacts(data: unknown, barcode: string): BarcodeLookupProduct | null {
  try {
    const obj = data as { product?: Record<string, unknown> };
    const p = obj?.product;
    if (!p || typeof p !== "object") return null;
    const name =
      (typeof p.product_name === "string" ? p.product_name : null) ||
      (typeof p.abbreviated_product_name === "string" ? p.abbreviated_product_name : null) ||
      "";
    if (!name) return null;
    const brand = typeof p.brands === "string" ? p.brands : undefined;
    const category = typeof p.categories === "string" ? p.categories : undefined;
    const description =
      (typeof p.generic_name === "string" ? p.generic_name : null) ||
      (typeof p._keywords === "string" ? p._keywords : undefined);
    const imageUrl =
      (typeof p.image_front_url === "string" ? p.image_front_url : null) ||
      (typeof p.image_url === "string" ? p.image_url : undefined);
    return {
      name: name || "Unknown Product",
      brand: brand || undefined,
      category: category || undefined,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      barcode,
    };
  } catch {
    return null;
  }
}

function normalizeBarcodeLookupApi(data: unknown, barcode: string): BarcodeLookupProduct | null {
  try {
    const obj = data as Record<string, unknown>;
    const products = obj?.products;
    if (!Array.isArray(products) || products.length === 0) return null;
    const first = products[0] as Record<string, unknown>;
    const name = typeof first.product_name === "string" ? first.product_name : (first.title as string) ?? "";
    const brand = typeof first.brand === "string" ? first.brand : undefined;
    const category = typeof first.category === "string" ? first.category : undefined;
    const description = typeof first.description === "string" ? first.description : undefined;
    let imageUrl: string | undefined;
    const images = first.images;
    if (Array.isArray(images) && images.length > 0) {
      const img = images[0];
      imageUrl = typeof img === "string" ? img : (img as { url?: string })?.url;
    }
    return {
      name: name || "Unknown Product",
      brand,
      category,
      description,
      imageUrl,
      barcode,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const method = (req.method || "").toUpperCase();
  if (method === "OPTIONS") {
    const origin = req.headers.get("Origin");
    return new Response("", {
      status: 200,
      headers: preflightCorsHeaders(origin),
    });
  }

  if (method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (!checkRateLimit(user.id).allowed) {
    return new Response(
      JSON.stringify({ error: "too_many_requests", message: "Too many lookups. Try again in a minute." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60", ...corsHeaders(req) },
      }
    );
  }

  let body: { barcode?: string };
  try {
    const text = await req.text();
    body = (text && text.trim() ? JSON.parse(text) : {}) as { barcode?: string };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body. Send { \"barcode\": \"012345678905\" }" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } }
    );
  }

  const barcodeRaw = typeof body?.barcode === "string" ? body.barcode : "";
  const validation = validateBarcode(barcodeRaw);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(req) } }
    );
  }
  const barcode = barcodeRaw.trim();

  // 1. Try Open Food Facts first (free, no API key; good for food/pet food)
  let product: BarcodeLookupProduct | null = null;
  try {
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const offRes = await fetch(offUrl, {
      headers: { "User-Agent": OFF_USER_AGENT },
    });
    const offData = await offRes.json().catch(() => ({}));
    product = normalizeOpenFoodFacts(offData, barcode);
  } catch (e) {
    console.error("Open Food Facts fetch error:", e);
  }

  // 2. If not found and paid API key is set, try Barcode Lookup
  if (!product) {
    const apiKey = Deno.env.get("BARCODE_LOOKUP_API_KEY");
    if (apiKey) {
      try {
        const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&formatted=y&key=${encodeURIComponent(apiKey)}`;
        const apiRes = await fetch(url);
        const apiData = await apiRes.json().catch(() => ({}));
        product = normalizeBarcodeLookupApi(apiData, barcode);
      } catch (e) {
        console.error("Barcode Lookup API fetch error:", e);
      }
    }
  }

  if (!product) {
    return new Response(
      JSON.stringify({ found: false, barcode }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } }
    );
  }

  return new Response(
    JSON.stringify({ found: true, product }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(req) } }
  );
});
