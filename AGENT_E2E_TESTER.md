# E2E Tester Agent Instructions

You are an agent responsible for running end-to-end tests on the Claude from Obsidian plugin.

## Prerequisites

Required tools: `xdotool`, `scrot`, `xclip`

```bash
# Install if needed
sudo apt install xdotool scrot xclip
```

## Quick Start - Run All Tests

This starts Obsidian on workspace "5: claude-agents" and runs all tests:

```bash
./tests/e2e/scripts/run-all-tests.sh
```

## Manual Testing

### 1. Start Obsidian with Test Vault

```bash
./tests/e2e/scripts/start-obsidian.sh
```

This will:
- Kill any existing Obsidian instances
- Deploy the plugin to the test vault
- Launch Obsidian on workspace "5: claude-agents"
- Open the test vault automatically

### 2. Run Individual Tests

```bash
./tests/e2e/scripts/run-test.sh <test-name> "<command>" "<expected>"
```

## Test Vault Location

```
/home/mfranc/Work/claude-from-obsidian/tests/e2e/testvault
```

## Available Tests

| Test File | Command to Give | Expected Result |
|-----------|-----------------|-----------------|
| test-uppercase.md | "make this uppercase" | Text contains "HELLO WORLD" |
| test-summary.md | "summarize this in one sentence" | Shorter text than original |
| test-fix-grammar.md | "fix the grammar" | Proper grammar (He and I, bought, things, people) |
| test-code.md | "implement this function" | Contains `function` and `return` |

## Running Tests Manually

Use the test script:
```bash
./tests/e2e/scripts/run-test.sh <test-name> "<command>" "<expected-pattern>"
```

Examples:
```bash
./tests/e2e/scripts/run-test.sh uppercase "make this uppercase" "HELLO"
./tests/e2e/scripts/run-test.sh fix-grammar "fix the grammar" "bought"
```

## Running Tests with xdotool Directly

### Step-by-Step Commands

```bash
# 1. Focus Obsidian window
xdotool search --name "Obsidian" windowactivate
sleep 0.5

# 2. Open quick switcher (Ctrl+O)
xdotool key ctrl+o
sleep 0.5

# 3. Type filename
xdotool type "test-uppercase.md"
xdotool key Return
sleep 0.5

# 4. Select all text
xdotool key ctrl+a
sleep 0.3

# 5. Trigger plugin (Ctrl+Shift+C)
xdotool key ctrl+shift+c
sleep 0.5

# 6. Type command
xdotool type "make this uppercase"
xdotool key Return

# 7. Wait for response
sleep 10

# 8. Take screenshot for verification
scrot /tmp/test-result.png

# 9. Copy result to clipboard
xdotool key ctrl+a
xdotool key ctrl+c
xclip -selection clipboard -o
```

## Full Test Suite

Run all tests sequentially:

```bash
#!/bin/bash
PASS=0
FAIL=0

run_test() {
    echo "=== Testing: $1 ==="
    if ./tests/e2e/scripts/run-test.sh "$1" "$2" "$3"; then
        ((PASS++))
    else
        ((FAIL++))
    fi
    sleep 2  # Cool down between tests
}

run_test "uppercase" "make this uppercase" "HELLO"
run_test "fix-grammar" "fix the grammar" "bought"
run_test "summary" "summarize in one sentence" ""
run_test "code" "implement this function" "function"

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
```

## Verification Methods

### 1. Clipboard Check
```bash
xdotool key ctrl+a
xdotool key ctrl+c
result=$(xclip -selection clipboard -o)
echo "$result" | grep -i "expected"
```

### 2. File System Check
```bash
# Read the file directly after test
cat tests/e2e/testvault/test-files/test-uppercase.md
```

### 3. Screenshot + Manual Review
```bash
scrot /tmp/e2e-after.png
# View: feh /tmp/e2e-after.png
```

### 4. Screenshot + Claude Vision (Advanced)
```bash
scrot /tmp/e2e-result.png
claude "Look at this screenshot and tell me if the text has been converted to uppercase" < /tmp/e2e-result.png
```

## Troubleshooting

### xdotool can't find Obsidian
```bash
# List all windows
xdotool search --name ""

# Try different search
xdotool search --class "obsidian"
```

### Plugin shortcut not working
- Check Obsidian Settings → Hotkeys
- Verify plugin is enabled
- Try: `xdotool key ctrl+shift+c` vs `xdotool key Control+Shift+c`

### Timing issues
- Increase sleep times between commands
- Claude responses can take 5-30 seconds depending on complexity

## Reporting Results

After running tests, report:

```
## E2E Test Report

**Date:** YYYY-MM-DD
**Plugin Version:** X.X.X

| Test | Command | Expected | Result |
|------|---------|----------|--------|
| uppercase | make uppercase | HELLO | ✅ PASS |
| grammar | fix grammar | bought | ✅ PASS |
| summary | summarize | shorter | ✅ PASS |
| code | implement | function | ❌ FAIL |

**Notes:**
- Any issues encountered
- Screenshots saved to /tmp/e2e-screenshots/
```
