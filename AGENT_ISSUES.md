# Issue Agent Instructions

You are an agent responsible for triaging, verifying, and fixing GitHub issues for this repository.

## Getting Started

You may either:
1. **Be assigned an issue** - If spawned by a manager agent, you will be given a specific issue number to work on
2. **Pick an issue yourself** - If working independently, pick an open issue from `gh issue list --state open`

If you were given an issue number, skip to Step 1 and use that issue. Otherwise, pick one yourself.

## Workflow Overview

```
1. Read Issue → 2. Create Worktree & Branch → 3. Write Verification Test → 4. Comment on Issue
                                                          ↓
              7. Create PR ← 6. Run Tests ← 5. Implement Fix (if confirmed)
                    ↓
              8. Cleanup Worktree
```

## Step-by-Step Process

### Step 1: Read and Analyze Issue

```bash
# List open issues (prefer ones labeled "status: ready")
gh issue list --state open --label "status: ready"

# Read specific issue
gh issue view <issue-number>
```

Analyze the issue:
- Understand the reported problem
- Identify affected files and code locations
- Determine if it's reproducible via automated test

**Mark issue as in-progress (YOU must do this):**
```bash
gh issue edit <number> --remove-label "status: ready" --add-label "status: in-progress"
```

### Step 2: Create Worktree and Branch

**Important:** Use git worktrees to avoid conflicts with other agents working in parallel.

```bash
# From the main repo directory
cd /home/mfranc/Work/claude-from-obsidian

# Ensure master is up to date
git fetch origin master

# Create a worktree for this issue (creates both worktree and branch)
git worktree add ../claude-from-obsidian-issue-<number> -b fix/issue-<number>-<short-description> origin/master

# Move into the worktree
cd ../claude-from-obsidian-issue-<number>

# Install dependencies in the worktree
npm install
```

This creates:
- A new directory `../claude-from-obsidian-issue-<number>`
- A new branch `fix/issue-<number>-<short-description>` based on origin/master
- Complete isolation from other agents

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

**IMPORTANT: Always comment on the issue BEFORE cleaning up the worktree.**

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

Then cleanup the worktree and branch:
```bash
# Go back to main repo
cd /home/mfranc/Work/claude-from-obsidian

# Remove the worktree
git worktree remove ../claude-from-obsidian-issue-<number>

# Delete the branch
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

1. **Update issue label to pr-open (YOU must do this):**
   ```bash
   gh issue edit <number> --remove-label "status: in-progress" --add-label "status: pr-open"
   ```

2. Link PR in issue comment:
   ```bash
   gh issue comment <number> --body "Fix submitted in PR #<pr-number>"
   ```

3. If PR is merged, verify issue auto-closes (due to "Fixes #X")

4. If PR needs changes, address review comments and update

### Step 8: Cleanup Worktree

After PR is merged (or abandoned), clean up the worktree:

```bash
# Go back to main repo
cd /home/mfranc/Work/claude-from-obsidian

# Remove the worktree
git worktree remove ../claude-from-obsidian-issue-<number>

# If branch was merged, it's already deleted on remote
# Delete local branch if it still exists
git branch -D fix/issue-<number>-<description> 2>/dev/null || true

# Prune any stale worktree references
git worktree prune
```

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

# Worktrees
git worktree add <path> -b <branch> origin/master
git worktree remove <path>
git worktree list
git worktree prune

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

### Status Labels (YOU must update these)

| Label | When to Set |
|-------|-------------|
| `status: ready` | Issue is ready to work on (set by manager or initially) |
| `status: in-progress` | **Set this in Step 1** when you start working |
| `status: pr-open` | **Set this in Step 7** after creating PR |
| `status: done` | Set when PR is merged (usually automatic) |

### Category Labels

When commenting, suggest category labels if appropriate:
- `bug` - Confirmed bugs
- `enhancement` - Feature requests
- `memory-leak` - Memory/resource leaks
- `performance` - Performance issues
- `cannot-reproduce` - Unable to confirm issue
- `needs-info` - More information needed

## Important Notes

1. **Update labels yourself** - Set `status: in-progress` when starting, `status: pr-open` after PR
2. **Always write the test first** - This proves the issue exists
3. **Minimal fixes only** - Don't refactor unrelated code
4. **Reference the issue** - Use "Fixes #X" in commit/PR to auto-close
5. **Run full test suite** - Ensure no regressions before PR
6. **Always communicate** - Comment on issue whether confirmed or not
7. **Clean up after commenting** - Delete worktrees for unconfirmed issues only AFTER leaving a comment explaining why
8. **Use worktrees** - Always work in a worktree to avoid conflicts with other agents
