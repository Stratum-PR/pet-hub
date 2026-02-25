# How to verify SEO & AI discoverability

After `npm run build` and `npm run preview`, use this checklist to confirm everything works.

## 1. What you're seeing is correct

The preview URL (e.g. http://localhost:4173) **is** the same app as your site—just the production build. That’s expected. We’re checking that **crawlers and AI agents** get the right files and meta.

---

## 2. Discovery files (sitemap, robots, llms.txt, ai-routes)

With the preview server running (`npm run preview`), open these URLs in your browser:

| URL | What you should see |
|-----|---------------------|
| http://localhost:4173/sitemap.xml | XML with `<urlset>` and several `<url>` entries (home, /pricing, /login, etc.). |
| http://localhost:4173/robots.txt | Text file with `User-agent: *`, `Allow: /`, and a line `Sitemap: https://...`. |
| http://localhost:4173/llms.txt | Text with “Pet Hub”, “Main links”, and a list of URLs. |
| http://localhost:4173/ai-routes.json | JSON with `"baseUrl"` and a `"routes"` array of objects with `path`, `url`, `title`, `description`. |

If all of these load and look right, crawlers and AI agents can find your pages and full site text.

---

## 3. Meta tags and JSON-LD (what search engines use)

Crawlers read the **HTML** of each page. You can simulate that by checking the document head.

### Option A: View Page Source

1. Open http://localhost:4173/ (home).
2. Right‑click → **View Page Source** (or Ctrl+U).
3. In the `<head>` you should see:
   - `<title>Pet Hub – Pet Grooming Business Management</title>`
   - `<meta name="description" content="...">`
   - `<meta property="og:title" ...>`, `og:description`, `og:url`, `og:image`
   - `<script type="application/ld+json">` with `"@type":"Organization"` and `"WebSite"`

4. Open http://localhost:4173/pricing and View Source again.
   - `<title>` should be something like **Pricing – Pet Hub** and meta/OG tags should match the pricing page.

If you see different titles and meta per page, **per‑route meta is working.**

### Option B: DevTools (Elements)

1. Open http://localhost:4173/.
2. F12 → **Elements** (or **Inspector**).
3. Expand `<head>`.
4. Confirm `<title>`, `<meta name="description">`, `og:*` meta tags, and the `application/ld+json` script.

Same idea for `/pricing`, `/login`, etc.

---

## 4. One-command check (no preview needed)

After building, run:

```bash
npm run check:crawler-view
```

This reads the discovery files and home page HTML from **dist/** and prints OK or FAIL for each. You do **not** need to run `npm run preview` in another terminal.

To check a **live** preview server instead (e.g. to verify runtime meta), start preview in one terminal, then in another run:

```bash
npm run check:crawler-view http://localhost:4173
```

---

## 5. Simulating a crawler (optional)

From a terminal, with preview running on 4173:

```powershell
# Discovery files exist and return 200
curl -s -o NUL -w "%{http_code}" http://localhost:4173/sitemap.xml
curl -s -o NUL -w "%{http_code}" http://localhost:4173/robots.txt
curl -s -o NUL -w "%{http_code}" http://localhost:4173/llms.txt
curl -s -o NUL -w "%{http_code}" http://localhost:4173/ai-routes.json
```

Each should print `200`. Then:

```powershell
# See what the home page returns (first ~100 lines of HTML)
curl -s http://localhost:4173/ | Select-Object -First 80
```

In that HTML you should see `<title>`, `<meta name="description">`, and `application/ld+json`. That’s what a crawler gets.

---

## 6. Will crawling work?

- **Discovery:** Crawlers read `robots.txt` and often follow the `Sitemap:` URL. Your build puts `sitemap.xml`, `robots.txt`, `llms.txt`, and `ai-routes.json` in `dist/`, so they’re served at the root. **Crawlers will find them.**
- **Indexing:** Each URL in the sitemap is a real page. When the crawler requests that URL (e.g. `/`, `/pricing`), it gets your SPA HTML. The `<head>` is filled by React Helmet with the right title and meta for that route. **So crawling and indexing can work** as long as:
  - Your host serves the built app for those paths (e.g. SPA fallback: all routes → `index.html`), and
  - In production you set `VITE_PUBLIC_BASE_URL` to your real domain so sitemap/robots/meta use the correct absolute URLs.

---

## 7. Adding a new public page

So that crawlers and AI get the full text of the site and new pages are included:

1. **Add the route** in `src/config/discoverable-routes.ts`: add an entry to `DISCOVERABLE_ROUTES` (path, title, description, indexable, etc.).
2. **Add the page content** in `src/content/discoverable-content.ts`: add `PAGE_CONTENT['/your-path'] = { sections: [ { heading: '...', body: '...' }, ... ] }` with the full text of that page (same copy as on the site).
3. **Add the route in your app** (e.g. `App.tsx` or your router) so the page actually exists.
4. Run **`npm run build`**. The new page is added to sitemap.xml, ai-routes.json, llms.txt (full text), and content.json (structured sections).

If you only add the route to `DISCOVERABLE_ROUTES` and the app router, the page will appear in the sitemap and ai-routes with title/description; add `PAGE_CONTENT` for that path to expose the full page text in llms.txt and content.json.

---

## 8. Quick checklist before commit

- [ ] `npm run verify:discoverability` passes.
- [ ] `npm run check:crawler-view` after build — all OK (no preview needed).
- [ ] View Source on `/` and `/pricing` — different titles and meta per page, plus JSON-LD on `/`.
- [ ] In production, `VITE_PUBLIC_BASE_URL` is set to your real site URL.
