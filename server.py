import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import requests
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__, static_folder=".", static_url_path="")

CACHE_DIR = Path(os.getenv("CACHE_DIR", Path(__file__).parent / "cache"))
CACHE_FILE = CACHE_DIR / "authors.json"
CACHE_MAX_AGE = timedelta(days=5)

OPENALEX_BASE = "https://api.openalex.org"


def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache):
    CACHE_DIR.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def is_cache_fresh(entry):
    ts = datetime.fromisoformat(entry["timestamp"])
    return datetime.now() - ts < CACHE_MAX_AGE


def resolve_institution(affiliation):
    """Resolve a user-supplied affiliation string (e.g. 'UIUC', 'KCL',
    'Berkeley') to an OpenAlex institution. Returns (id, display_name)
    or (None, None) if no match.
    """
    if not affiliation:
        return None, None
    try:
        resp = requests.get(
            f"{OPENALEX_BASE}/institutions",
            params={"search": affiliation, "per-page": 1},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None, None
        inst = results[0]
        return inst["id"].split("/")[-1], inst.get("display_name")
    except requests.RequestException:
        return None, None


def fetch_author_titles(name, affiliation=""):
    """Search OpenAlex for an author and return their paper titles.

    If `affiliation` is given, it is first resolved to an OpenAlex institution
    ID (so abbreviations like UIUC/KCL/MIT work). Author candidates and per-work
    filtering then match by that institution ID. Falls back to substring match
    on display_name / raw_affiliation_strings if resolution fails.
    """
    # Resolve affiliation to an institution ID (handles abbreviations)
    inst_id, inst_name = resolve_institution(affiliation)
    aff_lower = affiliation.lower() if affiliation else ""

    resp = requests.get(
        f"{OPENALEX_BASE}/authors",
        params={"search": name, "per-page": 10},
        timeout=10,
    )
    resp.raise_for_status()
    candidates = resp.json().get("results", [])
    if not candidates:
        return None, None, []

    if affiliation:
        def matches(c):
            insts = c.get("last_known_institutions") or []
            if inst_id and any((i.get("id") or "").split("/")[-1] == inst_id for i in insts):
                return True
            if aff_lower and any(aff_lower in (i.get("display_name") or "").lower() for i in insts):
                return True
            return False
        m = [c for c in candidates if matches(c)]
        if m:
            author = max(m, key=lambda c: c.get("works_count") or 0)
        else:
            # No affiliation match — fall back to most-cited candidate
            author = max(candidates, key=lambda c: c.get("cited_by_count") or 0)
    else:
        # No affiliation provided — pick the most-cited candidate
        author = max(candidates, key=lambda c: c.get("cited_by_count") or 0)

    author_id = author["id"].split("/")[-1]
    author_name = author.get("display_name") or name
    insts = author.get("last_known_institutions") or []
    author_aff = ", ".join(i.get("display_name") for i in insts if i.get("display_name")) or None

    # Fetch up to 200 works, sorted by citation count so the most impactful
    # papers are kept after filtering.
    resp2 = requests.get(
        f"{OPENALEX_BASE}/works",
        params={
            "filter": f"author.id:{author_id}",
            "per-page": 200,
            "select": "title,type,authorships,cited_by_count",
            "sort": "cited_by_count:desc",
        },
        timeout=15,
    )
    resp2.raise_for_status()
    works = resp2.json().get("results", [])

    seen = set()
    titles = []
    for w in works:
        t = w.get("title")
        if not t:
            continue

        # Skip non-paper entries (proceedings volumes etc.)
        if w.get("type") and w["type"] not in ("article", "book-chapter", "preprint"):
            continue

        # Find the authorship matching our author
        matched_authorship = None
        for a in w.get("authorships", []) or []:
            au = a.get("author") or {}
            if au.get("id") and au["id"].split("/")[-1] == author_id:
                matched_authorship = a
                break

        # If affiliation provided, require it to appear on this specific work
        if affiliation and matched_authorship:
            ws_insts = matched_authorship.get("institutions") or []
            raw_strs = matched_authorship.get("raw_affiliation_strings") or []
            id_match = inst_id and any(
                (i.get("id") or "").split("/")[-1] == inst_id for i in ws_insts
            )
            inst_match = aff_lower and any(
                aff_lower in (i.get("display_name") or "").lower() for i in ws_insts
            )
            raw_match = aff_lower and any(aff_lower in (s or "").lower() for s in raw_strs)
            # Also accept if the resolved canonical name appears as substring
            canonical_match = (
                inst_name and any(
                    inst_name.lower() in (s or "").lower() for s in raw_strs
                )
            )
            if not (id_match or inst_match or raw_match or canonical_match):
                continue

        key = t.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        titles.append(t)

        if len(titles) >= 100:
            break

    return author_name, author_aff, titles


def gpt_extract(titles):
    """Use GPT to extract the full word bank from an author's paper titles."""
    client = OpenAI()

    titles_text = "\n".join(f"- {t}" for t in titles[:100])

    prompt = f"""You are analyzing paper titles from a researcher. Extract research terms structured for use as building blocks in a paper-title generator.

Paper titles:
{titles_text}

The terms will be substituted into title patterns like:
  "{{learningvariant}} {{learningmethods}} for {{taskprevariant}} {{task}} in {{application}} {{taskpostvariant}}"
  e.g., "robust transformers for dexterous manipulation in dexterous hands with tactile feedback"

Return a JSON object with this exact schema. ALL fields are required and must be substantively populated:
{{
  "learningmethod": [...],
  "learningmethods": [...],
  "learningmethod_category": [...],
  "learningvariant": [...],
  "task": [...],
  "taskprevariant": {{"task_name_1": [...], "task_name_2": [...], ...}},
  "taskpostvariant": {{"task_name_1": [...], "task_name_2": [...], ...}},
  "application": [...]
}}

REQUIRED COUNTS:
- learningmethod: 8-15 entries (singular ML/AI methods; e.g., "transformer", "reinforcement learning", "diffusion policy")
- learningmethods: SAME length as learningmethod (plurals; for uncountable like "reinforcement learning", repeat the singular)
- learningmethod_category: SAME length as learningmethod (true=uncountable, false=countable)
- learningvariant: 8-15 short adjective modifiers (e.g., "robust", "zero-shot", "tactile-driven", "sample-efficient", "vision-guided")
- task: 10-20 research tasks (e.g., "manipulation", "grasping", "tactile sensing", "navigation", "pose estimation")
- application: 8-15 robot platforms / domains (e.g., "humanoids", "soft robots", "dexterous hands")
- taskprevariant: REQUIRED — populate entries for AT LEAST 8 tasks, with 3-6 entries each
- taskpostvariant: REQUIRED — populate entries for AT LEAST 8 tasks, with 3-6 entries each

PRE-VARIANT FORMAT — must be a single ADJECTIVE phrase (no preposition) that reads as "{{prevariant}} {{task}}":
  "manipulation": ["dexterous", "bimanual", "in-hand", "contact-rich", "vision-based", "deformable-object"]
  "grasping": ["multi-finger", "antipodal", "vision-based", "force-closure", "object-agnostic"]
  "navigation": ["visual", "long-horizon", "off-road", "social", "indoor", "vision-language"]
  "tactile sensing": ["high-resolution", "soft-skin", "vision-based", "multi-modal", "active"]

POST-VARIANT FORMAT — must START with a preposition or participle so "{{task}} {{postvariant}}" reads fluently. Allowed starters: "of", "with", "in", "for", "under", "using", "via", "over", "from", "during", "across", "without", "and", "through", "by".
  "manipulation": ["of deformable objects", "of cables", "in clutter", "with tactile feedback", "under occlusion", "from human demonstration"]
  "grasping": ["of unknown objects", "with tactile sensors", "in clutter", "under partial observation", "of fragile items"]
  "navigation": ["in dynamic environments", "under uncertainty", "with sparse rewards", "over rough terrain"]
  "tactile sensing": ["for slip detection", "with vision-based sensors", "for material recognition", "under contact"]

OTHER RULES:
- 1-5 words per entry. Lowercase except proper nouns/acronyms.
- Be diverse and creative: vary prepositions, modifiers, and topics. Avoid near-duplicates.
- Anchor terms in this author's work (synonyms welcome). Where titles imply a subfield, you may use idiomatic terms standard in that area.
- Keys in taskprevariant/taskpostvariant must EXACTLY match entries in the "task" list.
- Return valid JSON only, no markdown fences."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        response_format={"type": "json_object"},
    )

    try:
        result = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, IndexError):
        return {}

    methods = result.get("learningmethod", [])
    plurals = result.get("learningmethods", [])
    cats = result.get("learningmethod_category", [])
    while len(plurals) < len(methods):
        plurals.append(methods[len(plurals)] + "s")
    while len(cats) < len(methods):
        cats.append(False)
    plurals = plurals[:len(methods)]
    cats = cats[:len(methods)]
    # For uncountable methods, force plural == singular
    plurals = [methods[i] if cats[i] else plurals[i] for i in range(len(methods))]
    result["learningmethods"] = plurals
    result["learningmethod_category"] = cats

    for key in ["learningmethod", "learningmethods", "learningmethod_category",
                "learningvariant", "task", "application"]:
        result.setdefault(key, [])
    for key in ["taskprevariant", "taskpostvariant"]:
        result.setdefault(key, {})

    # Sanity-check post-variants: drop entries that don't start with a
    # preposition or participle, since they won't compose grammatically.
    valid_postvariant_starts = (
        "of ", "with ", "in ", "for ", "under ", "using ", "via ", "over ",
        "from ", "during ", "across ", "without ", "and ", "through ",
        "across ", "near ", "between ", "by ", "after ", "before ",
    )
    cleaned_post = {}
    for task, phrases in result["taskpostvariant"].items():
        kept = [p for p in (phrases or []) if isinstance(p, str)
                and p.strip().lower().startswith(valid_postvariant_starts)]
        if kept:
            cleaned_post[task] = kept
    result["taskpostvariant"] = cleaned_post

    # Drop pre/post-variant keys whose task isn't in the task list (lowercase
    # comparison so capitalisation differences don't bite).
    task_set = {t.lower() for t in result["task"]}
    for key in ("taskprevariant", "taskpostvariant"):
        result[key] = {
            k: v for k, v in result[key].items() if k.lower() in task_set
        }

    return result


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/author")
def get_author():
    name = request.args.get("name", "").strip()
    affiliation = request.args.get("affiliation", "").strip()
    if not name:
        return jsonify({"error": "name parameter required"}), 400

    cache_key = (name + "|" + affiliation).lower() if affiliation else name.lower()
    cache = load_cache()

    # Check cache
    if cache_key in cache and is_cache_fresh(cache[cache_key]):
        return jsonify(cache[cache_key])

    # Fetch papers from OpenAlex
    try:
        author_name, author_aff, titles = fetch_author_titles(name, affiliation)
    except requests.RequestException as e:
        return jsonify({"error": f"OpenAlex API error: {str(e)}"}), 502

    if not author_name:
        return jsonify({"error": f"Author '{name}' not found"}), 404

    if not titles:
        return jsonify({"error": f"No papers found for '{author_name}'"}), 404

    # Use GPT to extract the full word bank from titles
    try:
        word_banks = gpt_extract(titles)
    except Exception as e:
        return jsonify({"error": f"GPT extraction failed: {str(e)}"}), 502

    if not word_banks:
        return jsonify({"error": "GPT returned empty word banks"}), 502

    result = {
        "name": author_name,
        "affiliation": author_aff,
        "source": "openalex",
        "titles": titles,
        "wordBanks": word_banks,
        "timestamp": datetime.now().isoformat(),
    }

    cache[cache_key] = result
    save_cache(cache)

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
