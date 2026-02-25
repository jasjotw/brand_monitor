import pandas as pd
import re
from collections import Counter
from html import unescape

# ------------------------------
# Enhanced Interpret Functions (with normalization)
# ------------------------------

STOPWORDS = {
    "the","and","a","an","of","in","on","for","to","with","by","is","are","was","were","that",
    "this","it","as","at","from","or","be","has","have","had","not","but","they","their","its",
    "if","we","can","will","which","you","your","i"
}

def interpret_meta(meta_df):
    if meta_df is None or meta_df.empty:
        return {
            "summary": "No meta data available.",
            "meaning": "Meta titles and descriptions are essential for search engine visibility and click-through rates.",
            "red_flags": ["No meta data was collected — this suggests a crawling issue or missing extraction."],
            "details": "Each page should have a unique and descriptive meta title and meta description."
        }

    df = meta_df.copy()
    for col in ["title_missing", "description_missing"]:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0).astype(int)

    total = len(df)
    missing_titles = int(df["title_missing"].sum())
    missing_desc = int(df["description_missing"].sum())

    summary = f"Out of {total} pages, {missing_titles} missing titles, {missing_desc} missing descriptions."
    meaning = "Meta tags help search engines understand content and influence click-through rates in SERPs."
    red_flags = []
    if missing_titles > 0:
        red_flags.append(f"{missing_titles} pages missing titles (should be 0).")
    if missing_desc > 0:
        red_flags.append(f"{missing_desc} pages missing descriptions (should be minimized).")
    details = "Pages without titles or descriptions risk poor rankings and unattractive snippets in search results."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_headings(headings_df):
    if headings_df is None or headings_df.empty:
        return {
            "summary": "No heading data available.",
            "meaning": "Headings (especially H1) are important for SEO&AEO structure and keyword targeting.",
            "red_flags": ["No heading data found — may indicate issues in extraction or missing HTML structure."],
            "details": "Each page should have one clear H1. Multiple or missing H1s weaken SEO&AEO hierarchy."
        }

    df = headings_df.copy()
    for col in ["missing_h1", "multiple_h1"]:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0).astype(int)

    total = len(df)
    missing_h1 = int(df["missing_h1"].sum())
    multiple_h1 = int(df["multiple_h1"].sum())

    summary = f"Checked {total} pages: {missing_h1} missing H1, {multiple_h1} with multiple H1s."
    meaning = "H1s provide structure and signal primary topic to search engines."
    red_flags = []
    if missing_h1 > 0:
        red_flags.append(f"{missing_h1} pages missing H1 (bad for SEO&AEO).")
    if multiple_h1 > 0:
        red_flags.append(f"{multiple_h1} pages have multiple H1s (confuses search engines).")
    details = "Ideally, each page should have exactly one descriptive H1."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_canonicals(canon_df):
    if canon_df is None or canon_df.empty:
        return {
            "summary": "No canonical data available.",
            "meaning": "Canonical tags help prevent duplicate content issues.",
            "red_flags": ["No canonical data collected — may result in duplicate content risks."],
            "details": "Every page should declare a self-referencing or valid canonical tag."
        }

    df = canon_df.copy()
    for col in ["canonical_missing", "self_referencing"]:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0).astype(int)

    total = len(df)
    missing = int(df["canonical_missing"].sum())
    self_refs = int(df["self_referencing"].sum())

    summary = f"{missing}/{total} pages missing canonicals, {self_refs} are self-referencing."
    meaning = "Canonicals consolidate duplicate URLs to avoid dilution of ranking signals."
    red_flags = []
    if missing > 0:
        red_flags.append(f"{missing} pages missing canonical tags.")
    if self_refs < total:
        red_flags.append(f"{total - self_refs} pages not self-referencing (check canonical setup).")
    details = "Incorrect canonicals can cause indexation issues and duplicate content penalties."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_status(status_df):
    """
    Extended status check: report counts, presence of 3xx, 4xx, 5xx, and many 302s or 301s.
    """
    if status_df is None or status_df.empty:
        return {
            "summary": "No status code data available.",
            "meaning": "HTTP status codes reflect crawlability and indexability.",
            "red_flags": ["No status codes detected — may indicate a crawl issue."],
            "details": ""
        }

    df = status_df.copy()
    df["status"] = pd.to_numeric(df.get("status", pd.Series(dtype=int)), errors="coerce").fillna(0).astype(int)
    total = len(df)
    code_counts = df["status"].value_counts().to_dict()
    top_codes = ", ".join([f"{k}: {v}" for k, v in code_counts.items()][:5])

    summary = f"Checked {total} URLs. Status distribution → {top_codes}"
    meaning = "Status codes show accessibility of pages to users and bots."
    red_flags = []
    if any(str(c).startswith("4") for c in code_counts.keys()):
        red_flags.append("Presence of 4xx errors (broken links).")
    if any(str(c).startswith("5") for c in code_counts.keys()):
        red_flags.append("Presence of 5xx errors (server issues).")
    if any(str(c).startswith("3") for c in code_counts.keys()):
        red_flags.append("Presence of 3xx responses (redirects) in crawl — check if expected.")
    details = "Fixing error codes ensures pages can be crawled and indexed."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}



