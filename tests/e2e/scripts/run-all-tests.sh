#!/bin/bash
# Run full e2e test suite
# Usage: ./run-all-tests.sh [--skip-start]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKIP_START="${1:-}"

PASS=0
FAIL=0
RESULTS=()

run_test() {
    local name="$1"
    local command="$2"
    local expected="$3"
    local timeout="${4:-15}"

    echo ""
    echo "========================================"
    echo "TEST: $name"
    echo "========================================"

    if "$SCRIPT_DIR/run-test.sh" "$name" "$command" "$expected" "$timeout"; then
        PASS=$((PASS + 1))
        RESULTS+=("✅ $name")
    else
        FAIL=$((FAIL + 1))
        RESULTS+=("❌ $name")
    fi

    # Cool down between tests
    sleep 2
}

# Start Obsidian unless skipped
if [ "$SKIP_START" != "--skip-start" ]; then
    "$SCRIPT_DIR/start-obsidian.sh"

    echo ""
    echo "Waiting 5s for Obsidian to fully load..."
    sleep 5
fi

# Verify Obsidian is running
if ! xdotool search --name "Obsidian" &>/dev/null; then
    echo "❌ Obsidian is not running!"
    exit 1
fi

echo ""
echo "========================================"
echo "STARTING E2E TEST SUITE"
echo "========================================"

# Run tests
run_test "uppercase" "make this uppercase" "HELLO" 15

echo ""
echo "========================================"
echo "TEST RESULTS"
echo "========================================"
echo ""
for result in "${RESULTS[@]}"; do
    echo "$result"
done
echo ""
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

# Cleanup after tests
echo ""
echo "========================================"
echo "CLEANUP"
echo "========================================"
"$SCRIPT_DIR/cleanup.sh"

if [ $FAIL -gt 0 ]; then
    echo "❌ SOME TESTS FAILED"
    exit 1
else
    echo "✅ ALL TESTS PASSED"
    exit 0
fi
