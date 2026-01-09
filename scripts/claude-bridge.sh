#!/bin/bash

# claude-bridge.sh - Bridge script for Claude Shell IPC communication
# This script creates named pipes (FIFOs) to allow external processes
# to send commands to a Claude shell session.

set -euo pipefail

# Configuration
SESSION_DIR="$HOME/.claude-sessions"
BRIDGE_VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[claude-bridge]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[claude-bridge]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[claude-bridge]${NC} $1"
}

log_error() {
    echo -e "${RED}[claude-bridge]${NC} $1" >&2
}

# Generate session ID
generate_session_id() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback to random hex
        cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n 1 | sed -e 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1-\2-\3-\4-/'
    fi
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log_info "Cleaning up..."

    # Remove pipes
    [[ -p "$INPUT_PIPE" ]] && rm -f "$INPUT_PIPE"
    [[ -p "$OUTPUT_PIPE" ]] && rm -f "$OUTPUT_PIPE"
    [[ -p "$STATUS_PIPE" ]] && rm -f "$STATUS_PIPE"

    # Remove session metadata
    [[ -f "$SESSION_FILE" ]] && rm -f "$SESSION_FILE"

    log_success "Session ${SESSION_ID} terminated"
    exit $exit_code
}

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    log_error "Claude CLI not found. Please install it first."
    log_error "Visit: https://claude.ai/download"
    exit 1
fi

# Create session directory
mkdir -p "$SESSION_DIR"

# Generate unique session ID
SESSION_ID=$(generate_session_id)

# Define pipe paths
INPUT_PIPE="/tmp/claude-bridge-${SESSION_ID}.input"
OUTPUT_PIPE="/tmp/claude-bridge-${SESSION_ID}.output"
STATUS_PIPE="/tmp/claude-bridge-${SESSION_ID}.status"
SESSION_FILE="${SESSION_DIR}/${SESSION_ID}.json"

# Set up cleanup trap
trap cleanup EXIT INT TERM

log_info "Starting Claude Bridge v${BRIDGE_VERSION}"
log_info "Session ID: ${SESSION_ID}"
log_info "Working directory: ${PWD}"

# Create named pipes
log_info "Creating named pipes..."
mkfifo "$INPUT_PIPE"
mkfifo "$OUTPUT_PIPE"
mkfifo "$STATUS_PIPE"

# Store session metadata
cat > "$SESSION_FILE" <<EOF
{
  "sessionId": "${SESSION_ID}",
  "pid": $$,
  "inputPipe": "${INPUT_PIPE}",
  "outputPipe": "${OUTPUT_PIPE}",
  "statusPipe": "${STATUS_PIPE}",
  "workingDir": "${PWD}",
  "startedAt": $(date +%s),
  "version": "${BRIDGE_VERSION}"
}
EOF

log_success "Session metadata saved to: ${SESSION_FILE}"
log_success "Bridge is ready!"
echo ""
log_info "You can now send commands to this session from Obsidian"
log_info "The session will remain active until you exit Claude or press Ctrl+C"
echo ""

# Start status writer in background (keeps status pipe open)
(
    while true; do
        echo "ready" > "$STATUS_PIPE"
        sleep 1
    done
) &
STATUS_WRITER_PID=$!

# Start Claude process with I/O redirection
# We use a more sophisticated approach to handle bidirectional communication

# Create a FIFO for Claude's actual input
CLAUDE_INPUT="/tmp/claude-bridge-${SESSION_ID}.claude-input"
mkfifo "$CLAUDE_INPUT"

# Start Claude in background with input from our FIFO
log_info "Starting Claude..."
(claude "$@" < "$CLAUDE_INPUT" 2>&1) | while IFS= read -r line; do
    # Write to terminal for user to see
    echo "$line"
    # Also write to output pipe for plugin to read
    echo "$line" >> "$OUTPUT_PIPE"
done &

CLAUDE_PID=$!

log_success "Claude started with PID: ${CLAUDE_PID}"
echo ""

# Forward commands from input pipe to Claude
(
    # Keep Claude's input open
    exec 3>"$CLAUDE_INPUT"

    while true; do
        if read -r command < "$INPUT_PIPE"; then
            log_info "Received command from Obsidian"
            # Write to Claude's stdin
            echo "$command" >&3
            # Add a marker for response completion detection
            echo "___COMMAND_COMPLETE___" >> "$OUTPUT_PIPE"
        fi
    done
) &

INPUT_FORWARDER_PID=$!

# Wait for Claude to exit
wait $CLAUDE_PID
CLAUDE_EXIT_CODE=$?

# Kill background processes
kill $STATUS_WRITER_PID 2>/dev/null || true
kill $INPUT_FORWARDER_PID 2>/dev/null || true

# Cleanup will be called by trap
exit $CLAUDE_EXIT_CODE