def interpret_sitemap_vs_crawl(comp_df):
    if comp_df is None or comp_df.empty:
        return {
            "summary": "No sitemap vs crawl comparison available.",
            "meaning": "Comparing sitemap and crawl ensures all important URLs are indexed.",
            "red_flags": ["No data available to compare sitemap and crawl."],
            "details": "Pages missing from sitemap or crawl may be unindexed or orphaned."
        }

    df = comp_df.copy()
    for col in ["orphaned", "uncatalogued"]:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0).astype(int)

    orphaned = int(df["orphaned"].sum())
    uncatalogued = int(df["uncatalogued"].sum())
    total = len(df)

    summary = f"Compared {total} URLs. {orphaned} orphaned, {uncatalogued} uncatalogued."
    meaning = "Orphaned pages are not internally linked; uncatalogued pages may miss exposure."
    red_flags = []
    if orphaned > 0:
        red_flags.append(f"{orphaned} orphaned pages found.")
    if uncatalogued > 0:
        red_flags.append(f"{uncatalogued} uncatalogued pages found.")
    details = "Ensure all important pages appear in both crawl and sitemap."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_url_structure(url_struct_df):
    """
    Adds duplicate detection (ignoring query strings) and query-parameter abuse checks.
    Expects columns: url, url_path_depth, url_length (existing) but will handle missing too.
    """
    if url_struct_df is None or url_struct_df.empty:
        return {
            "summary": "No URL structure data available.",
            "meaning": "URL length and depth affect crawl efficiency and user experience.",
            "red_flags": ["No URL structure data found."],
            "details": "Short, descriptive URLs are better for AEO."
        }

    df = url_struct_df.copy()
    # ensure helpful columns exist
    df["url"] = df.get("url", pd.Series([""]*len(df))).astype(str)
    # derive path depth and length if missing
    def depth(u):
        try:
            path = re.sub(r"https?://[^/]+","",u)
            if not path or path == "/": return 0
            return len([p for p in path.split("/") if p.strip()])
        except:
            return 0
    df["url_path_depth"] = pd.to_numeric(df.get("url_path_depth", df["url"].apply(depth)), errors="coerce").fillna(0).astype(int)
    df["url_length"] = pd.to_numeric(df.get("url_length", df["url"].str.len()), errors="coerce").fillna(0).astype(int)

    total = len(df)
    avg_depth = df["url_path_depth"].mean()
    avg_length = df["url_length"].mean()

    # duplicate detection ignoring query strings
    def strip_query(u):
        return u.split("?")[0].rstrip("/")
    df["url_noquery"] = df["url"].apply(strip_query)
    dup_count = df["url_noquery"].duplicated(keep=False).sum()
    dup_groups = df.groupby("url_noquery").size().loc[lambda s: s > 1].shape[0]

    # query parameter abuse: count urls with >1 query param, or same path with many queries
    df["has_query"] = df["url"].str.contains(r"\?")
    df["query_param_count"] = df["url"].apply(lambda u: len(re.findall(r"[?&]([^=&#]+)=", u)))
    many_query = df[df["query_param_count"] > 1].shape[0]

    summary = f"Analyzed {total} URLs. Avg path depth = {avg_depth:.2f}, Avg length = {avg_length:.1f}."
    meaning = "Deep or long URLs and query-parameter proliferation can harm crawl efficiency."
    red_flags = []
    if avg_depth > 5:
        red_flags.append("High average URL depth (may be buried in site).")
    if avg_length > 100:
        red_flags.append("Excessive URL length (not AEO/SEO-friendly).")
    if dup_groups > 0:
        red_flags.append(f"{dup_groups} URL groups have duplicates when ignoring query parameters (possible canonicalization issues).")
    if many_query / max(total,1) > 0.05:
        red_flags.append("Several URLs have multiple query parameters (may cause duplicate content or indexing noise).")

    details = f"Duplicate URL groups (ignoring queries): {dup_groups}, URLs with >1 query param: {many_query}"

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_redirects(redirects_df):
    """
    Detects long chains and loops. expects columns 'url' and 'redirect_url' and optional 'redirect_times'
    """
    if redirects_df is None or redirects_df.empty:
        return {
            "summary": "No redirects found",
            "meaning": "Site structure is clean. No redirect chains wasting crawl budget.",
            "red_flags": [],
            "details": "No action needed. Having zero redirects is optimal."
        }

    df = redirects_df.copy()
    df["redirect_times"] = pd.to_numeric(df.get("redirect_times", 0), errors="coerce").fillna(0).astype(int)
    # build redirect map
    mapping = {}
    for _, r in df.iterrows():
        src = str(r.get("url","")).strip()
        tgt = str(r.get("redirect_url","")).strip()
        if src and tgt:
            mapping[src] = tgt

    # detect longest chain by following mapping
    longest_chain = 0
    loops = []
    for start in mapping:
        seen = {}
        cur = start
        step = 0
        while cur in mapping and cur not in seen:
            seen[cur] = step
            cur = mapping[cur]
            step += 1
        if cur in seen:
            # loop detected
            loop_nodes = list(seen.keys())[seen[cur]:]
            loops.append(loop_nodes)
        longest_chain = max(longest_chain, step)

    total_steps = len(df)
    unique_urls = len(set([u.strip().rstrip("/") for u in df["url"].astype(str)]))
    summary = f"Found {total_steps} redirect steps across {unique_urls} unique URLs. Longest chain length: {longest_chain}."
    meaning = "Redirects affect crawl efficiency and link equity. Long chains or loops should be avoided."
    red_flags = []
    if longest_chain > 2:
        red_flags.append(f"Long redirect chain detected (length {longest_chain}).")
    if loops:
        red_flags.append(f"Redirect loop(s) detected involving {len(loops)} chain(s). Loops should be resolved.")

    details = f"Redirect loops found: {len(loops)}. Longest chain: {longest_chain}."
    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_internal_links(nodes_df, edges_df):
    if nodes_df is None or nodes_df.empty:
        return {
            "summary": "No internal link data available.",
            "meaning": "Internal linking distributes PageRank and helps crawlers discover content.",
            "red_flags": ["No internal link data found."],
            "details": "A strong internal link structure boosts visibility of important pages."
        }

    df_nodes = nodes_df.copy()
    df_nodes["pagerank"] = pd.to_numeric(df_nodes.get("pagerank", 0), errors="coerce").fillna(0)
    df_nodes["url"] = df_nodes["url"].astype(str).str.strip().str.lower().str.rstrip("/")

    total_pages = len(df_nodes)
    total_links = len(edges_df) if edges_df is not None else 0
    avg_links_per_page = total_links / max(total_pages, 1)

    top_pages = df_nodes.sort_values("pagerank", ascending=False).head(5)["url"].tolist()

    summary = f"Graph has {total_pages} pages, {total_links} links. Top pages (PageRank): {', '.join(top_pages)}."
    meaning = "Pages with higher PageRank are considered more important internally."
    red_flags = []
    # threshold: average less than 1.5 means weak connectivity (tunable)
    if avg_links_per_page < 1.5:
        red_flags.append("Low average internal links per page (site may be poorly connected).")
    # also flag if pagerank distribution is too concentrated
    pr_vals = df_nodes["pagerank"].sort_values(ascending=False).values
    if len(pr_vals) >= 2 and pr_vals[0] > (pr_vals[1] * 5):
        red_flags.append("PageRank is overly concentrated in a single page (one page dominates internal authority).")

    details = f"Avg links/page: {avg_links_per_page:.2f}. Top pages by PR: {', '.join(top_pages[:3])}"
    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}



