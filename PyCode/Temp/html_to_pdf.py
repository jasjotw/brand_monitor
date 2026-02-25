"""
HTML to PDF Converter for n8n SSH Integration
Reads HTML from file, converts to PDF, saves it, and optionally outputs base64
"""

import sys
import base64
import weasyprint
from io import BytesIO
import os

def html_to_pdf(html_content):
    """
    Convert HTML string to PDF bytes
    
    Args:
        html_content (str): HTML content as string
        
    Returns:
        bytes: PDF file as bytes
    """
    try:
        pdf_file = BytesIO()
        weasyprint.HTML(string=html_content).write_pdf(pdf_file)
        pdf_file.seek(0)
        return pdf_file.read()
    except Exception as e:
        print(f"Error converting HTML to PDF: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    try:
        input_path = '/home/cygwin/GEO/output/files/AEO_Report.html'
        with open(input_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Convert HTML to PDF
        pdf_bytes = html_to_pdf(html_content)

        # Output PDF file path
        base_name = os.path.splitext(input_path)[0]  # removes current extension
        output_path = f"{base_name}.pdf"
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        print(pdf_base64)  

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
