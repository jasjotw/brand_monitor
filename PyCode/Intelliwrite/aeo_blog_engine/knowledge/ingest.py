import logging
import os
import sys
# import asyncio # No longer needed
from pathlib import Path
from uuid import uuid4

from aeo_blog_engine.knowledge.knowledge_base import get_knowledge_base
from aeo_blog_engine.config import get_logger
from qdrant_client.http.models import PointStruct, models # Import Qdrant models
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

LOGGER = get_logger(__name__)

def ingest_docs(upload_dir=None): # No longer async
    """
    Reads markdown/text/pdf files from the docs/ directory (and optional upload_dir), embeds them, and loads them directly into Qdrant.
    """
    vector_db = get_knowledge_base() # This is the agno.vectordb.qdrant.Qdrant instance
    qdrant_client = vector_db.client # Get the underlying QdrantClient
    embedder = vector_db.embedder # Get the OpenAIEmbedder
    collection_name = vector_db.collection

    current_dir = os.path.dirname(os.path.abspath(__file__))
    base_docs_dir = Path(os.path.join(current_dir, "docs"))
    
    directories_to_scan = [base_docs_dir]
    if upload_dir:
        directories_to_scan.append(Path(upload_dir))
    
    points_to_upsert = []

    for docs_dir in directories_to_scan:
        if not os.path.exists(docs_dir):
            continue
            
        LOGGER.info("Scanning for documents in: %s", docs_dir)

        for root, _, files in os.walk(docs_dir):
            for file_name in files:
                content = ""
                file_path = Path(root) / file_name

                if file_name.endswith(".md") or file_name.endswith(".txt"):
                    LOGGER.debug("Found text file: %s", file_path)
                    try:
                        content = file_path.read_text(encoding='utf-8')
                    except Exception as e:
                        LOGGER.error("Error reading text file %s: %s", file_path, e)
                        continue
                
                elif file_name.endswith(".pdf"):
                    LOGGER.debug("Found PDF file: %s", file_path)
                    if PdfReader is None:
                        LOGGER.warning("Skipping PDF %s: pypdf not installed.", file_path)
                        continue
                    try:
                        reader = PdfReader(str(file_path))
                        for page in reader.pages:
                            text = page.extract_text()
                            if text:
                                content += text + "\n"
                    except Exception as e:
                        LOGGER.error("Error reading PDF file %s: %s", file_path, e)
                        continue
                
                if content:
                    if not content.strip():
                        LOGGER.warning("Skipping empty file: %s", file_path)
                        continue

                    try:
                        # Generate embedding for the entire file content
                        # For larger files, a proper chunking strategy would be needed.
                        # For now, we'll embed the whole file content.
                        embedding = embedder.get_embedding(content) # No await

                        points_to_upsert.append(PointStruct(
                            id=str(uuid4()), # Generate a unique ID for each point
                            vector=embedding,
                            payload={
                                "name": file_name,
                                "meta_data": {"file_path": str(file_path)}, # Required by agno
                                "content": content, # Often expected by agno
                                "content_preview": content[:200]
                            }
                        ))
                    except Exception as e:
                        LOGGER.error("Error embedding/processing file %s: %s", file_path, e)

    if points_to_upsert:
        LOGGER.info("Upserting %s points to Qdrant collection '%s'...", len(points_to_upsert), collection_name)
        try:
            # Clean start: Delete collection if it exists to remove old incompatible points
            if qdrant_client.collection_exists(collection_name=collection_name):
                qdrant_client.delete_collection(collection_name=collection_name)
            
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=len(points_to_upsert[0].vector), distance=models.Distance.COSINE),
            )
            
            operation_info = qdrant_client.upsert(
                collection_name=collection_name,
                wait=True,
                points=points_to_upsert
            )
            LOGGER.info("Upsert operation info: %s", operation_info)
            LOGGER.info("Ingestion complete.")
        except Exception as e:
            LOGGER.error("Error during Qdrant upsert: %s", e)
    else:
        LOGGER.info("No documents found to ingest.")

if __name__ == "__main__":
    ingest_docs() # Call directly, no asyncio.run
