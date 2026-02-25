import ast
from typing import Dict, Optional

from aeo_blog_engine.config import get_logger
from aeo_blog_engine.database.mongo_repository import (
    append_social_post,
    create_blog_entry,
    get_blog_by_id,
    get_blog_by_user_and_company,
    get_or_create_blog_entry,
    update_blog_status,
)
from aeo_blog_engine.pipeline.blog_workflow import AEOBlogPipeline


LOGGER = get_logger(__name__)
pipeline = AEOBlogPipeline()


def _ensure_blog_id(blog: Dict) -> str:
    blog_id = blog.get("id")
    if not blog_id:
        raise ValueError("Blog document missing identifier")
    return blog_id


def _process_single_blog(payload: Dict) -> Dict:
    topic = payload.get("topic")
    prompt = payload.get("prompt")
    
    if not topic and not prompt:
        raise ValueError("Missing required field: 'topic' or 'prompt'")

    # Step 0: If only prompt is provided, generate the topic first
    if prompt and not topic:
        LOGGER.info("Generating topic for prompt: %s", prompt)
        topic = pipeline.generate_topic_only(prompt)
        LOGGER.info("Generated topic: '%s'", topic)

    if not topic or not str(topic).strip():
        raise ValueError("Topic is missing or could not be generated from prompt.")

    topic = topic.strip()
    brand_url = payload["brand_url"].strip()
    user_id = payload["user_id"].strip()
    email_id = payload.get("email_id")
    brand_name = payload.get("brand_name")
    brand_industry = payload.get("brand_industry")
    brand_location = payload.get("brand_location")
    is_prompt = payload.get("is_prompt", "false")
    if prompt:
        is_prompt = "true"
    timestamp = payload.get("timestamp")

    blog_entry = get_or_create_blog_entry(
        user_id=user_id,
        topic=topic,
        brand_url=brand_url,
        email_id=email_id,
        brand_name=brand_name,
        brand_industry=brand_industry,
        brand_location=brand_location,
        is_prompt=is_prompt,
        timestamp=timestamp,
    )
    blog_id = _ensure_blog_id(blog_entry)

    try:
        # Run the pipeline with the finalized topic
        blog_content = pipeline.run(
            topic,
            brand_name=brand_name,
            brand_url=brand_url,
            brand_industry=brand_industry,
            brand_location=brand_location,
        )
        LOGGER.debug("Generated blog content for topic '%s': %s", topic, blog_content)
        updated = update_blog_status(
            blog_id,
            status="COMPLETED",
            blog_content=blog_content,
            topic=topic,
            is_prompt=is_prompt,
            timestamp=timestamp,
        )
        if not updated:
            raise RuntimeError("Failed to update blog status in MongoDB")
        return updated
    except Exception as exc:
        update_blog_status(
            blog_id,
            status="FAILED",
        )
        raise exc


def generate_and_store_blog(payload: Dict):
    if not payload.get("brand_url"):
        raise ValueError("Missing required field: 'brand_url'")

    if not payload.get("user_id"):
        raise ValueError("Missing required field: 'user_id'")

    prompt = payload.get("prompt")
    LOGGER.debug("Received prompt type: %s", type(prompt))
    if isinstance(prompt, str):
         LOGGER.debug("Prompt string starts with: %s", prompt.strip()[:10])

    # Attempt to parse stringified list
    if isinstance(prompt, str) and prompt.strip().startswith("[") and prompt.strip().endswith("]"):
        try:
            parsed = ast.literal_eval(prompt)
            if isinstance(parsed, list):
                prompt = parsed
                LOGGER.debug("Successfully parsed prompt string to list via ast.")
        except Exception as e:
            LOGGER.warning("Failed to parse prompt string as list (ast): %s", e)
            # Try JSON fallback
            try:
                import json
                parsed = json.loads(prompt)
                if isinstance(parsed, list):
                    prompt = parsed
                    LOGGER.debug("Successfully parsed prompt string to list via json.")
            except Exception as e2:
                LOGGER.warning("Failed to parse prompt string as list (json): %s", e2)

    if isinstance(prompt, list):
        results = []
        for p in prompt:
            try:
                sub_payload = payload.copy()
                sub_payload["prompt"] = p
                # Clear topic if it was set in the main payload to avoid reusing it for all prompts
                if "topic" in sub_payload:
                    del sub_payload["topic"]
                results.append(_process_single_blog(sub_payload))
            except Exception as e:
                LOGGER.error("Error processing prompt '%s': %s", p, e)
                results.append({"prompt": p, "error": str(e), "status": "FAILED"})
        return results

    return _process_single_blog(payload)


def fetch_blog(blog_id: str) -> Dict:
    blog = get_blog_by_id(blog_id)
    if not blog:
        raise ValueError(f"Blog with id {blog_id} not found")
    return blog


def fetch_blog_by_user(user_id: str, brand_url: str) -> Optional[Dict]:
    return get_blog_by_user_and_company(user_id=user_id, brand_url=brand_url)


def store_social_post(
    user_id: str,
    brand_url: str,
    topic: str,
    platform: str,
    content: str,
    *,
    brand_name: Optional[str] = None,
    brand_industry: Optional[str] = None,
    brand_location: Optional[str] = None,
    timestamp: str = None,
) -> Dict:
    """
    Finds or creates the blog entry for the given user/company and updates it with the social post.
    """
    blog = get_or_create_blog_entry(
        user_id=user_id,
        brand_url=brand_url,
        topic=topic,
        brand_name=brand_name,
        brand_industry=brand_industry,
        brand_location=brand_location,
        timestamp=timestamp,
    )
    blog_id = _ensure_blog_id(blog)
    updated = append_social_post(
        blog_id,
        platform=platform,
        content=content,
        topic=topic,
        timestamp=timestamp,
    )
    if not updated:
        raise RuntimeError("Failed to append social post in MongoDB")
    return updated
