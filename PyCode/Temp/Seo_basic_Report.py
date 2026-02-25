import os
import sys
from datetime import datetime

def read_customer_report(customer_name):
    customer_name = customer_name.capitalize()
    date_str = datetime.now().strftime("%Y-%m-%d")
    log_dir = f"./output/logs/{date_str}/{customer_name}"
    output_dir = os.path.join(log_dir, "aeo")
    report_path = os.path.join(output_dir, f"{customer_name}_report.html")

    if not os.path.exists(report_path):
        print(f" Report not found: {report_path}")
        return

    with open(report_path, "r", encoding="utf-8") as f:
        print(f.read())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(" Usage: python Seo_basic_Report.py <customer_name>")
        sys.exit(1)

    customer_name = sys.argv[1]
    read_customer_report(customer_name)