def interpret_robots(df):
    if df is None or df.empty:
        return {
            "summary": "No robots.txt data collected.",
            "meaning": "robots.txt defines which crawlers can or cannot access your site.",
            "red_flags": ["No robots.txt detected — crawlers may attempt to access all pages."],
            "details": ""
        }

    directives = df['directive'].dropna().astype(str).str.strip().str.lower().unique()

    red_flags = []
    if not any("user-agent" in d for d in directives):
        red_flags.append("No 'User-agent' directives — robots.txt may be malformed or ambiguous.")
    if not any("sitemap" in d for d in directives):
        red_flags.append("No sitemap reference found in robots.txt.")

    counts = df['directive'].dropna().astype(str).str.strip().str.lower().value_counts().to_dict()
    summary_parts = [f"{count} {dtype}" for dtype, count in counts.items()]
    summary = f"robots.txt contains {len(df)} directives: " + ", ".join(summary_parts)

    return {
        "summary": summary,
        "meaning": "robots.txt provides directives such as which user-agents are allowed or disallowed, and where the sitemap is located.",
        "red_flags": red_flags,
        "details": "User-agent directives define which bots rules apply to. Without them, other directives might apply to nobody or be ambiguous."
    }



def interpret_ngrams(ngram_df, n=1, top_k=10):
    """
    Filters out stopwords and obvious short/noise tokens before reporting n-grams.
    Assumes ngram_df first column = phrase, second column = count.
    """
    if ngram_df is None or ngram_df.empty:
        return {
            "summary": f"No {n}-gram data available.",
            "meaning": f"{n}-grams show frequent {('words' if n==1 else 'phrases')} on the site.",
            "red_flags": [],
            "details": "No data was extracted."
        }

    df = ngram_df.rename(columns={ngram_df.columns[0]: "ngram", ngram_df.columns[1]: "count"}).copy()
    df["ngram"] = df["ngram"].astype(str).str.strip().str.lower().apply(unescape)
    df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype(int)

    # filter stopwords / noise
    def keep(phrase):
        tokens = re.findall(r"\w+", phrase)
        if not tokens:
            return False
        if any(len(t) <= 1 for t in tokens):  # token of length 1 => probably noise
            pass
        # remove if all tokens are stopwords
        if all(t in STOPWORDS for t in tokens):
            return False
        # remove tokens that are probably layout or separators
        if re.search(r"[|&<>/\\=]", phrase):
            return False
        return True

    df = df[df["ngram"].apply(keep)]
    if df.empty:
        return {
            "summary": f"No meaningful {n}-grams after cleanup.",
            "meaning": "Content may be too short or extraction captured noisy layout text.",
            "red_flags": [],
            "details": ""
        }

    df = df.sort_values("count", ascending=False)
    top = df.head(top_k)

    total_unique = len(df)
    total_occurrences = int(df["count"].sum())

    # detect dominance: if top term accounts for >30%
    top_share = top.iloc[0]["count"] / max(total_occurrences, 1)
    red_flags = []
    if top_share > 0.3:
        red_flags.append(f"Top {n}-gram '{top.iloc[0]['ngram']}' dominates content ({top_share:.0f}% of occurrences).")

    summary = f"Found {total_unique} meaningful {n}-grams, {total_occurrences} total occurrences."
    meaning = (f"{n}-grams show the site's most frequent {('words' if n==1 else 'phrases')}.")
    details = "Top examples: " + ", ".join([f"{row['ngram']} ({row['count']})" for _, row in top.iterrows()])

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}



