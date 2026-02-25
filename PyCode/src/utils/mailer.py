"""
EMAIL UTILITY FOR DATABASE REPORTS
Sends formatted database inspection reports via email.

Created by: Aman Mundra
Date: 2026-02-04
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Optional


class DatabaseReportMailer:
    """Handles sending database inspection reports via email."""

    def __init__(
        self,
        smtp_server: str = "smtp.gmail.com",
        smtp_port: int = 587,
        sender_email: Optional[str] = None,
        sender_password: Optional[str] = None
    ):
        """
        Initialize the mailer with SMTP configuration.

        Args:
            smtp_server: SMTP server address (default: Gmail)
            smtp_port: SMTP server port (default: 587 for TLS)
            sender_email: Sender email address (from env var if not provided)
            sender_password: Sender email password/app password (from env var if not provided)
        """
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.sender_email = sender_email or os.getenv('MAILER_EMAIL')
        self.sender_password = sender_password or os.getenv('MAILER_PASSWORD')

        if not self.sender_email or not self.sender_password:
            raise ValueError(
                "Email credentials not provided. Set MAILER_EMAIL and MAILER_PASSWORD "
                "environment variables or pass them as arguments."
            )

    def format_html_report(
        self,
        db_name: str,
        db_summary: Dict,
        collections_info: Dict,
        mongodb_version: str = "unknown"
    ) -> str:
        """
        Format database statistics into an HTML email report.

        Args:
            db_name: Database name
            db_summary: Database summary statistics
            collections_info: Information about all collections
            mongodb_version: MongoDB version

        Returns:
            str: HTML-formatted report
        """
        # Extract summary data
        total_size_mb = db_summary.get('dataSize', 0) / (1024 * 1024)
        storage_size_mb = db_summary.get('storageSize', 0) / (1024 * 1024)
        index_size_mb = db_summary.get('indexSize', 0) / (1024 * 1024)
        num_collections = db_summary.get('collections', 0)
        num_objects = db_summary.get('objects', 0)
        avg_obj_size = db_summary.get('avgObjSize', 0) / 1024

        # Calculate storage efficiency
        storage_efficiency = 0
        if db_summary.get('storageSize', 0) > 0:
            storage_efficiency = (db_summary.get('dataSize', 0) / db_summary.get('storageSize', 0)) * 100

        # Build HTML report
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                }}
                .header p {{
                    margin: 10px 0 0 0;
                    opacity: 0.9;
                }}
                .section {{
                    background: #f8f9fa;
                    padding: 20px;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }}
                .section h2 {{
                    margin-top: 0;
                    color: #667eea;
                    font-size: 20px;
                }}
                .stat-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }}
                .stat-box {{
                    background: white;
                    padding: 15px;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                .stat-label {{
                    font-size: 12px;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }}
                .stat-value {{
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                    margin-top: 5px;
                }}
                .collection-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    background: white;
                    border-radius: 6px;
                    overflow: hidden;
                }}
                .collection-table th {{
                    background: #667eea;
                    color: white;
                    padding: 12px;
                    text-align: left;
                }}
                .collection-table td {{
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                }}
                .collection-table tr:last-child td {{
                    border-bottom: none;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #eee;
                    color: #666;
                    font-size: 14px;
                }}
                .badge {{
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                }}
                .badge-success {{
                    background: #d4edda;
                    color: #155724;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 MongoDB Database Report</h1>
                <p>Database: <strong>{db_name}</strong> | Version: {mongodb_version}</p>
                <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>

            <div class="section">
                <h2>💾 Storage Statistics</h2>
                <div class="stat-grid">
                    <div class="stat-box">
                        <div class="stat-label">Total Data Size</div>
                        <div class="stat-value">{total_size_mb:.2f} MB</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Storage Size</div>
                        <div class="stat-value">{storage_size_mb:.2f} MB</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Index Size</div>
                        <div class="stat-value">{index_size_mb:.2f} MB</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Storage Efficiency</div>
                        <div class="stat-value">{storage_efficiency:.1f}%</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📚 Collection Statistics</h2>
                <div class="stat-grid">
                    <div class="stat-box">
                        <div class="stat-label">Total Collections</div>
                        <div class="stat-value">{num_collections}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Total Documents</div>
                        <div class="stat-value">{num_objects:,}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Avg Document Size</div>
                        <div class="stat-value">{avg_obj_size:.2f} KB</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📋 Collections Overview</h2>
                <table class="collection-table">
                    <thead>
                        <tr>
                            <th>Collection Name</th>
                            <th>Documents</th>
                            <th>Size</th>
                            <th>Avg Doc Size</th>
                        </tr>
                    </thead>
                    <tbody>
        """

        # Add collection rows
        for coll_name, coll_info in collections_info.items():
            stats = coll_info.get('stats', {})
            size_mb = stats.get('size', 0) / (1024 * 1024)
            count = stats.get('count', 0)
            avg_size_kb = stats.get('avgObjSize', 0) / 1024

            html += f"""
                        <tr>
                            <td><strong>{coll_name}</strong></td>
                            <td>{count:,}</td>
                            <td>{size_mb:.2f} MB</td>
                            <td>{avg_size_kb:.2f} KB</td>
                        </tr>
            """

        html += """
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <span class="badge badge-success">Automated Report</span>
                <p>This is an automated database inspection report from CogNerd PyCode.</p>
            </div>
        </body>
        </html>
        """

        return html

    def send_report(
        self,
        recipient_email: str,
        db_name: str,
        db_summary: Dict,
        collections_info: Dict,
        mongodb_version: str = "unknown",
        subject: Optional[str] = None
    ) -> bool:
        """
        Send database report via email.

        Args:
            recipient_email: Email address to send report to
            db_name: Database name
            db_summary: Database summary statistics
            collections_info: Information about all collections
            mongodb_version: MongoDB version
            subject: Custom email subject (optional)

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['From'] = self.sender_email
            message['To'] = recipient_email
            message['Subject'] = subject or f"MongoDB Report - {db_name} - {datetime.now().strftime('%Y-%m-%d')}"

            # Generate HTML report
            html_content = self.format_html_report(
                db_name=db_name,
                db_summary=db_summary,
                collections_info=collections_info,
                mongodb_version=mongodb_version
            )

            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(message)

            return True

        except Exception as e:
            print(f"❌ Failed to send email: {e}")
            return False


def send_db_report_email(
    db_name: str,
    db_summary: Dict,
    collections_info: Dict,
    mongodb_version: str = "unknown",
    recipient: str = "hub@cognerd.ai"
) -> bool:
    """
    Convenience function to send database report to hub@cognerd.ai.

    Args:
        db_name: Database name
        db_summary: Database summary statistics
        collections_info: Information about all collections
        mongodb_version: MongoDB version
        recipient: Email recipient (default: hub@cognerd.ai)

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        mailer = DatabaseReportMailer()
        return mailer.send_report(
            recipient_email=recipient,
            db_name=db_name,
            db_summary=db_summary,
            collections_info=collections_info,
            mongodb_version=mongodb_version
        )
    except Exception as e:
        print(f"❌ Error initializing mailer: {e}")
        print("💡 Make sure to set MAILER_EMAIL and MAILER_PASSWORD environment variables")
        return False