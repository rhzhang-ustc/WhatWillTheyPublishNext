# What Would [Your Hero] Publish Next?

A satirical paper-title generator that conditions on a real researcher.
Type a name (and optional affiliation), the page pulls their actual paper
titles from [OpenAlex](https://openalex.org), and asks GPT to extract a
structured word bank (methods, tasks, applications, variants). The
generator then composes absurd-but-plausible titles in their style.

Inspired by Kris Hauser's
[ICRA Paper Title Generator](https://kkhauser.web.illinois.edu).

## How it runs

The page calls:

- **OpenAlex** directly from the browser (CORS-enabled, free, no key)
- **OpenAI** for word-bank extraction. Either:
  1. **Shared backend** — a tiny Cloudflare Worker (`worker/`) holds
     your key as a secret, so visitors don't need their own. *(default)*
  2. **User-provided key** — power users paste their own OpenAI key via
     the ⚙ button; the page then calls OpenAI directly, bypassing your
     Worker.

## Deployment

1. **Frontend (GitHub Pages):**
   - Push this repo to GitHub
   - Repo → **Settings** → **Pages** → Source = `main` / root
   - Live at `https://<your-handle>.github.io/<repo-name>/` in ~1 min

2. **Shared backend (Cloudflare Worker):**
   - See `worker/README.md` for full steps
   - tl;dr: `wrangler login`, `wrangler secret put OPENAI_API_KEY`,
     `wrangler deploy`
   - Copy the Worker URL into `index.html` (the `WORKER_URL` constant
     near the top of the script tag), commit, push.
   - If you skip this, the page still works but visitors will need to
     supply their own OpenAI key.

## Local use

Open `index.html` directly. If `config.local.js` is present, your key
is auto-loaded. Otherwise click ⚙ API key, paste your key, save.

## Files

- `index.html` — the entire app
- `reference_*.js` — the original Hauser word banks and hot-take list,
  kept for reference only
- `server.py`, `Dockerfile`, `requirements.txt` — legacy local-server
  setup (kept for reference; not used by the GitHub Pages deployment)
