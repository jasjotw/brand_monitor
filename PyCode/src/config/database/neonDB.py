"""
NEON DATABASE CONNECTION AND TABLE INSPECTOR
This script connects to a Neon PostgreSQL database and retrieves comprehensive
information about all tables, including their structure, relationships, and data.

Created by: Aman Mundra
Date: 2026-02-04
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from utils.log_utils import get_logger
from utils.mailer import send_db_report_email

# Initialize logger
logger = get_logger("neon_inspector")

DATABASE_URL = "postgresql://neondb_owner:npg_SWEJHq3hD5Tu@ep-frosty-river-ahj39n45-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&options=endpoint%3Dep-frosty-river-ahj39n45-pooler"

# Create database engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def get_database_summary(db_name: str, tables_info: Dict[str, Any]) -> Dict[str, Any]:
    """Get comprehensive database statistics and summary."""
    try:
        with engine.connect() as conn:
            db_size_bytes = conn.execute(text(f"SELECT pg_database_size('{db_name}')")).scalar()

        total_rows = sum(table.get('stats', {}).get('count', 0) for table in tables_info.values())
        total_tables = len(tables_info)
        total_index_size = sum(table.get('stats', {}).get('index_size_bytes', 0) for table in tables_info.values())

        summary = {
            'dataSize': db_size_bytes,
            'storageSize': db_size_bytes, # For PG, dataSize is a good approximation of storage size
            'indexSize': total_index_size,
            'collections': total_tables, # To match mailer template
            'objects': total_rows, # To match mailer template
            'avgObjSize': (db_size_bytes / total_rows) if total_rows > 0 else 0,
        }

        logger.info("\n" + "="*60)
        logger.info("DATABASE SUMMARY")
        logger.info("="*60)
        logger.info(f"Database Name: {db_name}")
        logger.info(f"Total Database Size: {summary['dataSize'] / (1024*1024):.2f} MB")
        logger.info(f"Total Index Size: {summary['indexSize'] / (1024*1024):.2f} MB")
        logger.info(f"Total Tables: {summary['collections']}")
        logger.info(f"Total Rows: {summary['objects']:,}")
        logger.info("="*60)

        return summary

    except Exception as e:
        logger.error(f"❌ Error getting database summary: {e}")
        return {{}}

def test_connection() -> bool:
    """Test the database connection."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            logger.info("✅ Connection successful!")
            logger.info(f"PostgreSQL version: {version}")
            return True
    except Exception as e:
        logger.error(f"❌ Connection failed: {e}")
        return False

def get_table_details() -> Dict[str, Any]:
    """Retrieve information about all tables in the database."""
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        logger.info("="*60)
        logger.info(f"Found {len(table_names)} tables")
        logger.info("="*60)

        tables_info = {{}}

        with engine.connect() as conn:
            for table_name in table_names:
                logger.info(f"\n📋 Table: {table_name}")
                logger.info("-="*60)

                columns = inspector.get_columns(table_name)
                pk_constraint = inspector.get_pk_constraint(table_name)
                primary_keys = pk_constraint.get('constrained_columns', [])
                foreign_keys = inspector.get_foreign_keys(table_name)
                indexes = inspector.get_indexes(table_name)

                # Get stats
                row_count = conn.execute(text(f"SELECT COUNT(*) FROM \"{table_name}\"")).scalar()
                table_size_bytes = conn.execute(text(f"SELECT pg_total_relation_size('{table_name}')")).scalar() or 0
                index_size_bytes = conn.execute(text(f"SELECT pg_indexes_size('{table_name}')")).scalar() or 0


                tables_info[table_name] = {
                    'columns': columns,
                    'primary_keys': primary_keys,
                    'foreign_keys': foreign_keys,
                    'indexes': indexes,
                    'stats': {
                        'count': row_count,
                        'size': table_size_bytes,
                        'avgObjSize': (table_size_bytes / row_count) if row_count > 0 else 0,
                        'index_size_bytes': index_size_bytes,
                    }
                }

                # Display columns
                logger.info(f"Columns ({len(columns)}):")
                for col in columns:
                    pk_marker = " [PK]" if col['name'] in primary_keys else ""
                    nullable = "NULL" if col.get('nullable', True) else "NOT NULL"
                    logger.info(f"  • {col['name']}{pk_marker}: {col['type']} ({nullable})")

                # Display stats
                logger.info("Table Statistics:")
                logger.info(f"  • Rows: {row_count:,}")
                logger.info(f"  • Table Size: {table_size_bytes / (1024*1024):.2f} MB")
                logger.info(f"  • Index Size: {index_size_bytes / (1024*1024):.2f} MB")

        return tables_info

    except Exception as e:
        logger.error(f"❌ Error getting table details: {e}")
        return {{}}

def main():
    """Main function to run Neon database inspection."""
    logger.info("🔍 Neon Database Inspector")
    logger.info("="*60)

    if test_connection():
        db_name = engine.url.database
        tables = get_table_details()
        if tables:
            logger.info(f"✅ Successfully retrieved information for {len(tables)} tables")

            db_summary = get_database_summary(db_name, tables)
            if db_summary:
                logger.info("✅ Database summary generated successfully")

                # Send email report
                logger.info("\n📧 Sending email report to hub@cognerd.ai...")
                with engine.connect() as conn:
                    version_string = conn.execute(text("SELECT version()")).scalar()

                email_sent = send_db_report_email(
                    db_name=f"NeonDB ({db_name})",
                    db_summary=db_summary,
                    collections_info=tables, # The mailer can handle this structure if we match keys
                    mongodb_version=f"PostgreSQL ({version_string.split(',')[0]})",
                    recipient="hub@cognerd.ai"
                )

                if email_sent:
                    logger.info("✅ Email report sent successfully to hub@cognerd.ai")
                else:
                    logger.warning("⚠️  Failed to send email report - check MAILER_EMAIL and MAILER_PASSWORD env vars")
                return True
    else:
        logger.error("❌ Cannot connect to database")
        logger.warning("⚠️  Please update the DATABASE_URL at the top of this file")
        return False
    return False

if __name__ == "__main__":
    main()