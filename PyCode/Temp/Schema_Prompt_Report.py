#!/usr/bin/env python3
"""
Schema_Prompt_Report.py

Parses schema audit data from stdin and saves it as a structured JSON file:
./output/logs/<YYYY-MM-DD>/<Customer>/aeo/<Customer>_schema_prompt_data.json
"""
import sys
import json
import re
import html
from pathlib import Path
from datetime import datetime

def parse_llm_output(raw_output: str):
    """
    Parse messy LLM output (possibly double-encoded JSON, with or without ```json wrappers).
    """
    raw_output = raw_output.strip()

    cleaned = re.sub(r"^```[a-zA-Z]*|```$", "", raw_output, flags=re.MULTILINE).strip()

    try:
        temp = json.loads(cleaned)
        if isinstance(temp, str):
            cleaned = temp
    except Exception:
        pass

    match = re.search(r'\{[\s\S]*\}', cleaned)
    if not match:
        raise ValueError("No JSON object found in LLM output.")
    json_str = match.group(0)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        fixed = json_str.replace("'", '"')
        data = json.loads(fixed)

    return data


def build_sections(report_dict):
    """
    Extract and format sections (missing, outdated, etc.) from parsed JSON.
    """
    report = report_dict.get("auditReport", {})
    def format_items(section):
        items = report.get(section, [])
        formatted = []
        for item in items:
            if isinstance(item, dict):
                key = item.get("element") or item.get("improvement") or item.get("gain") or "Item"
                desc = item.get("description") or ""
                # Return a dictionary instead of an HTML string
                formatted.append({"key": key, "description": desc})
            elif isinstance(item, str):
                formatted.append({"key": "", "description": item})
        return formatted

    return {
        "missing": format_items("missingElements"),
        "outdated": format_items("outdatedElements"),
        "enhancements": format_items("enhancements"),
        "gains": format_items("visibilityGains"),
        "recommendations": format_items("finalRecommendations"),
    }

def compute_metrics(sections):
    """
    Derive quantitative metrics from section lengths.
    """
    missing = len(sections["missing"])
    outdated = len(sections["outdated"])
    enhancements = len(sections["enhancements"])
    gains = len(sections["gains"])
    score = max(100 - (missing * 5 + outdated * 3), 0)

    return {
        "health_score": score,
        "missing_count": missing,
        "outdated_count": outdated,
        "enhancements_count": enhancements,
        "potential_gain": min(100, gains * 10)
    }

def prepare_schema_data(client_name, data):
    """
    Prepares a dictionary with all the data needed for the final report.
    """
    sections = build_sections(data)
    metrics = compute_metrics(sections)

    return {
        "client_name": client_name,
        "metrics": metrics,
        "sections": sections
    }

def slugify(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name).lower()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python Schema_Prompt_Report.py <client_name>", file=sys.stderr)
        sys.exit(1)

    client_name = sys.argv[1]
    raw_input_data = sys.stdin.read()
    if not raw_input_data.strip():
        print("Error: Received empty input from stdin. Cannot generate schema report.", file=sys.stderr)
        sys.exit(2)


    try:
        # Parse the raw LLM output
        parsed_data = parse_llm_output(raw_input_data)
        
        # Prepare the structured data for JSON output
        report_data = prepare_schema_data(client_name, parsed_data)
        
        # Define output path
        date_str = datetime.now().strftime("%Y-%m-%d")
        customer_cap = client_name.capitalize()
        output_dir = Path(f"./output/logs/{date_str}/{customer_cap}/aeo")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        slug = slugify(client_name)
        json_output_path = output_dir / f"{slug}_schema_prompt_data.json"

        # Save the data to a JSON file
        with open(json_output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=4)
            
        print(f"Successfully processed and saved schema prompt data to {json_output_path}")

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        # Optionally, save the raw input for debugging
        debug_path = Path(f"./output/logs/failed_schema_input_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
        debug_path.write_text(raw_input_data, encoding='utf-8')
        print(f"Raw input saved to {debug_path} for debugging.", file=sys.stderr)
        sys.exit(1)
