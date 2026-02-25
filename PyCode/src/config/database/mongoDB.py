"""
MONGODB DATABASE CONNECTION AND COLLECTION INSPECTOR
This script connects to a MongoDB database and retrieves comprehensive
information about all collections, including their structure, indexes, and data.

Created by: Aman Mundra
Date: 2026-02-04
"""

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import ssl
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from utils.log_utils import get_logger
from utils.mailer import send_db_report_email

# Initialize logger
logger = get_logger("mongo_inspector")

MONGO_URL = "mongodb+srv://Welzin:yYsuyoXrWcxPKmPV@welzin.1ln7rs4.mongodb.net/welzin?retryWrites=true&w=majority&appName=Welzin"

def get_database_summary(db):
    """Get comprehensive database statistics and summary."""
    try:
        # Get database stats
        db_stats = db.command("dbStats")

        # Extract key metrics
        total_size = db_stats.get('dataSize', 0)
        storage_size = db_stats.get('storageSize', 0)
        index_size = db_stats.get('indexSize', 0)
        total_size_with_indexes = total_size + index_size
        num_collections = db_stats.get('collections', 0)
        num_objects = db_stats.get('objects', 0)
        avg_obj_size = db_stats.get('avgObjSize', 0)

        # Convert to MB/GB
        total_size_mb = total_size / (1024 * 1024)
        storage_size_mb = storage_size / (1024 * 1024)
        index_size_mb = index_size / (1024 * 1024)
        total_with_indexes_mb = total_size_with_indexes / (1024 * 1024)
        avg_obj_kb = avg_obj_size / 1024

        # Display summary
        logger.info("\n" + "="*60)
        logger.info("DATABASE SUMMARY")
        logger.info("="*60)
        logger.info(f"Database Name: {db.name}")
        logger.info(f"MongoDB Version: {db.client.server_info().get('version', 'unknown')}")
        logger.info("")
        logger.info("Storage Statistics:")
        logger.info(f"  • Total Data Size: {total_size_mb:.2f} MB ({total_size:,} bytes)")
        logger.info(f"  • Storage Size: {storage_size_mb:.2f} MB ({storage_size:,} bytes)")
        logger.info(f"  • Index Size: {index_size_mb:.2f} MB ({index_size:,} bytes)")
        logger.info(f"  • Total Size (Data + Indexes): {total_with_indexes_mb:.2f} MB")
        logger.info("")
        logger.info("Collection Statistics:")
        logger.info(f"  • Total Collections: {num_collections:,}")
        logger.info(f"  • Total Documents: {num_objects:,}")
        logger.info(f"  • Average Document Size: {avg_obj_kb:.2f} KB ({avg_obj_size:,} bytes)")
        logger.info("")

        # Calculate space efficiency
        if storage_size > 0:
            efficiency = (total_size / storage_size) * 100
            logger.info(f"Storage Efficiency: {efficiency:.1f}%")

        logger.info("="*60)

        return db_stats

    except Exception as e:
        logger.error(f"❌ Error getting database summary: {e}")
        return None


