# Cloudflare Worker — backend for the title generator

Holds your `OPENAI_API_KEY` as a secret, fetches papers from OpenAlex,
calls OpenAI to extract word banks, and caches results in Cloudflare KV
for 5 days. The GitHub Pages frontend just calls
`GET /api/author?name=...&affiliation=...`.

## Deployment

1. **Create a Cloudflare account** at <https://cloudflare.com> (free).

2. **Install wrangler:**
   ```sh
   npm install -g wrangler
   wrangler login
   ```

3. **Set the OpenAI API key as a secret** (from `worker/`):
   ```sh
   cd worker
   wrangler secret put OPENAI_API_KEY
   # paste your sk-... key when prompted
   ```

4. **Create the KV namespace for the cache:**
   ```sh
   wrangler kv namespace create AUTHOR_CACHE
   # prints: id = "abc123def456..."
   ```
   Paste that id into `wrangler.toml` (replace `PASTE_KV_NAMESPACE_ID_HERE`).

5. **Edit `wrangler.toml`** if needed — `ALLOWED_ORIGINS` should include
   your GitHub Pages URL.

6. **Deploy:**
   ```sh
   wrangler deploy
   ```

   Wrangler prints a URL like
   `https://what-will-they-publish-next.<your-handle>.workers.dev`.

7. **Wire it into the frontend.** Edit `../index.html`'s `WORKER_URL`
   constant. Commit and push.

## Caching

Author lookups are cached in KV under the key `lower(name)|lower(affiliation)`
with a 5-day TTL. Hits return instantly (no OpenAlex or OpenAI call).
Misses populate the cache. Free KV tier: 100k reads/day, 1k writes/day,
1 GB storage.

## Cost / abuse protection

- Cloudflare free plan: 100,000 requests/day. More than enough.
- Set a hard monthly $ cap in your OpenAI dashboard
  (<https://platform.openai.com/account/limits>) — recommend $5.
- The Worker checks `Origin` against `ALLOWED_ORIGINS` so only your
  GitHub Pages site (and localhost during development) can use it.
- For per-IP rate limiting, add a Cloudflare KV namespace and gate by
  IP in `worker.js`. Skipped here for simplicity.

## Power users can still use their own key

If a visitor sets their own OpenAI key via the ⚙ button on the page,
the frontend calls OpenAI directly and skips the Worker entirely.
