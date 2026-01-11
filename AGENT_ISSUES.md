# Issue Agent Instructions

You are an agent responsible for triaging, verifying, and fixing GitHub issues for this repository.

## Workflow Overview

```
1. Read Issue → 2. Create Branch → 3. Write Verification Test → 4. Comment on Issue
                                            ↓
         6. Create PR ← 5. Implement Fix (if confirmed)
                                            ↓
                              7. Cleanup (if not confirmed)
```

## Step-by-Step Process

### Step 1: Read and Analyze Issue

```bash
# List open issues
gh issue list --state open

# Read specific issue
gh issue view <issue-number>
```

Analyze the issue:
- Understand the reported problem
- Identify affected files and code locations
- Determine if it's reproducible via automated test

### Step 2: Create Branch

```bash
git checkout master
git pull origin master
git checkout -b fix/issue-<number>-<short-description>
```

Branch naming:
- Bugs: `fix/issue-<number>-<description>`
- Enhancements: `feature/issue-<number>-<description>`
- Memory leaks: `fix/issue-<number>-leak-<component>`

### Step 3: Write Verification Test

**This is critical: Write a test FIRST that demonstrates the issue exists.**

Create or update test file (e.g., `src/<component>.test.ts`):

```typescript
describe('Issue #<number>: <issue title>', () => {
    it('should <expected behavior> - currently failing', () => {
        // Test that demonstrates the bug
        // This test should FAIL with current code
    });
});
```

Run the test to confirm it fails:
```bash
npm test -- --testNamePattern="Issue #<number>"
```

### Step 4: Comment on Issue

#### If Issue is Confirmed (test fails as expected):

```bash
gh issue comment <number> --body "$(cat <<'EOF'
## Issue Confirmed

I've verified this issue with an automated test.

**Test location:** `src/<file>.test.ts`

**Test output:**
```
<paste failing test output>
```

Working on a fix now.
EOF
)"
```

#### If Issue Cannot be Confirmed:

**IMPORTANT: Always comment on the issue BEFORE cleaning up the branch.**

```bash
gh issue comment <number> --body "$(cat <<'EOF'
## Unable to Confirm

I attempted to reproduce this issue but was unable to confirm it.

**What I tried:**
- <describe test approach>

**Result:**
- <describe what happened>

**Questions:**
- <ask for clarification if needed>

Please provide more details or steps to reproduce.
EOF
)"
```

Then cleanup the branch:
```bash
git checkout master
git branch -D fix/issue-<number>-<description>
```

**Note:** Never silently abandon an issue. The issue author deserves feedback on why we couldn't reproduce their report.

### Step 5: Implement Fix

Once the test confirms the issue:

1. Implement the minimal fix
2. Run the verification test - it should now PASS
3. Run all tests to ensure no regressions:
   ```bash
   npm test
   npm run build
   ```

### Step 6: Create Pull Request

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix: <short description>

<longer description of the fix>

Fixes #<issue-number>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

git push -u origin fix/issue-<number>-<description>

gh pr create --title "Fix #<number>: <issue title>" --body "$(cat <<'EOF'
## Summary
<brief description of the fix>

## Root Cause
<explain why the bug occurred>

## Solution
<explain the fix>

## Test Plan
- [x] Added test that reproduces issue
- [x] Test passes after fix
- [x] All existing tests pass
- [x] Build succeeds

Fixes #<issue-number>

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 7: Post-PR Actions

After PR is created:

1. Link PR in issue comment:
   ```bash
   gh issue comment <number> --body "Fix submitted in PR #<pr-number>"
   ```

2. If PR is merged, verify issue auto-closes (due to "Fixes #X")

3. If PR needs changes, address review comments and update

## Test Writing Guidelines

### For Memory Leaks (Event Listeners)

```typescript
it('should remove event listeners on cleanup', () => {
    const addEventListenerSpy = jest.spyOn(element, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(element, 'removeEventListener');

    component.init();
    expect(addEventListenerSpy).toHaveBeenCalledTimes(N);

    component.destroy();
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(N);
});
```

### For Timer Leaks

```typescript
it('should clear timeouts on cleanup', () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    component.startTimer();
    component.destroy();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    jest.useRealTimers();
});
```

### For Process Leaks

```typescript
it('should kill running process on stop', () => {
    const mockKill = jest.fn();
    // ... setup mock process

    component.stop();

    expect(mockKill).toHaveBeenCalledWith('SIGKILL');
});
```

## Commands Reference

```bash
# Issues
gh issue list --state open
gh issue view <number>
gh issue comment <number> --body "message"

# Branches
git checkout -b fix/issue-<number>-<desc>
git branch -D <branch>  # delete local

# Testing
npm test
npm test -- --testNamePattern="Issue #<number>"
npm run build

# PRs
gh pr create --title "..." --body "..."
gh pr view <number>
```

## Labels to Use

When commenting, suggest labels if appropriate:
- `bug` - Confirmed bugs
- `enhancement` - Feature requests
- `memory-leak` - Memory/resource leaks
- `performance` - Performance issues
- `cannot-reproduce` - Unable to confirm issue
- `needs-info` - More information needed

## Important Notes

1. **Always write the test first** - This proves the issue exists
2. **Minimal fixes only** - Don't refactor unrelated code
3. **Reference the issue** - Use "Fixes #X" in commit/PR to auto-close
4. **Run full test suite** - Ensure no regressions before PR
5. **Always communicate** - Comment on issue whether confirmed or not
6. **Clean up after commenting** - Delete branches for unconfirmed issues only AFTER leaving a comment explaining why
