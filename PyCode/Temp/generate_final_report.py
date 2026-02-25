#!/usr/bin/env python3
"""
generate_final_report.py

Consolidates data from various JSON files into a single, templated HTML report.
"""
import sys
import json
import argparse
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from datetime import datetime
import plotly.graph_objects as go


def slugify(name: str) -> str:
    """A simple function to create a URL-friendly slug from a name."""
    return "".join(c if c.isalnum() else "_" for c in name).lower()

def load_json_data(file_path: Path, logger=None):
    """Safely loads a JSON file."""
    if not file_path.exists():
        if logger:
            logger.warning(f"File not found: {file_path}")
        return {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        if logger:
            logger.error(f"Could not read or parse {file_path}: {e}")
        return {}

# --------------------
# Insight Generation
# --------------------
def generate_aeo_insights(summary: dict) -> dict:
    """Generates one-line insights for each chart based on summary data."""
    insights = {}
    
    # Gauge Chart Insight
    score = summary.get('overallAEOReadiness', 0)
    baseline = 65  # Example baseline
    focus_areas = []
    if summary.get('structuredCoverage', 100) < 80:
        focus_areas.append("Schema")
    if summary.get('unstructuredCoverage', 100) < 80:
        focus_areas.append("Content")
    if summary.get('optimizationOpportunities', 100) < 80:
        focus_areas.append("Optimization")

    comparison = "above" if score > baseline else "below"
    focus_str = " & ".join(focus_areas) if focus_areas else "all areas look strong"
    insights['gauge'] = f"Your AEO score of {score} is {comparison} the industry baseline ({baseline}). Focus area → {focus_str}."

    # Radar Chart Insight
    metrics = {
        "Schema": summary.get('structuredCoverage', 0),
        "Content": summary.get('unstructuredCoverage', 0),
        "Optimization": summary.get('optimizationOpportunities', 0)
    }
    if metrics:
        min_metric = min(metrics, key=metrics.get)
        insights['radar'] = f"Coverage is generally balanced. {min_metric} is the primary area for improvement."
    else:
        insights['radar'] = "AEO readiness metrics are not available."

    # Bar Chart Insight
    counts = summary.get('schema_counts', {})
    missing = counts.get('missing', 0)
    incorrect = counts.get('incorrect', 0)
    if missing > 0 or incorrect > 0:
        insights['bar'] = f"Found {missing} missing and {incorrect} incorrect schema objects. Fixing these is a high-priority task."
    else:
        insights['bar'] = "All schema objects detected are valid. Great job!"

    return insights

# --------------------
# Interactive Chart Generation (Plotly)
# --------------------
def make_bar_chart_html(schema_counts: dict) -> str:
    labels = list(schema_counts.keys())
    values = [schema_counts.get(k, 0) for k in labels]
    fig = go.Figure(go.Bar(x=labels, y=values, marker_color='#1E90FF', text=values, textposition='auto', width=0.2))
    fig.update_layout(
        title_text='Schema Status Counts',
        title_x=0.5,
        template='plotly_dark',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(family="'Courier New', monospace", color='white', size=14),
        height=280,
        margin=dict(l=40, r=40, t=60, b=40),
        yaxis=dict(range=[0, 7], gridcolor='rgba(30, 144, 255, 0.3)'),
        xaxis=dict(tickfont=dict(size=12), gridcolor='rgba(30, 144, 255, 0.3)')
    )
    return fig.to_html(full_html=False, include_plotlyjs=False, config={'displayModeBar': False})

def make_radar_chart_html(metrics: dict) -> str:
    labels = list(metrics.keys())
    values = [metrics.get(k, 0) if metrics.get(k) is not None else 0 for k in labels]
    fig = go.Figure(go.Scatterpolar(
        r=values,
        theta=labels,
        fill='toself',
        line_color='#1E90FF',  # DodgerBlue
        fillcolor='rgba(30, 144, 255, 0.25)'
    ))
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 100], gridcolor='rgba(30, 144, 255, 0.4)', linecolor='rgba(30, 144, 255, 0.4)'),
            angularaxis=dict(gridcolor='rgba(30, 144, 255, 0.4)', linecolor='rgba(30, 144, 255, 0.4)')
        ),
        title_text='AEO Readiness',
        title_x=0.5,
        template='plotly_dark',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(family="'Courier New', monospace", color='white', size=14),
        height=280,
        margin=dict(l=40, r=40, t=60, b=40)
    )
    return fig.to_html(full_html=False, include_plotlyjs=False, config={'displayModeBar': False})