def test_connection(client):
    """Test the database connection."""
    try:
        # The ping command is cheap and does not require auth
        client.admin.command('ping')

        # Get server info
        server_info = client.server_info()
        logger.info("✅ Connection successful!")
        logger.info(f"MongoDB version: {server_info.get('version', 'unknown')}")
        logger.info(f"Server: {client.address[0]}:{client.address[1]}")
        return True
    except ConnectionFailure as e:
        logger.error(f"❌ Connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False
    
def get_collection_details(db):
    """Retrieve information about all collections in the database."""
    try:
        collection_names = db.list_collection_names()

        logger.info("="*60)
        logger.info(f"Connected to Database: {db.name}")
        logger.info("="*60)
        logger.info(f"Found {len(collection_names)} collections")

        collections_info = {}

        for collection_name in collection_names:
            collection = db[collection_name]
            logger.info(f"\n📋 Collection: {collection_name}")
            logger.info("-" * 60)

            # Get indexes
            indexes = list(collection.list_indexes())

            # Get sample document to show structure
            sample_doc = collection.find_one()

            # Get collection stats
            stats = db.command("collStats", collection_name)

            collections_info[collection_name] = {
                'indexes': indexes,
                'sample_document': sample_doc,
                'stats': stats
            }

            # Display document structure from sample
            if sample_doc:
                logger.info("Document Structure (from sample):")
                for key, value in sample_doc.items():
                    value_type = type(value).__name__
                    logger.info(f"  • {key}: {value_type}")
            else:
                logger.info("No documents found in this collection")

            # Display indexes
            if indexes:
                logger.info(f"Indexes ({len(indexes)}):")
                for idx in indexes:
                    keys = idx.get('key', {})
                    unique = " (UNIQUE)" if idx.get('unique', False) else ""
                    name = idx.get('name', 'unnamed')
                    logger.info(f"  • {name}{unique}: {dict(keys)}")

            # Display collection stats (convert to MB)
            size_bytes = stats.get('size', 0)
            storage_bytes = stats.get('storageSize', 0)
            avg_doc_bytes = stats.get('avgObjSize', 0)

            size_mb = size_bytes / (1024 * 1024)
            storage_mb = storage_bytes / (1024 * 1024)
            avg_doc_kb = avg_doc_bytes / 1024

            logger.info("Collection Statistics:")
            logger.info(f"  • Size: {size_mb:.2f} MB ({size_bytes:,} bytes)")
            logger.info(f"  • Storage Size: {storage_mb:.2f} MB ({storage_bytes:,} bytes)")
            logger.info(f"  • Average Document Size: {avg_doc_kb:.2f} KB ({avg_doc_bytes:,} bytes)")

        # Get document counts
        logger.info("="*60)
        logger.info("Collection Document Counts:")
        logger.info("="*60)
        for collection_name in collection_names:
            count = db[collection_name].count_documents({})
            logger.info(f"  {collection_name}: {count:,} documents")

        logger.info("="*60)
        return collections_info

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return None


def main():
    """Main function to run MongoDB database inspection."""
    logger.info("🔍 MongoDB Database Inspector")
    logger.info("="*60)

    try:
        # Create MongoDB client
        client = MongoClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,
            ssl=True,
            tlsAllowInvalidCertificates=True  # Use with caution, better to have proper certs
        )

        if test_connection(client):
            # Get database name from URL or use default
            db_name = MONGO_URL.split('/')[-1].split('?')[0]
            if not db_name or db_name == '':
                logger.warning("⚠️  No database specified in URL, using 'test' database")
                db_name = 'test'

            db = client[db_name]
            collections = get_collection_details(db)
            if collections:
                logger.info(f"✅ Successfully retrieved information for {len(collections)} collections")

                # Get and display database summary
                db_summary = get_database_summary(db)
                if db_summary:
                    logger.info("✅ Database summary generated successfully")

                    # Send email report
                    mongodb_version = db.client.server_info().get('version', 'unknown')
                    logger.info("\n📧 Sending email report to hub@cognerd.ai...")
                    email_sent = send_db_report_email(
                        db_name=db_name,
                        db_summary=db_summary,
                        collections_info=collections,
                        mongodb_version=mongodb_version,
                        recipient="hub@cognerd.ai"
                    )

                    if email_sent:
                        logger.info("✅ Email report sent successfully to hub@cognerd.ai")
                    else:
                        logger.warning("⚠️  Failed to send email report - check MAILER_EMAIL and MAILER_PASSWORD env vars")

                return True
        else:
            logger.error("❌ Cannot connect to database")
            logger.warning("⚠️  Please update the MONGO_URL at the top of this file")
            return False

        client.close()
        logger.info("MongoDB client closed successfully")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to initialize MongoDB client: {e}")
        logger.warning("⚠️  Please update the MONGO_URL at the top of this file")
        return False


if __name__ == "__main__":
    main()
