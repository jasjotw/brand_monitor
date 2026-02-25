############################################################################################################
#
# Site Assessment Tool v2
# A tool for assessing and extracting information from websites.
#
# Step 1: Sitemap Discovery and Parsing
# Step 2: Crawl the landing page and extract content
# Step 3: Get the list of links from the sitemap and crawl
# Step 4: Create Business Summary
#
# How to run: python pycode/site_assessment_v2.py 'https://www.welzin.ai'
#
# Developers: Aman, Prateek, Nishit
#
###############################################################################################################

import json
import requests
from bs4 import BeautifulSoup
import re
import sys
import asyncio
from urllib.parse import urljoin, urlparse
from datetime import datetime
import os
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
import logging
import site_validation
# import mongoDB_append


logging.getLogger("Crawl4AI").setLevel(logging.WARNING)

browser_cfg = BrowserConfig(verbose=False)
run_cfg = CrawlerRunConfig(verbose=False)

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'utils'))
# logging config
import logging_config


def discover_sitemaps_from_robots(base_url, logger):
    discovered = set()
    robots_txt_content = None
    llms_txt_content = ""
    parsed = urlparse(base_url)
    root_url = f"{parsed.scheme}://{parsed.netloc}"

    logger.info("--- Checking for sitemap in robots.txt ---")
    try:
        robots_url = urljoin(root_url, "/robots.txt")
        logger.info(f"Attempting to fetch robots.txt from: {robots_url}")
        resp = requests.get(robots_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            robots_txt_content = resp.text
            logger.info(f"Successfully fetched robots.txt. Content:\n{robots_txt_content}")

            for line in robots_txt_content.splitlines():
                if line.strip().lower().startswith("sitemap:"):
                    sitemap_url = line.split(":", 1)[1].strip()
                    logger.info(f"Found sitemap URL in robots.txt: {sitemap_url}")
                    discovered.add(sitemap_url)

            if discovered:
                logger.info(f"Total sitemap URLs found: {len(discovered)}")
                for url in discovered:
                    logger.info(f" - {url}")
            else:
                logger.info("No sitemap URLs found in robots.txt.")
        else:
            logger.warning(f"Failed to fetch robots.txt. Status code: {resp.status_code}")
    except Exception as e:
        logger.error(f"An error occurred while checking robots.txt: {e}")

    # Fetch llms.txt
    logger.info("--- Checking for llms.txt ---")
    try:
        llms_url = urljoin(root_url, "/llms.txt")
        logger.info(f"Attempting to fetch llms.txt from: {llms_url}")
        resp = requests.get(llms_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            llms_txt_content = resp.text.strip()
            logger.info("Successfully fetched llms.txt.")
        elif resp.status_code == 404:
            logger.warning("llms.txt path doesn't exist.")
        else:
            logger.warning(f"Failed to fetch llms.txt. Status code: {resp.status_code}")
    except Exception as e:
        logger.error(f"An error occurred while checking llms.txt: {e}")

    return {"sitemap_urls": list(discovered), "robots_txt_content": robots_txt_content, "llms_txt_content": llms_txt_content}


def discover_sitemaps_from_common_locations(base_url, logger):
    discovered = set()
    sitemap_files_content = {}
    parsed = urlparse(base_url)
    root_url = f"{parsed.scheme}://{parsed.netloc}"

    logger.info("--- Checking common sitemap locations ---")
    common_sitemaps = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-news.xml"]
    for path in common_sitemaps:
        candidate = urljoin(root_url, path)
        try:
            logger.info(f"Attempting to fetch sitemap from common location: {candidate}")
            r = requests.get(candidate, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if r.status_code == 200 and ("<sitemap" in r.text.lower() or "<urlset" in r.text.lower()):
                logger.info(f"Found sitemap at {candidate}.")
                discovered.add(candidate)
                sitemap_files_content[candidate] = r.text
                logger.info(f"Content of {candidate}:\n{r.text[:500]}...")
            else:
                logger.info(f"No sitemap found at {candidate} (Status: {r.status_code})")
        except Exception as e:
            logger.error(f"An error occurred while checking common sitemap location {candidate}: {e}")
            continue

    return {"sitemap_urls": list(discovered), "sitemap_files_content": sitemap_files_content}


def find_sitemaps(base_url, logger, check_robots=True, check_common=True):
    sitemaps = set()
    robots_txt_content = None
    sitemap_files_content = {}
    llms_txt_content = ""

    if check_robots:
        robots_data = discover_sitemaps_from_robots(base_url, logger)
        sitemaps.update(robots_data["sitemap_urls"])
        robots_txt_content = robots_data["robots_txt_content"]
        llms_txt_content = robots_data["llms_txt_content"]

    if check_common and not sitemaps:
        common_sitemaps_data = discover_sitemaps_from_common_locations(base_url, logger)
        sitemaps.update(common_sitemaps_data["sitemap_urls"])
        sitemap_files_content.update(common_sitemaps_data["sitemap_files_content"])

    if not sitemaps:
        logger.warning("No sitemaps found.")

    return {
        "sitemap_urls": list(sitemaps),
        "robots_txt_content": robots_txt_content,
        "sitemap_files_content": sitemap_files_content,
        "llms_txt_content": llms_txt_content
    }


def get_sitemap_content(sitemap_url, logger):
    try:
        logger.info(f"Fetching sitemap content from: {sitemap_url}")
        r = requests.get(sitemap_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if r.status_code == 200:
            logger.info(f"Successfully fetched sitemap content from {sitemap_url}.")
            return r.text
        else:
            logger.warning(f"Failed to fetch sitemap content from {sitemap_url}. Status code: {r.status_code}")
            return None
    except Exception as e:
        logger.error(f"An error occurred while fetching sitemap content from {sitemap_url}: {e}")
        return None


async def crawl_landing_page(base_url, logger, crawler):
    logger.info("--- Step 2: Crawling landing page ---")
    crawled_data = {}
    logger.info(f"Crawling: {base_url}")
    try:
        result = await crawler.arun(url=base_url, config=run_cfg)
        if result.success:
            logger.info(f"Successfully crawled landing page: {base_url}")
            crawled_data[base_url] = {
                "status_code": 200,
                "content": result.markdown.raw_markdown,
                "html": result.html,
            }
        else:
            logger.error(f"crawl4ai failed to crawl landing page: {base_url}")
            crawled_data[base_url] = {"status_code": "Error", "error_message": "crawl4ai failed"}
    except Exception as e:
        logger.error(f"Error crawling {base_url}: {e}")
        crawled_data[base_url] = {"status_code": "Error", "error_message": str(e)}
    logger.info("--- Finished crawling landing page ---")
    return crawled_data


async def crawl_sitemap_links(sitemap_data, logger, crawled_data, crawler, run_cfg):
    logger.info("--- Step 3: Extracting and crawling sitemap links ---")

    sitemap_urls = sitemap_data.get("sitemap_urls", [])
    sitemap_files_content = sitemap_data.get("sitemap_files_content", {})
    all_links = []
    fetched_xmls = set()
    MAX_URLS_GLOBAL = 1  # stop after 10 webpages total

    async def fetch_and_parse_sitemap(url):
        if url in fetched_xmls or len(all_links) >= MAX_URLS_GLOBAL:
            return
        fetched_xmls.add(url)
        logger.info(f"Fetching and parsing sitemap: {url}")

        if url not in sitemap_files_content:
            content = get_sitemap_content(url, logger)
            if not content:
                logger.warning(f"Failed to fetch sitemap XML: {url}")
                return
            sitemap_files_content[url] = content
        else:
            content = sitemap_files_content[url]

        try:
            soup = BeautifulSoup(content, "xml")
            loc_tags = soup.find_all("loc")
            for loc in loc_tags:
                if len(all_links) >= MAX_URLS_GLOBAL:
                    break
                loc_url = loc.text.strip()
                if loc_url.endswith(".xml"):
                    logger.info(f"Found nested sitemap: {loc_url}")
                    await fetch_and_parse_sitemap(loc_url)
                else:
                    logger.info(f"Found page URL in sitemap: {loc_url}")
                    all_links.append(loc_url)
        except Exception as e:
            logger.error(f"Error parsing sitemap {url}: {e}")

    await asyncio.gather(*(fetch_and_parse_sitemap(url) for url in sitemap_urls))
    logger.info(f"Collected {len(all_links)} page URLs (limit {MAX_URLS_GLOBAL}).")

    links_to_crawl = list(all_links)
    logger.info(f"Crawling {len(links_to_crawl)} links from sitemap...")

    async def crawl_link(link):
        if link in crawled_data:
            logger.info(f"Skipping already crawled link: {link}")
            return
        logger.info(f"Crawling: {link}")
        try:
            result = await crawler.arun(url=link, config=run_cfg)
            if result.success:
                logger.info(f"Successfully crawled: {link}")
                crawled_data[link] = {
                    "status_code": 200,
                    "content": result.markdown.raw_markdown,
                    "html": result.html
                }
            else:
                logger.error(f"crawl4ai failed to crawl: {link}")
                crawled_data[link] = {"status_code": "Error", "error_message": "crawl4ai failed"}
        except Exception as e:
            logger.error(f"Error crawling {link}: {e}")
            crawled_data[link] = {"status_code": "Error", "error_message": str(e)}

    await asyncio.gather(*(crawl_link(link) for link in links_to_crawl))
    logger.info("--- Finished crawling sitemap links ---")
    return crawled_data


def parse_sitemap_structure(sm_url, sitemap_files_content, logger, depth=0):
    node = {"sitemap_xml": sm_url, "urls": [], "child_sitemaps": []}
    content = sitemap_files_content.get(sm_url)

    if not content:
        return node

    try:
        soup = BeautifulSoup(content, "xml")
        loc_tags = soup.find_all("loc")

        urls = []
        for loc in loc_tags:
            if len(urls) >= 1:  # stop after 10 urls per sitemap
                break
            loc_url = loc.text.strip()
            if loc_url.endswith(".xml"):
                logger.info(f"Discovered nested sitemap: {loc_url}")
                child_node = parse_sitemap_structure(loc_url, sitemap_files_content, logger, depth + 1)
                node["child_sitemaps"].append(child_node)
            else:
                urls.append(loc_url)

        node["urls"] = urls
    except Exception as e:
        logger.error(f"Error parsing sitemap XML {sm_url}: {e}")

    return node


def business_summary(customer_name, site_url, sitemap_data, crawled_data, logger):
    logger.info("--- Step 4: Creating business summary ---")

    sitemap_nested = []
    for sm_url in sitemap_data.get('sitemap_urls', []):
        sitemap_nested.append(
            parse_sitemap_structure(sm_url, sitemap_data.get("sitemap_files_content", {}), logger)
        )

    head_dict = {}
    schema_dict = {}

    for url, data in crawled_data.items():
        if 'html' in data and data['html']:
            logger.info(f"Extracting head and schema.org from: {url}")
            soup = BeautifulSoup(data['html'], 'html.parser')
            head_info = {}

            if soup.title and soup.title.string:
                head_info['title'] = soup.title.string.strip()

            metas = []
            for meta in soup.find_all('meta'):
                meta_dict = {}
                if meta.get('name'):
                    meta_dict['name'] = meta.get('name')
                if meta.get('property'):
                    meta_dict['property'] = meta.get('property')
                if meta.get('content'):
                    meta_dict['content'] = meta.get('content')
                if meta_dict:
                    metas.append(meta_dict)
            if metas:
                head_info['meta'] = metas

            links = []
            for link in soup.find_all('link'):
                link_dict = {}
                if link.get('rel'):
                    link_dict['rel'] = " ".join(link.get('rel'))
                if link.get('href'):
                    link_dict['href'] = link.get('href')
                if link_dict:
                    links.append(link_dict)
            if links:
                head_info['link'] = links

            head_dict[url] = head_info

            schema_items = []
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    schema_items.append(json.loads(script.string))
                except Exception as e:
                    logger.warning(f"Error parsing schema.org JSON on {url}: {e}")
                    continue
            schema_dict[url] = schema_items

    emails = set()
    for url, data in crawled_data.items():
        if 'content' in data and data['content']:
            found_emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', data['content'])
            emails.update(found_emails)

    summary = {
        "customer_name": customer_name,
        "date": datetime.now().isoformat(),
        "site_url": site_url,
        "Email_id": ", ".join(list(emails)) if emails else None,
        "sitemap_link": sitemap_nested,
        "robots_txt": sitemap_data.get('robots_txt_content'),
        "schema_org": schema_dict,
        "llms_txt": sitemap_data.get('llms_txt_content'),
        "keywords": '',
        "metadata": head_dict,
        "landing_page": None,
        "business_domain": None
    }

    logger.info("--- Finished creating business summary ---")
    return summary


async def main():
    if len(sys.argv) < 2:
        print("Usage: python site_assessment_v2.py <URL> [--no-robots] [--no-common]")
        sys.exit(1)

    url = sys.argv[1]
    check_robots = "--no-robots" not in sys.argv
    check_common = "--no-common" not in sys.argv

    # Ensure URL has a scheme
    if not urlparse(url).scheme:
        url = "https://" + url

    parsed_netloc = urlparse(url).netloc
    parts = parsed_netloc.split('.')
    
    if len(parts) >= 2:
        customer_name = parts[-2].capitalize()
    elif parts and parts[0]:
        customer_name = parts[0].capitalize()
    else:
        customer_name = "Unknown"

    logger = logging_config.setup_logging(customer_name, __file__)

    async with AsyncWebCrawler() as crawler:
        logger.info("--- Step 1: Sitemap Discovery and Parsing ---")
        sitemap_data = find_sitemaps(
            url, logger,
            check_robots=check_robots,
            check_common=check_common
        )

        if sitemap_data['sitemap_urls']:
            logger.info(f"Sitemaps found: {sitemap_data['sitemap_urls']}")
        if sitemap_data['robots_txt_content']:
            logger.info("robots.txt content successfully retrieved.")

        crawled_data = await crawl_landing_page(url, logger, crawler)
        crawled_data = await crawl_sitemap_links(
            sitemap_data, logger, crawled_data, crawler, run_cfg
        )

    summary_data = business_summary(
        customer_name, url, sitemap_data, crawled_data, logger
    )

    today_date = datetime.now().strftime('%Y-%m-%d')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    geo_root = os.path.abspath(os.path.join(script_dir, ".."))

    output_dir = os.path.join(geo_root, "output", "logs", today_date, customer_name)
    os.makedirs(output_dir, exist_ok=True)

    output_filename = f"{customer_name}_assessment.json"
    output_path = os.path.join(output_dir, output_filename)

    with open(output_path, "w") as f:
        json.dump(summary_data, f, indent=2)

    logger.info(f"Business summary saved to {output_path}")

    site_validation.validate_from_assessment_json(
        json_path=output_path,
        customer_name=customer_name,
        base_url=url,
        logger=logger
    )

    # mongoDB_append.insert_from_file(output_path, logger)

    with open(output_path, "r") as f:
        print(f.read())


if __name__ == "__main__":
    asyncio.run(main())
