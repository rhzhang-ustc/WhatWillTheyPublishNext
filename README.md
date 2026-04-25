# What Would [Your Hero] Publish Next?

A satirical paper-title generator that conditions on a real researcher.
Type a name (and optional affiliation), the page pulls their actual paper
titles from [OpenAlex](https://openalex.org), and asks GPT to extract a
structured word bank (methods, tasks, applications, variants). The
generator then composes absurd-but-plausible titles in their style.

Inspired by Kris Hauser's
[ICRA Paper Title Generator](https://kkhauser.web.illinois.edu).

## How it runs

Everything is browser-side — no backend. The page calls:

- **OpenAlex** directly (CORS-enabled, free, no key needed)
- **OpenAI** directly with **your** key (stored only in your browser's
  `localStorage`, never sent anywhere except OpenAI itself)

You'll need an OpenAI key — get one at
[platform.openai.com/api-keys](https://platform.openai.com/api-keys).
Set a small monthly cap there if you're worried about cost.

## Local use

Just open `index.html` in any browser. Click the **⚙ API key** button in
the top-right, paste your key, and start generating.

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. Repo → **Settings** → **Pages** → Source = `main` branch / root
3. After ~1 minute, the page is live at
   `https://<your-handle>.github.io/<repo-name>/`

That's it. No build step, no secrets, no server.

## Files

- `index.html` — the entire app
- `reference_*.js` — the original Hauser word banks and hot-take list,
  kept for reference only
- `server.py`, `Dockerfile`, `requirements.txt` — legacy local-server
  setup (kept for reference; not used by the GitHub Pages deployment)