def interpret_rendering_mode(df):
    """
    Accepts a df with multiple rows of rendering checks (url, rendering_mode, text_length, script_count).
    Produces a summary across pages.
    """
    if df is None or df.empty:
        return {
            "summary": "No rendering mode information was collected.",
            "meaning": "Could not determine rendering modes across pages.",
            "red_flags": [],
            "details": ""
        }

    rows = []
    for _, r in df.iterrows():
        mode = str(r.get("rendering_mode","")).strip()
        text_len = int(pd.to_numeric(r.get("text_length",0), errors="coerce").fillna(0))
        script_count = int(pd.to_numeric(r.get("script_count",0), errors="coerce").fillna(0))
        rows.append({"mode": mode, "text_len": text_len, "script_count": script_count})

    total = len(rows)
    client_side = sum(1 for r in rows if "client-side" in r["mode"].lower() or ("likely client" in r["mode"].lower()))
    noscript_present = sum(1 for r in rows if "noscript" in r["mode"].lower())
    avg_text = sum(r["text_len"] for r in rows) / total
    avg_scripts = sum(r["script_count"] for r in rows) / total

    summary = f"Analyzed rendering on {total} pages. {client_side} pages appear client-side rendered."
    meaning = "Client-side rendered pages may require JS execution for crawlers to see content."
    red_flags = []
    if client_side / total > 0.3:
        red_flags.append("Significant portion of sampled pages appear to be client-side rendered (>30%).")
    if avg_text < 200 and avg_scripts > 10:
        red_flags.append("Low extracted text and high script count on average — crawler visibility may be poor.")
    details = f"Avg text length: {avg_text:.0f}, Avg script count: {avg_scripts:.1f}, noscript artifacts: {noscript_present}"

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}

