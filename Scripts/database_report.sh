#!/bin/bash
#
# Database Sanitization and Inspection Script
# This script runs daily database operations including MongoDB inspection
#
# Created by: Aman Mundra
# Date: 2026-02-04
#
# Usage:
#   ./sanitize.sh
#
# To run daily via cron, add this line to your crontab (crontab -e):
#   0 2 * * * /Users/aman/Welzin/dev/cognerd/Scripts/sanitize.sh >> /Users/aman/Welzin/dev/cognerd/PyCode/logs/sanitize_cron.log 2>&1
#

# Exit on error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYCODE_DIR="$PROJECT_ROOT/PyCode"
SRC_DIR="$PYCODE_DIR/src"

# Log file setup
CURRENT_DATE=$(date +"%d-%m-%Y")
LOG_DIR="$PYCODE_DIR/logs/$CURRENT_DATE"
mkdir -p "$LOG_DIR"

# Start logging
printf "${BLUE}========================================${NC}\n"
printf "${BLUE}Database Sanitization Script${NC}\n"
printf "${BLUE}Started at: $(date '+%Y-%m-%d %H:%M:%S')${NC}\n"
printf "${BLUE}========================================${NC}\n\n"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    printf "${RED}❌ Python3 is not installed or not in PATH${NC}\n"
    exit 1
fi

# Check if the main.py file exists
if [ ! -f "$SRC_DIR/main.py" ]; then
    printf "${RED}❌ main.py not found at $SRC_DIR/main.py${NC}\n"
    exit 1
fi

# Navigate to the source directory
cd "$SRC_DIR"

printf "${YELLOW}Running database operations...${NC}\n\n"

# Run the main Python script
if python3 main.py; then
    printf "\n${GREEN}✅ Database operations completed successfully${NC}\n"
    EXIT_CODE=0
else
    printf "\n${RED}❌ Database operations failed${NC}\n"
    EXIT_CODE=1
fi

printf "\n${BLUE}========================================${NC}\n"
printf "${BLUE}Completed at: $(date '+%Y-%m-%d %H:%M:%S')${NC}\n"
printf "${BLUE}Logs stored in: $LOG_DIR${NC}\n"
printf "${BLUE}========================================${NC}\n"

exit $EXIT_CODE
