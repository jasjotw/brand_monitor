"""
QDRANT DATABASE CONNECTION AND COLLECTION INSPECTOR
This script connects to a Qdrant vector database and retrieves comprehensive
information about all collections, including their configuration, vectors, and data.

Created by: Aman Mundra
Date: 2026-02-04
"""

from qdrant_client import QdrantClient
from qdrant_client.models import Distance
import sys
from pathlib import Path
from typing import Dict, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from utils.log_utils import get_logger
from utils.mailer import send_db_report_email

# Initialize logger
logger = get_logger("qdrant_inspector")

# Qdrant connection settings (Qdrant Cloud)
QDRANT_URL = "https://76d501b6-b754-42c1-a4da-9e0bc8cca319.us-east4-0.gcp.cloud.qdrant.io:6333"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.SsEx9xbs-jY9DjYKrmyGatbRchqs3vQ4lbfF0vS5M4A"
QDRANT_HOST = "76d501b6-b754-42c1-a4da-9e0bc8cca319.us-east4-0.gcp.cloud.qdrant.io"
QDRANT_PORT = 6333


def get_database_summary(client, collections_info: Dict) -> Dict:
    """Get comprehensive database statistics and summary."""
    try:
        # Aggregate statistics from all collections
        total_vectors = 0
        total_points = 0
        total_segments = 0
        total_collections = len(collections_info)

        for coll_name, coll_data in collections_info.items():
            info = coll_data.get('info', {})
            # Handle None values by defaulting to 0
            vectors = info.get('vectors_count')
            points = info.get('points_count')
            segments = info.get('segments_count')

            total_vectors += vectors if vectors is not None else 0
            total_points += points if points is not None else 0
            total_segments += segments if segments is not None else 0

        # Calculate averages
        avg_vectors_per_collection = total_vectors / total_collections if total_collections > 0 else 0
        avg_points_per_collection = total_points / total_collections if total_collections > 0 else 0

        # Display summary
        logger.info("\n" + "="*60)
        logger.info("QDRANT DATABASE SUMMARY")
        logger.info("="*60)
        logger.info(f"Qdrant Instance: {QDRANT_HOST}:{QDRANT_PORT}")
        logger.info("")
        logger.info("Vector Statistics:")
        logger.info(f"  • Total Collections: {total_collections:,}")
        logger.info(f"  • Total Vectors: {total_vectors:,}")
        logger.info(f"  • Total Points: {total_points:,}")
        logger.info(f"  • Total Segments: {total_segments:,}")
        logger.info("")
        logger.info("Averages:")
        logger.info(f"  • Avg Vectors per Collection: {avg_vectors_per_collection:,.0f}")
        logger.info(f"  • Avg Points per Collection: {avg_points_per_collection:,.0f}")
        logger.info("="*60)

        return {
            'total_collections': total_collections,
            'total_vectors': total_vectors,
            'total_points': total_points,
            'total_segments': total_segments,
            'avg_vectors_per_collection': avg_vectors_per_collection,
            'avg_points_per_collection': avg_points_per_collection
        }

    except Exception as e:
        logger.error(f"❌ Error getting database summary: {e}")
        return None


def test_connection(client) -> bool:
    """Test the Qdrant connection."""
    try:
        # Try to get collections to test connection
        collections = client.get_collections()
        logger.info("✅ Connection successful!")
        logger.info(f"Qdrant instance: {QDRANT_HOST}:{QDRANT_PORT}")
        return True
    except Exception as e:
        logger.error(f"❌ Connection failed: {e}")
        return False


