import logging
import os
from typing import Optional


_DEFAULT_FORMAT = os.getenv(
    "LOG_FORMAT",
    "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
_DEFAULT_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()


def _coerce_level(level_name: str) -> int:
    if not level_name:
        return logging.INFO
    return getattr(logging, level_name.upper(), logging.INFO)


def setup_logging() -> None:
    """Configure root logger once for the entire application."""
    root_logger = logging.getLogger()

    if not root_logger.handlers:
        logging.basicConfig(level=_coerce_level(_DEFAULT_LEVEL), format=_DEFAULT_FORMAT)
    else:
        root_logger.setLevel(_coerce_level(_DEFAULT_LEVEL))

    logging.captureWarnings(True)


setup_logging()


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a logger configured with the project defaults."""
    return logging.getLogger(name or "aeo_blog_engine")
