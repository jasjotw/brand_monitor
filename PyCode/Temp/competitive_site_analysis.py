import json
import nltk
import requests
from bs4 import BeautifulSoup
import spacy
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
from sklearn.feature_extraction.text import TfidfVectorizer
import re
import subprocess
import json
import sys
import asyncio
from urllib.parse import urljoin, urlparse

# Download stopwords if not already
nltk.download('stopwords', quiet=True)
stop_words = set(nltk.corpus.stopwords.words('english'))

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Keyword extraction
def extract_keywords(text, top_n=10):
    if not text or not text.strip():
        return []
    doc = nlp(text)
    cleaned_tokens = [
        token.lemma_.lower()
        for token in doc
        if token.pos_ in ["NOUN", "PROPN", "VERB"]
        and not token.is_stop
        and token.is_alpha
        and len(token.text) > 3
    ]
    if not cleaned_tokens:
        return []
    processed_text = " ".join(cleaned_tokens)
    tfidf = TfidfVectorizer(
        stop_words='english',
        max_features=top_n,
        token_pattern=r'\b[a-zA-Z]{3,}\b'
    )
    tfidf_matrix = tfidf.fit_transform([processed_text])
    return tfidf.get_feature_names_out().tolist()

# Extract visible text from HTML
def extract_visible_text(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe", "header", "footer", "nav", "aside"]):
        tag.extract()
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n+', '\n', text)
    return text

# Extract metadata
def extract_all_metadata(url):
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')

        metadata = {
            "title": soup.title.string.strip() if soup.title else None,
            "meta_tags": [],
            "ld_json_scripts": []
        }

        for tag in soup.find_all("meta"):
            tag_data = {attr: value for attr, value in tag.attrs.items()}
            if tag_data:
                metadata["meta_tags"].append(tag_data)

        for script_tag in soup.find_all("script", type="application/ld+json"):
            if script_tag.string:
                metadata["ld_json_scripts"].append(script_tag.string.strip())

        return metadata

    except Exception as e:
        return {"error": str(e)}

# Robust sitemap discovery
def discover_sitemap_urls(base_url):
    discovered = set()

    parsed = urlparse(base_url)
    root_url = f"{parsed.scheme}://{parsed.netloc}"

    # 1. Check robots.txt
    try:
        robots_url = urljoin(root_url, "/robots.txt")
        resp = requests.get(robots_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                if line.strip().lower().startswith("sitemap:"):
                    sitemap_url = line.split(":", 1)[1].strip()
                    discovered.add(sitemap_url)
    except Exception:
        pass

    # 2. Check common default sitemap locations
    common_sitemaps = [
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/sitemap-index.xml"
    ]
    for path in common_sitemaps:
        candidate = urljoin(root_url, path)
        try:
            r = requests.get(candidate, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if r.status_code == 200 and "<sitemap" in r.text or "<urlset" in r.text:
                discovered.add(candidate)
        except Exception:
            continue

    return list(discovered)

# Parse sitemap files for URLs + nested links
def fetch_sitemap_data(url, sitemap_urls=None, sitemap_links=None):
    if sitemap_urls is None:
        sitemap_urls = {}
    if sitemap_links is None:
        sitemap_links = set()

    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if response.status_code != 200:
            return sitemap_urls, sitemap_links

        soup = BeautifulSoup(response.content, "xml")

        # Case 1: sitemapindex (nested sitemaps)
        for sitemap in soup.find_all("sitemap"):
            loc = sitemap.find("loc")
            if loc:
                loc_text = loc.text.strip()
                if loc_text not in sitemap_links:
                    sitemap_links.add(loc_text)
                    # Recursively fetch nested sitemaps
                    fetch_sitemap_data(loc_text, sitemap_urls, sitemap_links)

        # Case 2: urlset (direct URLs)
        for url_tag in soup.find_all("url"):
            loc = url_tag.find("loc")
            lastmod = url_tag.find("lastmod")
            if loc:
                sitemap_urls[loc.text.strip()] = lastmod.text.strip() if lastmod else None

    except Exception:
        pass

    return sitemap_urls, sitemap_links

# Main scraping function
async def run_scraper(url, depth=1):
    browser_conf = BrowserConfig(headless=True)
    config = CrawlerRunConfig(
        deep_crawl_strategy=BestFirstCrawlingStrategy(
            max_depth=depth,
            include_external=False
        ),
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.6)
        )
    )

    output = []
    discovered_urls = []  # store all URLs found via crawl4ai

    async with AsyncWebCrawler(config=browser_conf) as crawler:
        results = await crawler.arun(url=url, config=config)

        for result in results:
            discovered_urls.append(result.url)  # add crawled/discovered URLs

            if result.success:
                try:
                    raw_html = result.html
                    cleaned_text = extract_visible_text(raw_html)
                    keywords = extract_keywords(cleaned_text)
                    metadata = extract_all_metadata(result.url)
                    output.append({
                        "status": "success",
                        "url": result.url,
                        "keywords": keywords,
                        "content": cleaned_text,
                        "metadata": metadata
                    })
                except Exception as e:
                    output.append({
                        "status": "error",
                        "url": result.url,
                        "error": str(e)
                    })
            else:
                output.append({
                    "status": "failed",
                    "url": result.url,
                    "status_code": result.status_code
                })

    # Robust sitemap discovery
    sitemap_sources = discover_sitemap_urls(url)

    sitemap_urls = {}
    sitemap_links = set()
    for sitemap in sitemap_sources:
        sitemap_urls, sitemap_links = fetch_sitemap_data(sitemap, sitemap_urls, sitemap_links)

    final_output = {
        "crawled_data": output,
        "crawl4ai_discovered_urls": discovered_urls,
        "sitemap_urls": sitemap_urls,      # dict: {url: lastmod}
        "sitemap_links": list(sitemap_links),
        "sitemap_sources_checked": sitemap_sources
    }

    print(json.dumps(final_output, indent=2))

# Entry point
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python website_scraper.py <URL> [depth]")
        sys.exit(1)

    url = sys.argv[1]
    depth = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    asyncio.run(run_scraper(url, depth))