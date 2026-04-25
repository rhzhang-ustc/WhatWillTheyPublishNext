// Cloudflare Worker — full backend for the title generator.
//
// Endpoint:
//   GET /api/author?name=X[&affiliation=Y]
//
// Flow:
//   1. Look up `name|affiliation` in KV (5-day TTL).
//   2. On miss: fetch the author's papers from OpenAlex, then call
//      OpenAI to extract a structured word bank, then store in KV.
//
// Secrets: set with `wrangler secret put OPENAI_API_KEY`
// Vars (wrangler.toml): ALLOWED_ORIGINS (comma-separated)
// KV binding (wrangler.toml): AUTHOR_CACHE

const CACHE_TTL_SECONDS = 5 * 24 * 60 * 60; // 5 days
const OPENALEX_BASE = "https://api.openalex.org";
// Identifying ourselves puts us in OpenAlex's "polite pool" with higher
// rate limits — important since Worker IPs are shared with many users.
const OPENALEX_MAILTO = "ruohanzhang15@gmail.com";

async function openalexFetch(path, params = {}) {
    const u = new URL(`${OPENALEX_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v != null) u.searchParams.set(k, v);
    }
    u.searchParams.set("mailto", OPENALEX_MAILTO);

    // Small retry on 429 with backoff
    for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(u.toString(), {
            headers: { "User-Agent": `WhatWillTheyPublishNext (mailto:${OPENALEX_MAILTO})` },
        });
        if (r.status !== 429) return r;
        const retryAfter = parseInt(r.headers.get("Retry-After") || "1", 10);
        await new Promise(res => setTimeout(res, Math.min(retryAfter, 5) * 1000));
    }
    // Fall through with a final attempt (returns whatever status it has)
    return fetch(u.toString(), {
        headers: { "User-Agent": `WhatWillTheyPublishNext (mailto:${OPENALEX_MAILTO})` },
    });
}

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
});

function isAllowedOrigin(origin, env) {
    if (!origin) return false;
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    return allowed.some(a => origin === a);
}

function jsonResponse(status, payload, origin) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
}

// ===== OpenAlex =====

async function resolveInstitution(affiliation) {
    if (!affiliation) return { id: null, name: null };
    try {
        const r = await openalexFetch("/institutions", { search: affiliation, "per-page": 1 });
        if (!r.ok) return { id: null, name: null };
        const j = await r.json();
        const top = (j.results || [])[0];
        if (!top) return { id: null, name: null };
        return { id: (top.id || "").split("/").pop() || null, name: top.display_name || null };
    } catch {
        return { id: null, name: null };
    }
}

async function fetchAuthorTitles(name, affiliation) {
    const { id: instId, name: instName } = await resolveInstitution(affiliation);
    const affLower = (affiliation || "").toLowerCase();

    const aresp = await openalexFetch("/authors", { search: name, "per-page": 10 });
    if (!aresp.ok) throw new Error(`OpenAlex author search failed: ${aresp.status}`);
    const adata = await aresp.json();
    const candidates = adata.results || [];
    if (candidates.length === 0) return null;

    let author;
    if (affiliation) {
        const matches = candidates.filter(c => {
            const insts = c.last_known_institutions || [];
            if (instId && insts.some(i => (i.id || "").split("/").pop() === instId)) return true;
            if (affLower && insts.some(i => (i.display_name || "").toLowerCase().includes(affLower))) return true;
            return false;
        });
        author = matches.length
            ? matches.reduce((a, b) => (b.works_count || 0) > (a.works_count || 0) ? b : a)
            : candidates.reduce((a, b) => (b.cited_by_count || 0) > (a.cited_by_count || 0) ? b : a);
    } else {
        author = candidates.reduce((a, b) => (b.cited_by_count || 0) > (a.cited_by_count || 0) ? b : a);
    }

    const authorId = (author.id || "").split("/").pop();
    const authorName = author.display_name || name;
    const insts = author.last_known_institutions || [];
    const authorAff = insts.map(i => i.display_name).filter(Boolean).join(", ") || null;

    const wresp = await openalexFetch("/works", {
        filter: `author.id:${authorId}`,
        "per-page": 200,
        select: "title,type,authorships,cited_by_count",
        sort: "cited_by_count:desc",
    });
    if (!wresp.ok) throw new Error(`OpenAlex works fetch failed: ${wresp.status}`);
    const wdata = await wresp.json();
    const works = wdata.results || [];

    const seen = new Set();
    const titles = [];
    for (const w of works) {
        const t = w.title;
        if (!t) continue;
        if (w.type && !["article", "book-chapter", "preprint"].includes(w.type)) continue;

        let matched = null;
        for (const a of (w.authorships || [])) {
            if ((a.author?.id || "").split("/").pop() === authorId) { matched = a; break; }
        }
        if (affiliation && matched) {
            const wsInsts = matched.institutions || [];
            const rawStrs = matched.raw_affiliation_strings || [];
            const idMatch = instId && wsInsts.some(i => (i.id || "").split("/").pop() === instId);
            const instMatch = affLower && wsInsts.some(i => (i.display_name || "").toLowerCase().includes(affLower));
            const rawMatch = affLower && rawStrs.some(s => (s || "").toLowerCase().includes(affLower));
            const canonical = instName && rawStrs.some(s => (s || "").toLowerCase().includes(instName.toLowerCase()));
            if (!(idMatch || instMatch || rawMatch || canonical)) continue;
        }

        const key = t.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        titles.push(t);
        if (titles.length >= 100) break;
    }

    return { name: authorName, affiliation: authorAff, titles };
}

// ===== OpenAI =====

async function gptExtract(titles, env) {
    const titlesText = titles.slice(0, 100).map(t => "- " + t).join("\n");
    const prompt = `You are analyzing paper titles from a researcher. Extract research terms structured for use as building blocks in a paper-title generator.

Paper titles:
${titlesText}

The terms will be substituted into title patterns like:
  "{learningvariant} {learningmethods} for {taskprevariant} {task} in {application} {taskpostvariant}"

Return a JSON object with this exact schema. ALL fields are required and must be substantively populated:
{
  "learningmethod": [...],
  "learningmethods": [...],
  "learningmethod_category": [...],
  "learningvariant": [...],
  "task": [...],
  "taskprevariant": {"task_name": [...]},
  "taskpostvariant": {"task_name": [...]},
  "application": [...]
}

REQUIRED COUNTS:
- learningmethod: 8-15 entries (singular ML/AI methods)
- learningmethods: SAME length as learningmethod (plurals; for uncountable like "reinforcement learning", repeat the singular)
- learningmethod_category: SAME length as learningmethod (true=uncountable, false=countable)
- learningvariant: 8-15 short adjective modifiers (e.g., "robust", "zero-shot", "vision-guided")
- task: 10-20 research tasks
- application: 8-15 robot platforms / domains
- taskprevariant: REQUIRED — populate entries for AT LEAST 8 tasks, 3-6 entries each
- taskpostvariant: REQUIRED — populate entries for AT LEAST 8 tasks, 3-6 entries each

PRE-VARIANT FORMAT — single ADJECTIVE phrase (no preposition), reads as "{prevariant} {task}":
  "manipulation": ["dexterous", "bimanual", "in-hand", "contact-rich"]

POST-VARIANT FORMAT — must START with a preposition (of, with, in, for, under, using, via, over, from, during, across, without, and, through, by) so "{task} {postvariant}" reads fluently:
  "manipulation": ["of deformable objects", "in clutter", "with tactile feedback", "under occlusion"]

OTHER RULES:
- 1-5 words per entry. Lowercase except proper nouns/acronyms. Avoid near-duplicates.
- Anchor terms in this author's work (synonyms welcome).
- Keys in taskprevariant/taskpostvariant must EXACTLY match entries in "task".
- Return valid JSON only, no markdown fences.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            response_format: { type: "json_object" },
            max_tokens: 4096,
        }),
    });
    if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`OpenAI ${resp.status}: ${t.slice(0, 200)}`);
    }
    const j = await resp.json();
    const content = j.choices?.[0]?.message?.content || "{}";
    const result = JSON.parse(content);

    // Align method/plural/category lengths
    const methods = result.learningmethod || [];
    let plurals = result.learningmethods || [];
    let cats = result.learningmethod_category || [];
    while (plurals.length < methods.length) plurals.push(methods[plurals.length] + "s");
    while (cats.length < methods.length) cats.push(false);
    plurals = plurals.slice(0, methods.length);
    cats = cats.slice(0, methods.length);
    plurals = methods.map((m, i) => cats[i] ? m : plurals[i]);
    result.learningmethods = plurals;
    result.learningmethod_category = cats;

    for (const k of ["learningmethod", "learningmethods", "learningmethod_category", "learningvariant", "task", "application"]) {
        if (!result[k]) result[k] = [];
    }
    for (const k of ["taskprevariant", "taskpostvariant"]) {
        if (!result[k]) result[k] = {};
    }

    // Drop postvariant entries without leading preposition
    const validStarts = ["of ", "with ", "in ", "for ", "under ", "using ", "via ", "over ",
        "from ", "during ", "across ", "without ", "and ", "through ", "near ", "between ", "by "];
    const cleanedPost = {};
    for (const [task, phrases] of Object.entries(result.taskpostvariant)) {
        const kept = (phrases || []).filter(p =>
            typeof p === "string" && validStarts.some(s => p.trim().toLowerCase().startsWith(s)),
        );
        if (kept.length) cleanedPost[task] = kept;
    }
    result.taskpostvariant = cleanedPost;

    // Drop pre/post variants whose task isn't in the task list
    const taskSet = new Set(result.task.map(t => t.toLowerCase()));
    for (const k of ["taskprevariant", "taskpostvariant"]) {
        const filtered = {};
        for (const [task, val] of Object.entries(result[k])) {
            if (taskSet.has(task.toLowerCase())) filtered[task] = val;
        }
        result[k] = filtered;
    }

    return result;
}