def make_gauge_html(value, title="Overall AEO Readiness") -> str:
    val = value if value is not None else 0
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=val,
        number={'font': {'size': 35, 'family': "'Courier New', monospace"}},
        title={'text': title, 'font': {'size': 16, 'family': "'Courier New', monospace", 'color': 'white'}},
        gauge={
            'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "rgba(30, 144, 255, 0.6)"},
            'bar': {'color': "#1E90FF", 'thickness': 0},
            'bgcolor': "rgba(0,0,0,0)",
            'borderwidth': 2,
            'bordercolor': "rgba(30, 144, 255, 0.6)",
            'steps': [
                {'range': [0, 50], 'color': 'rgba(30, 144, 255, 0.1)'},
                {'range': [50, 80], 'color': 'rgba(30, 144, 255, 0.2)'},
                {'range': [80, 100], 'color': 'rgba(30, 144, 255, 0.3)'}
            ],
            'threshold': {
                'line': {'color': "#00BFFF", 'width': 5},
                'thickness': 1,
                'value': val
            }
        }
    ))
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family="'Courier New', monospace", color="white", size=14),
        height=280,
        margin=dict(l=40, r=40, t=60, b=40)
    )
    return fig.to_html(full_html=False, include_plotlyjs=False, config={'displayModeBar': False})


def main(customer_name: str):
    """
    Generates the final consolidated HTML report for a given customer.
    """
    # 1. Define paths
    date_str = datetime.now().strftime("%Y-%m-%d")
    customer_cap = customer_name.capitalize()
    slug = slugify(customer_name)
    
    base_dir = Path(f"./output/logs/{date_str}/{customer_cap}/aeo")
    
    # JSON data sources
    aeo_prompt_data_path = base_dir / f"{slug}_aeo_prompt_data.json"
    schema_prompt_data_path = base_dir / f"{slug}_schema_prompt_data.json"
    seo_audit_data_path = base_dir / f"{slug}_seo_audit_data.json"
    
    # CSS, Template, and final output paths
    template_dir = Path("./pycode") 
    css_path = template_dir / "report_style.css"
    template_name = "final_report_template.html"
    final_report_path = base_dir / f"{slug}_final_aeo_report.html"
    

    # 2. Load all data
    
    
    aeo_data = load_json_data(aeo_prompt_data_path)
    schema_data = load_json_data(schema_prompt_data_path)
    seo_data = load_json_data(seo_audit_data_path)
    
    
    css_content = ""
    if css_path.exists():
        css_content = css_path.read_text(encoding='utf-8')
    else:
        print(f"Warning: CSS file not found at {css_path}", file=sys.stderr)

    # 3. Generate charts and insights if AEO data is present
    aeo_charts = {}
    aeo_insights = {}
    if aeo_data and 'summary' in aeo_data:
        summary = aeo_data['summary']
        
        # Generate Insights
        aeo_insights = generate_aeo_insights(summary)
        
        # Bar Chart for Schema Counts
        if 'schema_counts' in summary:
            aeo_charts['bar'] = make_bar_chart_html(summary['schema_counts'])
        
        # Radar Chart for AEO Readiness
        metrics_for_radar = {
            "schema": summary.get('structuredCoverage', 0),
            "content": summary.get('unstructuredCoverage', 0),
            "optimization": summary.get('optimizationOpportunities', 0),
        }
        aeo_charts['radar'] = make_radar_chart_html(metrics_for_radar)
        
        # Gauge Chart for Overall Score
        if 'overallAEOReadiness' in summary:
            aeo_charts['gauge'] = make_gauge_html(summary['overallAEOReadiness'], title="Overall AEO<br>Score")

    # 4. Set up Jinja2 environment
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template(template_name)

    # 5. Consolidate data for the template
    template_data = {
        "customer_name": customer_name,
        "generation_date": datetime.now().strftime("%B %d, %Y"),
        "css_content": css_content,
        "aeo_report": aeo_data,
        "schema_report": schema_data,
        "seo_report": seo_data,
        "aeo_charts": aeo_charts,
        "aeo_insights": aeo_insights
    }

    # 6. Render the final HTML
    
    final_html = template.render(template_data)

    # 7. Save the final report and print to stdout
    try:
        final_report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(final_report_path, 'w', encoding='utf-8') as f:
            f.write(final_html)
       
        print(final_html) # Print to stdout for n8n or other tools
    except IOError as e:
        print(f"Error saving final report: {e}", file=sys.stderr)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a final, consolidated AEO report from JSON data sources.")
    parser.add_argument("customer_name", type=str, help="Customer name, used to locate the data files.")
    args = parser.parse_args()
    main(args.customer_name)