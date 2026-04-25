// Cloudflare Worker — proxies OpenAI Chat Completions calls.
//
// Holds the shared OPENAI_API_KEY as a secret (set with
// `wrangler secret put OPENAI_API_KEY`). Only requests from the
// configured ALLOWED_ORIGIN are accepted, so the key cannot be used
// to drive arbitrary OpenAI traffic from other sites.

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
});

function isAllowedOrigin(origin, env) {
    if (!origin) return false;
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    return allowed.some(a => origin === a);
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            // CORS preflight
            if (!isAllowedOrigin(origin, env)) {
                return new Response("Origin not allowed", { status: 403 });
            }
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        if (!isAllowedOrigin(origin, env)) {
            return new Response("Origin not allowed", { status: 403 });
        }

        if (!env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: "Worker missing OPENAI_API_KEY secret" }),
                { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(
                JSON.stringify({ error: "Invalid JSON body" }),
                { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
            );
        }

        // Hard-pin the model and a few safety params so a malicious caller
        // can't ask for an expensive model with the shared key.
        const safeBody = {
            model: "gpt-4o-mini",
            messages: body.messages || [],
            temperature: typeof body.temperature === "number" ? body.temperature : 0.6,
            response_format: body.response_format || { type: "json_object" },
            max_tokens: 4096,
        };

        try {
            const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(safeBody),
            });

            const text = await upstream.text();
            return new Response(text, {
                status: upstream.status,
                headers: {
                    ...corsHeaders(origin),
                    "Content-Type": upstream.headers.get("Content-Type") || "application/json",
                },
            });
        } catch (err) {
            return new Response(
                JSON.stringify({ error: `Upstream fetch failed: ${err.message}` }),
                { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
            );
        }
    },
};
