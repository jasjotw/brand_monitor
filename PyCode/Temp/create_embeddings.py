############################################################################################################
#
# Create Embeddings and store in vectorDB
#
# Step 1:
# Step 2:
# Step 3:
# Step 4:
#
# Developers: Aman, Nishit
#
##############################################################################################################

import sys
import json
import uuid
import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct
from sentence_transformers import SentenceTransformer
from datetime import datetime, timezone
from urllib.parse import urlparse

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'utils'))
import logging_config

# Change CWD to project root to ensure logs are written to the correct directory
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --------------------------
# CONFIG - Update if needed
# --------------------------
QDRANT_URL = "https://76d501b6-b754-42c1-a4da-9e0bc8cca319.us-east4-0.gcp.cloud.qdrant.io:6333"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.SsEx9xbs-jY9DjYKrmyGatbRchqs3vQ4lbfF0vS5M4A"
COLLECTION_NAME = "welzin_aeo"
EMBED_MODEL = "sentence-transformers/all-mpnet-base-v2"
CHUNK_SIZE = 500

# --------------------------
# Helpers
# --------------------------
def chunk_text(text, size=500):
    """Split text into smaller chunks for embedding"""
    return [text[i:i+size] for i in range(0, len(text), size)]


def get_customer_name(data):
    """Extracts customer name from the first URL in the data."""
    if isinstance(data, list) and data:
        first_block = data[0]
        if "json" in first_block and isinstance(first_block["json"], dict):
            first_block = first_block["json"]
        if "results" in first_block and isinstance(first_block["results"], list) and first_block["results"]:
            first_result = first_block["results"][0]
            if "url" in first_result and first_result["url"]:
                return urlparse(first_result["url"]).netloc
    return "default_customer"


def init_clients(logger):
    """Initializes and returns Qdrant client and SentenceTransformer model."""
    logger.info("Initializing Qdrant client and SentenceTransformer model...")
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    model = SentenceTransformer(EMBED_MODEL)
    logger.info("Clients initialized successfully.")
    return client, model


def ensure_collection_exists(client, collection_name, model, logger):
    """Ensures the Qdrant collection exists, creating it if necessary."""
    try:
        logger.info(f"Checking for collection: {collection_name}")
        client.get_collection(collection_name)
        logger.info("Collection exists.")
    except Exception:
        logger.info("Collection does not exist. Creating new collection...")
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=model.get_sentence_embedding_dimension(), distance=Distance.COSINE),
        )
        logger.info("Collection created successfully.")


def process_and_embed_data(data, client, model, logger):
    """Processes input data, creates embeddings, and upserts them to Qdrant."""
    inserted = 0
    logger.info("Processing data...")
    if isinstance(data, list):
        for i, block in enumerate(data):
            logger.info(f"Processing block {i+1}/{len(data)}")
            if "json" in block and isinstance(block["json"], dict):
                block = block["json"]
            for j, result in enumerate(block.get("results", [])):
                # Handle cases where 'result' might be a list containing the actual dictionary
                if isinstance(result, list):
                    if not result:
                        logger.warning(f"Skipping empty list found in results at index {j}")
                        continue
                    result = result[0]

                if not isinstance(result, dict):
                    logger.warning(f"Skipping item in results at index {j} because it's not a dictionary.")
                    continue

                content = result.get("content", "")
                if not content.strip():
                    logger.info(f"Skipping empty content in result {j+1}")
                    continue

                url = result.get("url", "N/A")
                logger.info(f"Processing content from URL: {url}")
                chunks = chunk_text(content, CHUNK_SIZE)
                logger.info(f"Content split into {len(chunks)} chunks.")

                for k, chunk in enumerate(chunks):
                    logger.info(f"Encoding chunk {k+1}/{len(chunks)}")
                    embedding = model.encode(chunk,show_progress_bar=False).tolist()
                    point = PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embedding,
                        payload={
                            "url": result.get("url"),
                            "keywords": result.get("keywords", []),
                            "content_chunk": chunk,
                            "metadata": result.get("metadata", {}),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    )
                    logger.info(f"Upserting point for chunk {k+1} to Qdrant.")
                    client.upsert(collection_name=COLLECTION_NAME, points=[point])
                    inserted += 1
    else:
        logger.error("Unexpected JSON format. Expected a list of blocks.")
        print(json.dumps({"status": "error", "message": "Unexpected JSON format"}))
        return 0
    return inserted




def main():
    """Main function to create embeddings and store them in Qdrant."""
    raw_data = sys.stdin.read().strip()
    if not raw_data:
        print(json.dumps({"status": "error", "message": "No input data"}))
        return

    try:
        data = json.loads(raw_data)
    except json.JSONDecodeError as e:
        print(json.dumps({"status": "error", "message": f"Invalid JSON: {e}", "raw": raw_data[:200]}))
        return

    customer_name = get_customer_name(data)
    logger = logging_config.setup_logging(customer_name, __file__)
    logger.info("Script started.")
    logger.info(f"Customer name: {customer_name}")

    client, model = init_clients(logger)
    ensure_collection_exists(client, COLLECTION_NAME, model, logger)
    inserted_chunks = process_and_embed_data(data, client, model, logger)

    logger.info(f"Successfully inserted {inserted_chunks} chunks.")
    print(json.dumps({"status": "success", "inserted_chunks": inserted_chunks}))

if __name__ == "__main__":
    main()