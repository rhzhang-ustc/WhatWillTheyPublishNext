# Cloudflare Worker — OpenAI proxy

A tiny proxy that holds your `OPENAI_API_KEY` as a secret and forwards
chat-completion requests from the GitHub Pages frontend, so visitors
don't need their own API key.

## Deployment

1. **Create a Cloudflare account** at <https://cloudflare.com> (free).

2. **Install wrangler** (Cloudflare's CLI):
   ```sh
   npm install -g wrangler
   wrangler login
   ```

3. **Set the OpenAI API key as a secret** (from this directory):
   ```sh
   cd worker
   wrangler secret put OPENAI_API_KEY
   # paste your sk-... key when prompted
   ```

4. **Edit `wrangler.toml`** if needed:
   - Update `ALLOWED_ORIGINS` to include your GitHub Pages URL
     (e.g., `https://<your-handle>.github.io`)

5. **Deploy:**
   ```sh
   wrangler deploy
   ```

   Wrangler prints a URL like
   `https://what-will-they-publish-next.<your-handle>.workers.dev`

6. **Wire it into the frontend.** Open `../index.html` and update the
   `WORKER_URL` constant near the top of the script tag to that URL.
   Commit and push.

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