def interpret_schema(df):
    """
    Interpret schema.org usage across sampled pages.
    Expects columns: url, schema_present, schema_types, source
    """
    if df is None or df.empty:
        return {
            "summary": "No schema.org data was collected.",
            "meaning": "The site may not provide structured data across analyzed pages.",
            "red_flags": ["No schema.org data was detected in the sampled pages."],
            "details": ""
        }

    rows = []
    for _, r in df.iterrows():
        url = str(r.get("url", "")).strip()
        present_raw = r.get("schema_present", False)
        present = str(present_raw).strip().lower() in ("true", "1", "yes") if isinstance(present_raw, str) else bool(present_raw)
        types_raw = r.get("schema_types", "") or ""
        types = [t.strip() for t in re.split(r"[,\|;]+", str(types_raw)) if t and t.strip()]
        source = str(r.get("source", "unknown")).lower()
        rows.append({"url": url, "present": present, "types": types, "source": source})

    total = len(rows)
    present_count = sum(1 for r in rows if r["present"])
    present_pct = (present_count / max(total, 1)) * 100

    # count schema types overall
    type_counter = Counter()
    for r in rows:
        type_counter.update(r["types"])

    # count by source (crawl vs sitemap)
    source_counter = Counter(r["source"] for r in rows)

    summary = f"Checked {total} pages; structured data present on {present_count} pages ({present_pct:.0f}%)."
    meaning = "Structured data (schema.org) improves search engines' understanding and eligibility for rich results."
    red_flags = []
    if present_pct < 20:
        red_flags.append("Structured data present on very few pages (<20%). Consider adding schema to key pages.")
    details = (
        "Top schema types: "
        + (", ".join([f"{t} ({c})" for t, c in type_counter.most_common(10)]) if type_counter else "None detected")
        + f". Sources checked → Crawl: {source_counter.get('crawl', 0)}, Sitemap: {source_counter.get('sitemap', 0)}"
    )

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}


def interpret_llms(df):
    """
    Interpret llms.txt rules (if present).
    Looks for directives relevant to LLM crawlers (GPTBot, ClaudeBot, etc.)
    """
    if df is None or df.empty:
        return {
            "summary": "No llms.txt data collected.",
            "meaning": "llms.txt is a new convention for controlling how large language model crawlers (GPTBot, ClaudeBot, etc.) access your site.",
            "red_flags": ["No llms.txt detected — LLM crawlers may index all accessible pages."],
            "details": "Consider adding llms.txt if you want explicit control over AI bot usage."
        }

    directives = df['directive'].dropna().astype(str).str.strip().str.lower().unique()

    summary = f"llms.txt contains {len(df)} directives. Examples: {', '.join(df['directive'].head(5).astype(str))}"
    meaning = "Directives in llms.txt can allow/disallow AI crawlers from indexing your content."
    red_flags = []

    if not any("user-agent" in d for d in directives):
        red_flags.append("No 'User-agent' directives found — may cause ambiguity for which bots rules apply to.")

    blocked = df[df['directive'].str.lower() == "disallow"]
    if not blocked.empty:
        red_flags.append(f"{len(blocked)} disallow rules present — some content is restricted from LLM crawlers.")

    details = "Check that desired AI bots (GPTBot, ClaudeBot, PerplexityBot, etc.) have clear rules in llms.txt."

    return {"summary": summary, "meaning": meaning, "red_flags": red_flags, "details": details}
