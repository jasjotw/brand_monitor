#!/usr/bin/env python3
"""
AEO_Prompt_Report.py

Saves stdin to ./output/logs/<YYYY-MM-DD>/<Customer>/aeo/<Customer>_AEO_PageAudit.json
Then, it processes this data and saves the structured output as 
./output/logs/<YYYY-MM-DD>/<Customer>/aeo/<Customer>_aeo_prompt_data.json
"""
from __future__ import annotations
import sys
import os
import argparse
import json
import re
from pathlib import Path
from datetime import datetime

def robust_load_json_v2(path: Path | str):
    raw = Path(path).read_text(encoding='utf-8').strip()
    if not raw:
        raise ValueError("Empty input JSON.")
    if raw.startswith('"') and raw.endswith('"'):
        inner = raw[1:-1]
        try:
            unescaped = bytes(inner, "utf-8").decode("unicode_escape")
        except Exception:
            unescaped = inner
        raw = unescaped.strip()
    if raw.startswith("```json"):
        raw = raw[len("```json"):].lstrip("\n")
    if raw.startswith("```"):
        raw = raw[3:].lstrip("\n")
    if raw.endswith("```"):
        raw = raw[:-3].rstrip("\n")
    try:
        return json.loads(raw)
    except Exception as e:
        m = re.search(r"(\{.*\})", raw, flags=re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception as e2:
                raise ValueError(f"Failed to parse JSON via fallback: {e2}")
        raise ValueError(f"Failed to parse JSON: {e}")

def slugify(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name).lower()

def summarize_report(data: dict) -> dict:
    summary = {}
    scores = data.get("summaryScore", {}) if isinstance(data, dict) else {}
    summary['structuredCoverage'] = scores.get('structuredCoverage', None)
    summary['unstructuredCoverage'] = scores.get('unstructuredCoverage', None)
    summary['optimizationOpportunities'] = scores.get('optimizationOpportunities', None)
    summary['overallAEOReadiness'] = scores.get('overallAEOReadiness', None)

    structured = data.get("structuredContent", []) if isinstance(data, dict) else []
    scount = {'valid':0,'incorrect':0,'missing':0,'other':0}
    for s in structured:
        st = (s.get("status","other") or "other").lower()
        if st in scount:
            scount[st]+=1
        else:
            scount['other']+=1
    summary['schema_counts'] = scount
    summary['total_schemas'] = len(structured)

    unstr = data.get("unstructuredContent", []) if isinstance(data, dict) else []
    ucounts = {}
    for u in unstr:
        t = u.get("contentType","unknown")
        ucounts[t] = ucounts.get(t,0)+1
    summary['unstructured_counts'] = ucounts
    summary['total_unstructured'] = len(unstr)

    opt = data.get("optimizationSuggestions", []) if isinstance(data, dict) else []
    summary['optimization_count'] = len(opt)

    case_metrics = []
    for u in unstr:
        txt = (u.get("textOrAlt") or "") + " " + (u.get("reasonItIsImportant") or "")
        for tok in txt.split():
            if tok.endswith('%') and tok[:-1].replace('.','',1).isdigit():
                case_metrics.append(tok)
    summary['case_metrics_found'] = case_metrics
    return summary

def prepare_aeo_data(data: dict, summary: dict, customer_name: str) -> dict:
    """Prepares a dictionary with all the data needed for the final report."""
    
    root_causes_list = []
    suggestions = data.get("optimizationSuggestions", [])
    if suggestions:
        for s in suggestions:
            if isinstance(s, dict) and s.get("reason"):
                root_causes_list.append(s.get("reason"))
    root_causes_summary = "; ".join(root_causes_list) + "." if root_causes_list else "No specific root causes identified."

    report_data = {
        "client_name": customer_name,
        "generation_date": datetime.now().strftime("%d-%m-%Y"),
        "summary": summary,
        "executive_summary": {
            "surface": f"The Overall AEO Score is {summary.get('overallAEOReadiness', 'N/A')}%",
            "deeper": f"{summary.get('total_schemas', 0)} schema objects audited; {summary.get('schema_counts', {}).get('valid',0)} valid, {summary.get('schema_counts', {}).get('incorrect',0)} incorrect, {summary.get('schema_counts', {}).get('missing',0)} missing.",
            "root_causes": root_causes_summary
        },
        "raw_findings": data.get("structuredContent", [])
    }
    return report_data

def process_and_save_data(json_path: Path, customer_name: str):
    """Loads raw JSON, processes it, and saves the structured data as a new JSON file."""
    data = robust_load_json_v2(json_path)

    if isinstance(data, list) and len(data) > 0:
        data = data[0]

    summary = summarize_report(data)
    
    # Prepare the structured data
    output_data = prepare_aeo_data(data, summary, customer_name)
    
    # Define the output path
    slug = slugify(customer_name)
    out_dir = json_path.parent
    out_json_path = out_dir / f"{slug}_aeo_prompt_data.json"
    
    # Save the structured data
    with open(out_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)
        
    return out_json_path

def main(customer_name: str):
    date_str = datetime.now().strftime("%Y-%m-%d")
    log_dir = Path(f"./output/logs/{date_str}/{customer_name.capitalize()}")
    output_dir = log_dir / "aeo"
    output_dir.mkdir(parents=True, exist_ok=True)

    file_path = output_dir / f"{customer_name.capitalize()}_AEO_PageAudit.json"

    input_data = sys.stdin.read()
    if not input_data or not input_data.strip():
        print("No input received on stdin.", file=sys.stderr)
        sys.exit(2)

    file_path.write_text(input_data, encoding='utf-8')
    
    try:
        out_json = process_and_save_data(file_path, customer_name)
        print(f"Successfully processed and saved AEO prompt data to {out_json}")
    except Exception as e:
        print(f"--- ERROR ---", file=sys.stderr)
        print(f"Processing failed: {e}", file=sys.stderr)
        print(f"The script failed to parse or process the JSON input saved at:", file=sys.stderr)
        print(f"{file_path.resolve()}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Save and process AEO JSON data from stdin.")
    parser.add_argument("customer_name", type=str, help="Customer name (used for file/folder names).")
    args = parser.parse_args()
    main(args.customer_name)
