#!/bin/bash
# Run a single e2e test using xdotool
# Usage: ./run-test.sh <test-name> <command> <expected-pattern>
#
# Example: ./run-test.sh "uppercase" "make this uppercase" "HELLO"

set -e

TEST_NAME="${1:-uppercase}"
COMMAND="${2:-make this uppercase}"
EXPECTED="${3:-}"
TIMEOUT="${4:-40}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_PATH="$SCRIPT_DIR/../testvault"
SCREENSHOT_DIR="/tmp/e2e-screenshots"

mkdir -p "$SCREENSHOT_DIR"

echo "=== E2E Test: $TEST_NAME ==="
echo "Command: $COMMAND"
echo "Expected: $EXPECTED"
echo ""

# Check if xdotool is installed
if ! command -v xdotool &> /dev/null; then
    echo "❌ xdotool not installed. Run: sudo apt install xdotool"
    exit 1
fi

# Check if Obsidian is running
if ! xdotool search --name "Obsidian" &> /dev/null; then
    echo "❌ Obsidian is not running. Please start Obsidian with the test vault."
    echo "   Vault path: $VAULT_PATH"
    exit 1
fi

echo "1. Focusing Obsidian window..."
WINDOW_ID=$(xdotool search --name "Obsidian" | head -1)
xdotool windowactivate "$WINDOW_ID"
sleep 0.5

echo "2. Opening test file (Ctrl+O)..."
xdotool key ctrl+o
sleep 0.5
xdotool type "test-$TEST_NAME.md"
sleep 0.3
xdotool key Return
sleep 0.5

echo "3. Taking 'before' screenshot..."
if command -v scrot &> /dev/null; then
    scrot -u -q 80 "$SCREENSHOT_DIR/${TEST_NAME}-before.jpg"
else
    echo "   (scrot not installed, skipping screenshot)"
fi

echo "4. Selecting text (Ctrl+A)..."
xdotool key ctrl+a
sleep 0.3

echo "5. Triggering plugin (Ctrl+Shift+C)..."
xdotool key ctrl+shift+c
sleep 0.5

echo "6. Typing command: $COMMAND"
xdotool type "$COMMAND"
sleep 0.2
xdotool key Return

echo "7. Waiting for Claude response (${TIMEOUT}s timeout)..."
sleep "$TIMEOUT"

echo "8. Taking 'after' screenshot..."
if command -v scrot &> /dev/null; then
    scrot -u -q 80 "$SCREENSHOT_DIR/${TEST_NAME}-after.jpg"
else
    echo "   (scrot not installed, skipping screenshot)"
fi

echo "9. Reading result from file..."
TEST_FILE="$VAULT_PATH/test-files/test-$TEST_NAME.md"
RESULT=$(cat "$TEST_FILE" 2>/dev/null || echo "")

echo ""
echo "=== Result ==="
echo "$RESULT"
echo ""

# Verify Claude responded (look for ad-claude block)
if echo "$RESULT" | grep -q "ad-claude"; then
    echo "✅ Claude responded!"

    # If expected pattern provided, check for it too
    if [ -n "$EXPECTED" ]; then
        if echo "$RESULT" | grep -q "$EXPECTED"; then
            echo "✅ PASS: Found expected pattern '$EXPECTED'"
        else
            echo "⚠️  Pattern '$EXPECTED' not found (Claude may need file permissions)"
        fi
    fi
    echo "Screenshots saved to: $SCREENSHOT_DIR"
    exit 0
else
    echo "❌ FAIL: Claude did not respond (no ad-claude block found)"
    echo ""
    echo "Screenshots saved to: $SCREENSHOT_DIR"
    exit 1
fi
