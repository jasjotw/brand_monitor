import logging
import os
from typing import Optional
import traceback
import requests

from agno.vectordb.qdrant import Qdrant
# from agno.knowledge.embedder.google import GeminiEmbedder # Removed
from agno.knowledge.embedder.openai import OpenAIEmbedder
from aeo_blog_engine.config.settings import Config
from aeo_blog_engine.config import get_logger

LOGGER = get_logger(__name__)
EMBEDDER_PROVIDER = os.getenv("EMBEDDER_PROVIDER", "auto").lower()


class _InMemoryKnowledge:
    """Very small in-memory fallback to keep the pipeline running without Qdrant."""

    def __init__(self):
        docs = []
        kb_path = os.path.join(os.path.dirname(__file__), "docs")
        for root, _, files in os.walk(kb_path):
            for file_name in files:
                if file_name.endswith((".md", ".txt")):
                    file_path = os.path.join(root, file_name)
                    with open(file_path, "r", encoding="utf-8") as handle:
                        docs.append(handle.read())
        self._documents = docs

    def exists(self):
        return True

    def search(self, query: str, limit: int = 3, **_):
        class _Doc:
            def __init__(self, text: str):
                self.content = text

        return [_Doc(text) for text in self._documents[:limit]]


_cached_vector_db: Optional[object] = None
_cached_brand_vector_db: Optional[object] = None


class OpenAICompatEmbedder:
    def __init__(
        self,
        *,
        model_id: str,
        api_key: str,
        base_url: str,
        dimensions: int | None = None,
        extra_headers: Optional[dict] = None,
    ):
        self.model_id = model_id
        self.api_key = api_key
        self.dimensions = dimensions
        self.base_url = base_url.rstrip("/") + "/embeddings"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if extra_headers:
            self.headers.update(extra_headers)

    def get_embedding(self, text: str):
        response = requests.post(
            self.base_url,
            json={"model": self.model_id, "input": text},
            headers=self.headers,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        if not data.get("data"):
            raise ValueError(f"No embedding returned for {self.model_id}: {data}")
        return data["data"][0]["embedding"]



def _use_in_memory_fallback(reason: str):
    LOGGER.warning("Falling back to in-memory knowledge base. Reason: %s", reason)
    if "QDRANT_URL=:memory:" not in reason:
        LOGGER.debug("Detailed error traceback:")
        traceback.print_exc()
    return _InMemoryKnowledge()


def get_knowledge_base():
    """Return Qdrant vector DB, falling back to in-memory storage when necessary."""
    global _cached_vector_db
    if _cached_vector_db:
        return _cached_vector_db

    if not Config.GEMINI_API_KEY and not Config.OPENROUTER_API_KEY and not Config.OPENAI_API_KEY:
        raise ValueError("At least one LLM API key (Gemini, OpenRouter, or OpenAI) must be configured")

    if Config.QDRANT_URL == ":memory":
        _cached_vector_db = _use_in_memory_fallback("QDRANT_URL=:memory:")
        return _cached_vector_db

    try:
        _cached_vector_db = _build_qdrant(Config.COLLECTION_NAME)
        return _cached_vector_db
    except Exception as exc:
        _cached_vector_db = _use_in_memory_fallback(str(exc))
        return _cached_vector_db


def get_brand_knowledge_base():
    """Return the brand knowledge base collection if available, otherwise fall back to the main KB."""
    global _cached_brand_vector_db
    if _cached_brand_vector_db:
        return _cached_brand_vector_db

    if Config.QDRANT_URL == ":memory":
        _cached_brand_vector_db = _use_in_memory_fallback("QDRANT_URL=:memory:")
        return _cached_brand_vector_db

    try:
        _cached_brand_vector_db = _build_qdrant(Config.BRAND_COLLECTION_NAME)
        return _cached_brand_vector_db
    except Exception as exc:
        LOGGER.warning("Brand knowledge base unavailable (%s). Falling back to default KB.", exc)
        _cached_brand_vector_db = get_knowledge_base()
        return _cached_brand_vector_db


def _build_qdrant(collection_name: str):
    embedder = _select_embedder()
    instance = Qdrant(
        collection=collection_name,
        url=Config.QDRANT_URL,
        api_key=Config.QDRANT_API_KEY,
        embedder=embedder,
    )
    if hasattr(instance, "client"):
        instance.client.get_collections()
    return instance


def _select_embedder():
    preference = EMBEDDER_PROVIDER
    provider_order = []

    if preference == "openrouter":
        provider_order = ["openrouter", "openai", "gemini"]
    elif preference == "gemini":
        provider_order = ["gemini", "openrouter", "openai"]
    elif preference == "openai":
        provider_order = ["openai", "openrouter", "gemini"]
    else:
        provider_order = ["openai", "openrouter", "gemini"]

    for provider in provider_order:
        if provider == "openai" and Config.OPENAI_API_KEY:
            return OpenAIEmbedder(
                id="text-embedding-3-small",
                api_key=Config.OPENAI_API_KEY,
                dimensions=1536,
            )
        if provider == "openrouter" and Config.OPENROUTER_API_KEY:
            return OpenAICompatEmbedder(
                model_id="text-embedding-3-large",
                api_key=Config.OPENROUTER_API_KEY,
                base_url=Config.OPENROUTER_BASE_URL,
                dimensions=3072,
                extra_headers={
                    "HTTP-Referer": os.getenv("OPENROUTER_APP_URL", "https://localhost"),
                    "X-Title": os.getenv("OPENROUTER_APP_NAME", "AEO Blog Engine"),
                },
            )
        if provider == "gemini" and Config.GEMINI_API_KEY:
            return OpenAICompatEmbedder(
                model_id="models/text-embedding-004",
                api_key=Config.GEMINI_API_KEY,
                base_url=Config.GEMINI_BASE_URL,
                dimensions=3072,
            )

    raise ValueError("Unable to initialize embedder; set EMBEDDER_PROVIDER or remove unused API keys")
