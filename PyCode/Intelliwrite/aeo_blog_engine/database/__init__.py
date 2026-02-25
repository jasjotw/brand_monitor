from aeo_blog_engine.database.session import get_session
from aeo_blog_engine.database.models import Blog
from aeo_blog_engine.database.repository import (
    append_social_post as pg_append_social_post,
    create_blog_entry as pg_create_blog_entry,
    get_blog_by_id as pg_get_blog_by_id,
    get_blog_by_user_and_company as pg_get_blog_by_user_and_company,
    update_blog_status as pg_update_blog_status,
)
from aeo_blog_engine.database.mongo_repository import (
    append_social_post as mongo_append_social_post,
    create_blog_entry as mongo_create_blog_entry,
    get_blog_by_id as mongo_get_blog_by_id,
    get_blog_by_user_and_company as mongo_get_blog_by_user_and_company,
    get_or_create_blog_entry,
    update_blog_status as mongo_update_blog_status,
)

__all__ = [
    "get_session",
    "Blog",
    "pg_append_social_post",
    "pg_create_blog_entry",
    "pg_get_blog_by_id",
    "pg_get_blog_by_user_and_company",
    "pg_update_blog_status",
    "mongo_append_social_post",
    "mongo_create_blog_entry",
    "mongo_get_blog_by_id",
    "mongo_get_blog_by_user_and_company",
    "mongo_update_blog_status",
    "get_or_create_blog_entry",
]
