#!/bin/bash

SOURCE_DIR="/Users/aman/Welzin/Dev/cognerd"
TARGET_DIR="/Users/aman/Welzin/Dev/cognerd-vercel"

# Slack webhook URL (set this to your webhook URL or leave empty to disable notifications)
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output functions
error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Slack notification function
send_slack_notification() {
    local status="$1"
    local message="$2"
    local color="$3"

    # Skip if webhook URL is not set
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        return 0
    fi

    local emoji=""
    if [ "$status" == "success" ]; then
        emoji=":white_check_mark:"
    elif [ "$status" == "failure" ]; then
        emoji=":x:"
    else
        emoji=":information_source:"
    fi

    local hostname=$(hostname)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$emoji Vercel Sync - $status",
            "text": "$message",
            "fields": [
                {
                    "title": "Source",
                    "value": "$SOURCE_DIR",
                    "short": true
                },
                {
                    "title": "Target",
                    "value": "$TARGET_DIR",
                    "short": true
                },
                {
                    "title": "Host",
                    "value": "$hostname",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "$timestamp",
                    "short": true
                }
            ]
        }
    ]
}
EOF
)

    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK_URL" \
        --silent --output /dev/null
}

# Error handler for script failures
handle_error() {
    local exit_code=$?
    local line_number=$1
    error "Script failed at line $line_number with exit code $exit_code"
    send_slack_notification "failure" "Sync failed at line $line_number with exit code $exit_code" "danger"
    exit $exit_code
}

# Set trap to catch errors
trap 'handle_error ${LINENO}' ERR

# Start notification
info "Starting Vercel sync process..."

# Navigate to the source directory and pull the latest changes
cd "$SOURCE_DIR" || {
    error "Failed to change directory to $SOURCE_DIR. Exiting."
    send_slack_notification "failure" "Failed to access source directory: $SOURCE_DIR" "danger"
    exit 1
}

# Check for uncommitted changes
info "Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
    warning "Uncommitted changes detected in $SOURCE_DIR"
    warning "Attempting to stash changes before pull..."
    git stash save "Auto-stash before sync $(date '+%Y-%m-%d %H:%M:%S')"
    STASHED=true
else
    STASHED=false
fi

# Fetch to check for conflicts without merging
info "Fetching latest changes from remote..."
git fetch origin

# Check if pull would cause conflicts
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
info "Current branch: $CURRENT_BRANCH"

# Check if merge would have conflicts
git merge-tree $(git merge-base HEAD origin/$CURRENT_BRANCH) HEAD origin/$CURRENT_BRANCH > /dev/null 2>&1
if [ $? -ne 0 ]; then
    error "Merge conflicts detected! Manual intervention required."
    error "Please resolve conflicts in $SOURCE_DIR before running this script."
    if [ "$STASHED" = true ]; then
        warning "Restoring stashed changes..."
        git stash pop
    fi
    send_slack_notification "failure" "Merge conflicts detected in $SOURCE_DIR on branch $CURRENT_BRANCH. Manual intervention required." "danger"
    exit 1
fi

info "No conflicts detected. Pulling latest changes in $SOURCE_DIR..."
git pull

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    info "Restoring stashed changes..."
    if ! git stash pop; then
        error "Failed to restore stashed changes. Please check $SOURCE_DIR manually."
        send_slack_notification "failure" "Failed to restore stashed changes in $SOURCE_DIR after pull" "danger"
        exit 1
    fi
    success "Stashed changes restored successfully"
fi

# CogNerd git push
#git add .
#COMMIT_MESSAGE="Aman:Code Edits & Features: $(date '+%Y-%m-%d %H:%M:%S')"
#git commit -m "$COMMIT_MESSAGE"
#git push

# Navigate back to the original directory
cd - > /dev/null


# Sync the directories
info "Syncing $SOURCE_DIR to $TARGET_DIR..."
rsync -av --delete --exclude='.git/' "$SOURCE_DIR/" "$TARGET_DIR/"

# Check if rsync was successful
if [ $? -ne 0 ]; then
    error "rsync failed. Exiting."
    send_slack_notification "failure" "rsync failed while syncing from $SOURCE_DIR to $TARGET_DIR" "danger"
    exit 1
fi

success "Sync complete. Committing and pushing changes in $TARGET_DIR..."

# Navigate to the target directory
cd "$TARGET_DIR" || {
    error "Failed to change directory to $TARGET_DIR. Exiting."
    send_slack_notification "failure" "Failed to access target directory: $TARGET_DIR" "danger"
    exit 1
}

# Add all changes
git add .

# Commit changes with a timestamp
COMMIT_MESSAGE="Cognerd Repo Sync [v2.2]: $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MESSAGE"

# Push to the remote repository
#git pull
if ! git push; then
    error "Failed to push changes to remote repository"
    send_slack_notification "failure" "Failed to push changes to remote repository" "danger"
    exit 1
fi

success "Repo Synced Successfully!"

# Send success notification to Slack
send_slack_notification "success" "Sync completed successfully from $SOURCE_DIR to $TARGET_DIR" "good"