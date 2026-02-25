import json
import os
import logging
from datetime import datetime
import chardet
import re

def validate_robots_txt(content: bytes, logger: logging.Logger) -> dict:
    """
    Validate robots.txt content against strict + best-practice rules.
    """
    result = {"file": "robots.txt", "valid": False, "issues": [], "warnings": []}

    # Validate input
    if not isinstance(content, bytes):
        result["issues"].append("Content must be bytes")
        logger.error("Invalid content type for robots.txt validation")
        return result

    # --- Encoding check ---
    enc = chardet.detect(content)["encoding"]
    if enc and enc.upper() not in ["UTF-8", "ASCII"]:
        result["issues"].append(f"Encoding is {enc}, expected UTF-8/ASCII")
    text = content.decode(enc or "utf-8", errors="replace")

    # --- Plain text check ---
    if not text.strip():
        result["issues"].append("File is empty")
        return result
    if re.search(r"<[^>]+>", text):
        result["issues"].append("File contains HTML, not plain text")

    # --- Split & track ---
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    allowed_directives = ("user-agent:", "allow:", "disallow:", "crawl-delay:", "sitemap:", "host:")

    user_agents = {}
    current_agents = []
    sitemap_seen = False
    ua_star_seen = False
    comment_count = 0

    for line in lines:
        lower = line.lower()

        # Comments
        if line.startswith("#"):
            comment_count += 1
            continue

        # User-agent
        if lower.startswith("user-agent:"):
            ua_value = line.split(":", 1)[1].strip()
            current_agents = [ua_value]
            if ua_value == "*":
                ua_star_seen = True
            if ua_value not in user_agents:
                user_agents[ua_value] = {
                    "allow": [],
                    "disallow": [],
                    "crawl-delay": []  # Initialize to avoid KeyError
                }
            continue

        # Allow / Disallow / Crawl-delay
        if lower.startswith(("allow:", "disallow:", "crawl-delay:")):
            if not current_agents:
                result["issues"].append(f"Rule without preceding User-agent: {line}")
            else:
                directive, value = line.split(":", 1)
                directive = directive.strip().lower()
                value = value.strip()
                for ua in current_agents:
                    # Store with hyphen
                    user_agents[ua][directive].append(value)
            continue

        # Sitemap
        if lower.startswith("sitemap:"):
            sitemap_seen = True
            sitemap_value = line.split(":", 1)[1].strip()
            if not (sitemap_value.startswith("http://") or sitemap_value.startswith("https://")):
                result["issues"].append(f"Sitemap not full URL: {sitemap_value}")
            continue

        # Host
        if lower.startswith("host:"):
            continue

        # Unknown directive
        if not lower.startswith(allowed_directives):
            result["issues"].append(f"Unknown directive: {line}")

    # --- Post checks ---
    if not user_agents:
        result["issues"].append("No User-agent groups found")
    if not ua_star_seen:
        result["warnings"].append("No User-agent:* directive (recommended)")
    if not sitemap_seen:
        result["issues"].append("No Sitemap directive found")
    if comment_count > len(lines) * 0.3:
        result["warnings"].append("Excessive comments in robots.txt")

    # --- Ambiguity checks ---
    for ua, rules in user_agents.items():
        conflicts = set(rules.get("allow", [])) & set(rules.get("disallow", []))
        for c in conflicts:
            result["issues"].append(f"Conflict for {ua}: both Allow and Disallow {c}")
        if len(rules.get("crawl-delay", [])) > 1:
            result["issues"].append(f"Ambiguous Crawl-delay for {ua}: {rules['crawl-delay']}")

    # --- Final validity ---
    if not result["issues"]:
        result["valid"] = True
    return result

def validate_from_assessment_json(json_path: str, customer_name: str, base_url: str, logger: logging.Logger) -> dict:
    """
    Read assessment.json, validate robots_txt, and save result in same dir.
    """
    try:
        with open(json_path, "r") as f:
            assessment_data = json.load(f)
    except FileNotFoundError:
        logger.error(f"Assessment JSON not found at {json_path}")
        return {"error": "Assessment JSON not found"}
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON at {json_path}")
        return {"error": "Invalid JSON"}
    
    robots_txt_content = assessment_data.get("robots_txt")
    if not robots_txt_content:
        logger.warning("No robots.txt content in assessment JSON")
        return {"error": "No robots.txt content"}
    
    # Validate
    result = validate_robots_txt(robots_txt_content.encode("utf-8"), logger)
    
    # Save in same directory
    output_dir = os.path.dirname(json_path)
    output_path = os.path.join(output_dir, f"{customer_name}_robots_validation.json")
    try:
        os.makedirs(output_dir, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        logger.info(f"Validation result saved to {output_path}")
    except Exception as e:
        logger.error(f"Failed to save validation result to {output_path}: {e}")
    
    return result