// ===== Main handler =====

// GET /api/author?name=X[&affiliation=Y]: cache-only check.
// Returns the cached result if present, otherwise 404 with `needsTitles: true`.
// The frontend then fetches OpenAlex itself (from the user's IP, which avoids
// the rate-limit hammer that Cloudflare egress IPs catch) and re-posts.
async function handleAuthorGet(url, env, origin) {
    const name = (url.searchParams.get("name") || "").trim();
    const affiliation = (url.searchParams.get("affiliation") || "").trim();
    if (!name) return jsonResponse(400, { error: "name parameter required" }, origin);

    const cacheKey = (name + "|" + affiliation).toLowerCase();
    if (env.AUTHOR_CACHE) {
        const cached = await env.AUTHOR_CACHE.get(cacheKey, { type: "json" });
        if (cached) {
            return new Response(JSON.stringify({ ...cached, cached: true }), {
                status: 200,
                headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
            });
        }
    }
    return jsonResponse(404, { error: "cache miss", needsTitles: true }, origin);
}

// POST /api/author with body {name, affiliation, titles, openalexName?, openalexAffiliation?}
// Frontend supplies titles fetched from OpenAlex (browser-side, polite pool).
// Worker calls GPT to extract word banks, caches by (name|affiliation), returns.
async function handleAuthorPost(request, env, origin) {
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse(400, { error: "Invalid JSON body" }, origin); }

    const name = (body.name || "").trim();
    const affiliation = (body.affiliation || "").trim();
    const titles = Array.isArray(body.titles) ? body.titles.filter(t => typeof t === "string") : [];
    if (!name) return jsonResponse(400, { error: "name required" }, origin);
    if (!titles.length) return jsonResponse(400, { error: "titles required" }, origin);

    const cacheKey = (name + "|" + affiliation).toLowerCase();

    // Cache check (caller may not have done one)
    if (env.AUTHOR_CACHE) {
        const cached = await env.AUTHOR_CACHE.get(cacheKey, { type: "json" });
        if (cached) {
            return new Response(JSON.stringify({ ...cached, cached: true }), {
                status: 200,
                headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
            });
        }
    }

    let wordBanks;
    try {
        wordBanks = await gptExtract(titles, env);
    } catch (e) {
        return jsonResponse(502, { error: `GPT error: ${e.message}` }, origin);
    }
    if (!wordBanks || (wordBanks.task || []).length === 0) {
        return jsonResponse(502, { error: "GPT returned empty word banks" }, origin);
    }

    const result = {
        name: body.openalexName || name,
        affiliation: body.openalexAffiliation || affiliation || null,
        titles,
        wordBanks,
        timestamp: new Date().toISOString(),
    };

    if (env.AUTHOR_CACHE) {
        try {
            await env.AUTHOR_CACHE.put(cacheKey, JSON.stringify(result), {
                expirationTtl: CACHE_TTL_SECONDS,
            });
        } catch { /* best-effort */ }
    }

    return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            if (!isAllowedOrigin(origin, env)) {
                return new Response("Origin not allowed", { status: 403 });
            }
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (!isAllowedOrigin(origin, env)) {
            return new Response("Origin not allowed", { status: 403 });
        }

        if (!env.OPENAI_API_KEY) {
            return jsonResponse(500, { error: "Worker missing OPENAI_API_KEY secret" }, origin);
        }

        if (url.pathname === "/api/author") {
            if (request.method === "GET") return handleAuthorGet(url, env, origin);
            if (request.method === "POST") return handleAuthorPost(request, env, origin);
        }

        return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
    },
};
