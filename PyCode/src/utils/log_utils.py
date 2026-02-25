"""
LOG UTILITIES
Centralized logging utility for all PyCode scripts.
Creates date-based log directories and handles log file management.

Created by: Aman Mundra
Date: 2026-02-04
"""

import logging
from datetime import datetime
from pathlib import Path


def get_logger(name: str, log_to_file: bool = True, log_to_console: bool = True):
    """
    Create and configure a logger with date-based directory structure.

    Args:
        name: Name of the logger (usually __name__ or script name)
        log_to_file: Whether to log to a file (default: True)
        log_to_console: Whether to log to console (default: True)

    Returns:
        logging.Logger: Configured logger instance
    """
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Avoid adding duplicate handlers
    if logger.handlers:
        return logger

    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Add file handler if requested
    if log_to_file:
        log_file_path = get_log_file_path(name)
        file_handler = logging.FileHandler(log_file_path)
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Add console handler if requested
    if log_to_console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger


def get_log_file_path(logger_name: str) -> str:
    """
    Generate log file path with date-based directory structure and detailed timestamp.
    Format: PyCode/logs/DD-MM-YYYY/logger_name_YYYY-MM-DD_HH-MM-SS.log

    Args:
        logger_name: Name of the logger (used for log filename)

    Returns:
        str: Full path to the log file
    """
    # Get current date and time
    now = datetime.now()
    current_date = now.strftime("%d-%m-%Y")
    detailed_timestamp = now.strftime("%Y-%m-%d_%H-%M-%S")

    # Get project root (PyCode directory)
    current_file = Path(__file__)
    pycode_root = current_file.parent.parent.parent  # Go up from utils -> src -> PyCode

    # Create logs directory path
    logs_dir = pycode_root / "logs" / current_date

    # Create directory if it doesn't exist
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Clean logger name for filename (remove dots, slashes, etc.)
    clean_name = logger_name.replace('.', '_').replace('/', '_').replace('\\', '_')
    if clean_name.startswith('_'):
        clean_name = clean_name[1:]

    # Create log file path with detailed timestamp
    log_file = logs_dir / f"{clean_name}_{detailed_timestamp}.log"

    return str(log_file)


def get_daily_log_dir() -> str:
    """
    Get the current date's log directory path.

    Returns:
        str: Path to today's log directory
    """
    current_date = datetime.now().strftime("%d-%m-%Y")
    current_file = Path(__file__)
    pycode_root = current_file.parent.parent.parent
    logs_dir = pycode_root / "logs" / current_date
    logs_dir.mkdir(parents=True, exist_ok=True)
    return str(logs_dir)


def log_separator(logger: logging.Logger, char: str = "=", length: int = 60):
    """
    Log a separator line for better readability.

    Args:
        logger: Logger instance
        char: Character to use for separator
        length: Length of the separator line
    """
    logger.info(char * length)


def log_section(logger: logging.Logger, title: str):
    """
    Log a section header with separators.

    Args:
        logger: Logger instance
        title: Section title
    """
    logger.info("=" * 60)
    logger.info(title)
    logger.info("=" * 60)