def get_collection_details(client) -> Dict:
    """Retrieve information about all collections in the database."""
    try:
        collections_response = client.get_collections()
        collections = collections_response.collections if hasattr(collections_response, 'collections') else []

        logger.info("="*60)
        logger.info(f"Connected to Qdrant Database")
        logger.info("="*60)
        logger.info(f"Found {len(collections)} collections")

        collections_info = {}

        for collection in collections:
            collection_name = collection.name
            logger.info(f"\n📋 Collection: {collection_name}")
            logger.info("-" * 60)

            try:
                # Get collection info
                collection_info = client.get_collection(collection_name)

                # Extract configuration
                config = collection_info.config
                vectors_config = config.params.vectors if hasattr(config.params, 'vectors') else {}

                # Get vector size and distance
                vector_size = None
                distance_metric = None

                if isinstance(vectors_config, dict):
                    # Named vectors
                    for vector_name, vector_config in vectors_config.items():
                        size = vector_config.size if hasattr(vector_config, 'size') else None
                        dist = vector_config.distance if hasattr(vector_config, 'distance') else None
                        logger.info(f"  Vector '{vector_name}': size={size}, distance={dist}")
                        if vector_size is None:
                            vector_size = size
                            distance_metric = dist
                else:
                    # Single vector
                    vector_size = vectors_config.size if hasattr(vectors_config, 'size') else None
                    distance_metric = vectors_config.distance if hasattr(vectors_config, 'distance') else None
                    logger.info(f"  Vector size: {vector_size}")
                    logger.info(f"  Distance metric: {distance_metric}")

                # Get collection statistics
                vectors_count = collection_info.vectors_count if hasattr(collection_info, 'vectors_count') else 0
                points_count = collection_info.points_count if hasattr(collection_info, 'points_count') else 0
                segments_count = collection_info.segments_count if hasattr(collection_info, 'segments_count') else 0
                indexed_vectors_count = collection_info.indexed_vectors_count if hasattr(collection_info, 'indexed_vectors_count') else 0

                logger.info("")
                logger.info("Collection Statistics:")
                logger.info(f"  • Vectors Count: {vectors_count:,}" if vectors_count is not None else "  • Vectors Count: N/A")
                logger.info(f"  • Points Count: {points_count:,}" if points_count is not None else "  • Points Count: N/A")
                logger.info(f"  • Indexed Vectors: {indexed_vectors_count:,}" if indexed_vectors_count is not None else "  • Indexed Vectors: N/A")
                logger.info(f"  • Segments Count: {segments_count:,}" if segments_count is not None else "  • Segments Count: N/A")

                # Get optimizer status
                optimizer_status = collection_info.optimizer_status if hasattr(collection_info, 'optimizer_status') else None
                if optimizer_status:
                    logger.info(f"  • Optimizer Status: {optimizer_status}")

                # Store collection info
                collections_info[collection_name] = {
                    'info': {
                        'vectors_count': vectors_count,
                        'points_count': points_count,
                        'segments_count': segments_count,
                        'indexed_vectors_count': indexed_vectors_count,
                        'vector_size': vector_size,
                        'distance_metric': str(distance_metric) if distance_metric else 'unknown'
                    },
                    'config': {
                        'vector_size': vector_size,
                        'distance': str(distance_metric) if distance_metric else 'unknown'
                    }
                }

            except Exception as e:
                logger.error(f"  ❌ Error getting details for collection '{collection_name}': {e}")
                collections_info[collection_name] = {
                    'info': {'error': str(e)},
                    'config': {}
                }

        # Display collection counts summary
        logger.info("\n" + "="*60)
        logger.info("Collection Vector Counts:")
        logger.info("="*60)
        for coll_name, coll_data in collections_info.items():
            info = coll_data.get('info', {})
            vectors = info.get('vectors_count', 0)
            points = info.get('points_count', 0)

            # Handle None values
            vectors_str = f"{vectors:,}" if vectors is not None else "N/A"
            points_str = f"{points:,}" if points is not None else "N/A"
            logger.info(f"  {coll_name}: {vectors_str} vectors, {points_str} points")

        logger.info("="*60)
        return collections_info

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return None


def main():
    """Main function to run Qdrant database inspection."""
    logger.info("🔍 Qdrant Vector Database Inspector")
    logger.info("="*60)

    try:
        # Create Qdrant client
        if QDRANT_API_KEY:
            # Cloud connection
            client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY,
                timeout=30
            )
        else:
            # Local connection
            client = QdrantClient(
                host=QDRANT_HOST,
                port=QDRANT_PORT,
                timeout=30
            )

        if test_connection(client):
            collections = get_collection_details(client)
            if collections:
                logger.info(f"✅ Successfully retrieved information for {len(collections)} collections")

                # Get and display database summary
                db_summary = get_database_summary(client, collections)
                if db_summary:
                    logger.info("✅ Database summary generated successfully")

                    # Send email report
                    logger.info("\n📧 Sending email report to hub@cognerd.ai...")

                    # Format summary for email (convert to dict compatible with mailer)
                    email_summary = {
                        'dataSize': db_summary.get('total_vectors', 0) * 1024,  # Rough estimate
                        'storageSize': db_summary.get('total_points', 0) * 512,  # Rough estimate
                        'indexSize': db_summary.get('total_segments', 0) * 256,  # Rough estimate
                        'collections': db_summary.get('total_collections', 0),
                        'objects': db_summary.get('total_points', 0),
                        'avgObjSize': 1024  # Rough estimate for vectors
                    }

                    # Format collections info for email
                    email_collections = {}
                    for coll_name, coll_data in collections.items():
                        info = coll_data.get('info', {})
                        vectors_count = info.get('vectors_count') or 0
                        points_count = info.get('points_count') or 0

                        email_collections[coll_name] = {
                            'stats': {
                                'size': vectors_count * 1024 if vectors_count else points_count * 512,  # Rough estimate
                                'count': points_count,
                                'avgObjSize': 1024  # Rough estimate
                            }
                        }

                    email_sent = send_db_report_email(
                        db_name=f"Qdrant ({QDRANT_HOST}:{QDRANT_PORT})",
                        db_summary=email_summary,
                        collections_info=email_collections,
                        mongodb_version="Qdrant Vector DB",
                        recipient="hub@cognerd.ai"
                    )

                    if email_sent:
                        logger.info("✅ Email report sent successfully to hub@cognerd.ai")
                    else:
                        logger.warning("⚠️  Failed to send email report - check MAILER_EMAIL and MAILER_PASSWORD env vars")

                return True
        else:
            logger.error("❌ Cannot connect to Qdrant database")
            logger.warning(f"⚠️  Please check if Qdrant is running at {QDRANT_HOST}:{QDRANT_PORT}")
            return False

    except Exception as e:
        logger.error(f"❌ Failed to initialize Qdrant client: {e}")
        logger.warning(f"⚠️  Please ensure Qdrant is running at {QDRANT_HOST}:{QDRANT_PORT}")
        return False


if __name__ == "__main__":
    main()
