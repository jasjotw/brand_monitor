from datetime import datetime
from typing import Optional, Dict, Any, List

from bson import ObjectId
from pymongo import MongoClient

from aeo_blog_engine.config.settings import Config


if not Config.MONGODB_URI:
    raise ValueError("MONGODB_URI must be set in environment variables")

client = MongoClient(Config.MONGODB_URI)
database = client[Config.MONGODB_DB]
blogs_collection = database[Config.MONGODB_COLLECTION]


JsonEntry = Dict[str, Any]


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _ensure_entries(items: Optional[List[JsonEntry]]) -> List[JsonEntry]:
    if not items:
        return []
    normalized: List[JsonEntry] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append(item)
    return normalized


def _make_entry(content: Optional[str], *, timestamp: Optional[str] = None, topic: Optional[str] = None, is_prompt: Optional[str] = None) -> Optional[JsonEntry]:
    if content is None:
        return None
    entry: JsonEntry = {
        "content": content,
        "timestamp": timestamp or _now_iso(),
    }
    if topic is not None:
        entry["topic"] = topic
    if is_prompt is not None:
        entry["is_prompt"] = is_prompt
    return entry


def _serialize(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    serialized = doc.copy()
    serialized["id"] = str(serialized.pop("_id"))
    return serialized


def _ensure_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise ValueError(f"Invalid blog id: {value}") from exc


def get_blog_by_user_and_company(*, user_id: str, brand_url: str) -> Optional[Dict[str, Any]]:
    doc = blogs_collection.find_one(
        {"user_id": user_id, "brand_url": brand_url},
        sort=[("created_at", -1)]
    )
    return _serialize(doc)


def create_blog_entry(
    *,
    user_id: str,
    topic: Optional[str],
    brand_url: str,
    email_id: Optional[str] = None,
    brand_name: Optional[str] = None,
    brand_industry: Optional[str] = None,
    brand_location: Optional[str] = None,
    blog: Optional[str] = None,
    status: str = "PENDING",
    twitter_post: Optional[str] = None,
    linkedin_post: Optional[str] = None,
    reddit_post: Optional[str] = None,
    is_prompt: str = "false",
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    doc: Dict[str, Any] = {
        "user_id": user_id,
        "brand_url": brand_url,
        "email_id": email_id,
        "brand_name": brand_name,
        "brand_industry": brand_industry,
        "brand_location": brand_location,
        "status": status,
        "created_at": datetime.utcnow(),
        "blogs": [],
        "topic": [],
        "twitter_post": [],
        "linkedin_post": [],
        "reddit_post": [],
    }

    topic_entry = _make_entry(topic, timestamp=timestamp, is_prompt=is_prompt)
    if topic_entry:
        doc["topic"].append(topic_entry)

    blog_entry = _make_entry(blog, timestamp=timestamp, topic=topic, is_prompt=is_prompt)
    if blog_entry:
        doc["blogs"].append(blog_entry)

    for field, value in (
        ("twitter_post", twitter_post),
        ("linkedin_post", linkedin_post),
        ("reddit_post", reddit_post),
    ):
        if value:
            entry = _make_entry(value, timestamp=timestamp, topic=topic)
            if entry:
                doc[field].append(entry)

    result = blogs_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


def get_or_create_blog_entry(
    *,
    user_id: str,
    brand_url: str,
    topic: str,
    email_id: Optional[str] = None,
    brand_name: Optional[str] = None,
    brand_industry: Optional[str] = None,
    brand_location: Optional[str] = None,
    is_prompt: str = "false",
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    existing = get_blog_by_user_and_company(user_id=user_id, brand_url=brand_url)
    if existing:
        updates: Dict[str, Any] = {}
        if email_id and not existing.get("email_id"):
            updates["email_id"] = email_id
        if brand_name and not existing.get("brand_name"):
            updates["brand_name"] = brand_name
        if brand_industry and not existing.get("brand_industry"):
            updates["brand_industry"] = brand_industry
        if brand_location and not existing.get("brand_location"):
            updates["brand_location"] = brand_location

        topics = _ensure_entries(existing.get("topic"))
        topic_contents = {entry.get("content") for entry in topics}
        if topic and topic not in topic_contents:
            entry = _make_entry(topic, timestamp=timestamp, is_prompt=is_prompt)
            if entry:
                topics.append(entry)
                updates["topic"] = topics

        if updates:
            blogs_collection.update_one(
                {"_id": _ensure_object_id(existing["id"])},
                {"$set": updates}
            )
            existing.update(updates)
        return existing

    return create_blog_entry(
        user_id=user_id,
        topic=topic,
        brand_url=brand_url,
        email_id=email_id,
        brand_name=brand_name,
        brand_industry=brand_industry,
        brand_location=brand_location,
        status="PENDING",
        is_prompt=is_prompt,
        timestamp=timestamp,
    )


def get_blog_by_id(blog_id: str) -> Optional[Dict[str, Any]]:
    try:
        object_id = ObjectId(blog_id)
    except Exception:
        return None
    doc = blogs_collection.find_one({"_id": object_id})
    return _serialize(doc)


def _append_entry(list_value: List[JsonEntry], entry: Optional[JsonEntry]) -> List[JsonEntry]:
    if entry:
        list_value = _ensure_entries(list_value)
        list_value.append(entry)
    return list_value


def update_blog_status(
    blog_id: str,
    *,
    status: str,
    blog_content: Optional[str] = None,
    topic: Optional[str] = None,
    is_prompt: str = "false",
    timestamp: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    doc = get_blog_by_id(blog_id)
    if not doc:
        raise ValueError(f"Blog with id {blog_id} not found")

    blogs = _ensure_entries(doc.get("blogs"))
    if blog_content is not None:
        blogs = _append_entry(blogs, _make_entry(blog_content, timestamp=timestamp, topic=topic, is_prompt=is_prompt))

    topics = _ensure_entries(doc.get("topic"))
    topic_contents = {entry.get("content") for entry in topics}
    if topic and topic not in topic_contents:
        entry = _make_entry(topic, timestamp=timestamp, is_prompt=is_prompt)
        if entry:
            topics.append(entry)

    blogs_collection.update_one(
        {"_id": _ensure_object_id(blog_id)},
        {
            "$set": {
                "status": status,
                "blogs": blogs,
                "topic": topics,
            }
        }
    )

    doc.update({
        "status": status,
        "blogs": blogs,
        "topic": topics,
    })
    return doc


def append_social_post(
    blog_id: str,
    *,
    platform: str,
    content: str,
    topic: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    doc = get_blog_by_id(blog_id)
    if not doc:
        raise ValueError(f"Blog with id {blog_id} not found")

    platform = platform.lower()
    field_map = {
        "twitter": "twitter_post",
        "linkedin": "linkedin_post",
        "reddit": "reddit_post",
    }
    field = field_map.get(platform)
    if not field:
        raise ValueError(f"Unsupported platform for saving: {platform}")

    entries = _ensure_entries(doc.get(field))
    if topic:
        entries = [entry for entry in entries if entry.get("topic") != topic]

    new_entry = _make_entry(content, timestamp=timestamp, topic=topic)
    if new_entry:
        entries.append(new_entry)

    blogs_collection.update_one(
        {"_id": _ensure_object_id(blog_id)},
        {"$set": {field: entries}}
    )

    doc[field] = entries
    return doc
