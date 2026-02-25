import sys
import json

# -----------------------------
# Read command-line argument (client name)
# -----------------------------
if len(sys.argv) < 2:
    print("Usage: python AEO_Generic_Report.py <client_name>")
    sys.exit(1)

client_name = sys.argv[1]

# -----------------------------
# Read JSON input from stdin
# -----------------------------
input_json = sys.stdin.read()

# Remove ```json wrapper if present
if input_json.startswith("```json"):
    input_json = input_json.replace("```json", "").replace("```", "")

try:
    report = json.loads(input_json)
except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")
    sys.exit(1)

# -----------------------------
# Extract key info dynamically
# -----------------------------
domain = report.get("site", {}).get("domain", "N/A")
timestamp = report.get("site", {}).get("timestamp", "N/A")
overall_score = report.get("siteLevel", {}).get("overallAEOScore", "N/A")

# Count schemas dynamically across all pages
schema_counts = {}
total_schemas = 0
for page in report.get("pages", []):
    for schema in page.get("detectedSchemas", []):
        stype = schema.get("type", "Unknown")
        schema_counts[stype] = schema_counts.get(stype, 0) + 1
        total_schemas += 1

# Aggregate missing elements
missing_elements = []
for page in report.get("pages", []):
    missing_elements.extend(page.get("missingElements", []))

# Aggregate recommendations
recommendations = []
for page in report.get("pages", []):
    recommendations.extend(page.get("recommendations", []))

# -----------------------------
# Generate HTML dynamically
# -----------------------------
html_output = f"""
<!DOCTYPE html>
<html>
<head>
<style>
body {{font-family: Arial, sans-serif; background:#fafafa; margin:0; padding:0; color:#222;}}
header {{background:#004d99; color:#fff; padding:20px 40px;}}
h1 {{margin:0; font-size:24px;}}
.container {{padding:20px 40px;}}
.metric-grid {{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:15px; margin-bottom:30px;}}
.metric {{background:#fff; border-radius:10px; box-shadow:0 2px 4px rgba(0,0,0,0.1); padding:15px; text-align:center;}}
.metric h3 {{margin:0; font-size:16px; color:#444;}}
.metric span {{display:block; font-size:22px; margin-top:5px; color:#0073e6; font-weight:bold;}}
section.card {{background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 6px rgba(0,0,0,0.08);}}
h2 {{color:#004d99; font-size:18px; border-bottom:1px solid #eee; padding-bottom:8px;}}
ul, ol {{margin-left:20px;}}
pre {{background:#f2f2f2; padding:10px; border-radius:8px; overflow-x:auto;}}
.card-container {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 20px;
    margin-top: 20px;
}}
.card-container .card {{
    margin: 0;
}}
</style>
</head>
<body>
<header>
    <h1>{client_name} - AEO Summary</h1>
    <p>Domain: {domain} | Report Date: {timestamp}</p>
</header>
<div class="container">
    <div class="metric-grid">
        <div class="metric">
            <h3>Overall AEO Score</h3>
            <span>{overall_score}%</span>
        </div>
        <div class="metric">
            <h3>Total Schemas</h3>
            <span>{total_schemas}</span>
        </div>
    </div>

    <div class="card-container">
        <section class="card">
            <h2>Schema Breakdown</h2>
            <ul>
"""
for stype, count in schema_counts.items():
    html_output += f"<li>{stype}: {count}</li>\n"

html_output += "</ul></section>"

# Missing elements
html_output += "<section class='card'><h2>Missing Elements</h2><ul>"
for elem in missing_elements:
    html_output += f"<li>{elem}</li>\n"
html_output += "</ul></section>"

# Recommendations
html_output += "<section class='card'><h2>Recommendations</h2><ul>"
for rec in recommendations:
    html_output += f"<li><strong>{rec.get('priority')}:</strong> {rec.get('description')}</li>\n"
html_output += "</ul></section>"

html_output += "</div></div></body></html>"

# -----------------------------
# Output HTML to stdout
# -----------------------------
print(html_output)
