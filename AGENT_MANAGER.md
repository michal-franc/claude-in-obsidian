# Manager Agent Instructions

You are a manager agent responsible for coordinating multiple issue-fixing agents. Your job is to read open GitHub issues, select suitable ones, and spawn Claude agents in tmux sessions to work on them in parallel.

## Prerequisites

- i3wm workspace 5 is configured as "5: claude-agents" on the primary monitor
- Reload i3 config if needed: `$mod+Shift+r`

## How Agents Work in Isolation

Each agent uses **git worktrees** to work in complete isolation:
- Agent for Issue #11 works in `../claude-from-obsidian-issue-11/`
- Agent for Issue #12 works in `../claude-from-obsidian-issue-12/`
- Agent for Issue #13 works in `../claude-from-obsidian-issue-13/`

This prevents file conflicts and allows parallel work on different branches.

## Workflow Overview

```
1. List Issues → 2. Analyze & Select 3 → 3. Create Tmux Sessions → 4. Spawn Agents → 5. Monitor Progress
```

## Step-by-Step Process

### Step 1: List Open Issues

```bash
gh issue list --state open --limit 20
```

Review the list and identify issues that are:
- Well-defined with clear reproduction steps
- Independent (not dependent on other issues)
- Suitable for automated verification via tests

### Step 2: Analyze and Select 3 Issues

For each candidate issue, quickly review it:
```bash
gh issue view <issue-number>
```

Select 3 issues that:
1. Are independent of each other (can be worked on in parallel)
2. Don't modify the same files (to avoid merge conflicts)
3. Have clear acceptance criteria

**Avoid selecting:**
- Issues that depend on other issues being fixed first
- Issues that would modify the same core files
- Issues that require user input or clarification

### Step 3: Create Tmux Sessions

There are two modes: **background mode** (detached) or **visible mode** (for watching agents work).

#### Option A: Visible Mode (Recommended for i3wm)

Create a single tmux session with split panes so you can watch all agents work:

```bash
# Create main session with first agent
tmux new-session -d -s agents -c /home/mfranc/Work/claude-from-obsidian

# Split horizontally for second agent
tmux split-window -h -t agents -c /home/mfranc/Work/claude-from-obsidian

# Split the right pane vertically for third agent
tmux split-window -v -t agents -c /home/mfranc/Work/claude-from-obsidian

# Even out the panes
tmux select-layout -t agents tiled
```

This creates a layout like:
```
+------------------+------------------+
|                  |                  |
|    Agent 1       |    Agent 2       |
|                  |                  |
+------------------+------------------+
|                                     |
|            Agent 3                  |
|                                     |
+-------------------------------------+
```

#### Option B: Background Mode (Detached)

Create separate detached sessions for each issue:

```bash
# Create sessions for each issue
tmux new-session -d -s agent-issue-7 -c /home/mfranc/Work/claude-from-obsidian
tmux new-session -d -s agent-issue-8 -c /home/mfranc/Work/claude-from-obsidian
tmux new-session -d -s agent-issue-9 -c /home/mfranc/Work/claude-from-obsidian
```

Naming convention: `agent-issue-<number>`

### Step 4: Spawn Claude Agents

#### For Visible Mode (Option A):

```bash
# Open terminal on workspace 5 (claude-agents) attached to tmux session
i3-msg 'workspace "5: claude-agents"; exec alacritty -e tmux attach -t agents'

# Send commands to each pane (panes are numbered 0, 1, 2)
tmux send-keys -t agents:0.0 'claude "Read AGENT_ISSUES.md and work on Issue #7. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.1 'claude "Read AGENT_ISSUES.md and work on Issue #8. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.2 'claude "Read AGENT_ISSUES.md and work on Issue #9. Follow the workflow exactly."' Enter
```

**Tmux navigation while attached:**
- `Ctrl+B, arrow keys` - Switch between panes
- `Ctrl+B, z` - Zoom current pane (toggle fullscreen)
- `Ctrl+B, d` - Detach (agents keep running)

#### For Background Mode (Option B):

```bash
# Spawn agent for issue 7
tmux send-keys -t agent-issue-7 'claude "Read AGENT_ISSUES.md and work on Issue #7. Follow the workflow exactly."' Enter

# Spawn agent for issue 8
tmux send-keys -t agent-issue-8 'claude "Read AGENT_ISSUES.md and work on Issue #8. Follow the workflow exactly."' Enter

# Spawn agent for issue 9
tmux send-keys -t agent-issue-9 'claude "Read AGENT_ISSUES.md and work on Issue #9. Follow the workflow exactly."' Enter
```

### Step 5: Monitor Progress

Check on agent progress periodically:

```bash
# List all agent sessions
tmux list-sessions | grep agent-issue

# View a specific agent's output (read-only)
tmux capture-pane -t agent-issue-7 -p | tail -50

# Attach to a session if needed (Ctrl+B, D to detach)
tmux attach -t agent-issue-7
```

Check GitHub for activity:
```bash
# Check for new PRs
gh pr list --state open

# Check for issue comments
gh issue view <number> --comments
```

## Quick Reference

### Tmux Commands

```bash
# Create detached session
tmux new-session -d -s <name> -c <working-dir>

# Send command to session
tmux send-keys -t <session> '<command>' Enter

# List sessions
tmux list-sessions

# Capture output
tmux capture-pane -t <session> -p | tail -N

# Kill session
tmux kill-session -t <session>

# Attach to session
tmux attach -t <session>
```

### GitHub Commands

```bash
# List open issues
gh issue list --state open

# View issue details
gh issue view <number>

# List open PRs
gh pr list --state open

# View PR details
gh pr view <number>
```

## Example Full Workflow (Visible Mode)

```bash
# 0. Ensure no existing session (clean slate)
tmux kill-session -t agents 2>/dev/null || true

# 1. List issues
gh issue list --state open

# 2. Review candidates (example: issues 11, 12, 13)
gh issue view 11
gh issue view 12
gh issue view 13

# 3. Create tmux session with split panes
tmux new-session -d -s agents -c /home/mfranc/Work/claude-from-obsidian
tmux split-window -h -t agents -c /home/mfranc/Work/claude-from-obsidian
tmux split-window -v -t agents -c /home/mfranc/Work/claude-from-obsidian
tmux select-layout -t agents tiled

# 4. Open on workspace 5 (claude-agents)
i3-msg 'workspace "5: claude-agents"; exec alacritty -e tmux attach -t agents'

# 5. Spawn agents in each pane
tmux send-keys -t agents:0.0 'claude "Read AGENT_ISSUES.md and work on Issue #11. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.1 'claude "Read AGENT_ISSUES.md and work on Issue #12. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.2 'claude "Read AGENT_ISSUES.md and work on Issue #13. Follow the workflow exactly."' Enter

# While watching: Ctrl+B, arrow keys to switch panes
# While watching: Ctrl+B, z to zoom a pane
# While watching: Ctrl+B, d to detach (agents keep running)

# 6. Check for PRs
gh pr list --state open
```

## Handling Conflicts

If two agents try to modify the same file:
1. Let the first PR merge
2. The second agent's branch will need rebasing
3. Comment on the second issue asking for manual intervention

## Cleanup

After agents complete their work:

### Kill Tmux Sessions

```bash
# For visible mode - kill the unified session
tmux kill-session -t agents

# For background mode - kill individual sessions
tmux kill-session -t agent-issue-11
tmux kill-session -t agent-issue-12
tmux kill-session -t agent-issue-13

# Or kill all agent sessions at once (background mode)
tmux list-sessions | grep agent-issue | cut -d: -f1 | xargs -I{} tmux kill-session -t {}
```

### Clean Up Worktrees (After PRs are Merged)

Agents should clean up their own worktrees, but if needed you can do it manually:

```bash
cd /home/mfranc/Work/claude-from-obsidian

# List all worktrees
git worktree list

# Remove specific worktrees
git worktree remove ../claude-from-obsidian-issue-11
git worktree remove ../claude-from-obsidian-issue-12
git worktree remove ../claude-from-obsidian-issue-13

# Prune stale worktree references
git worktree prune

# Clean up any leftover directories
rm -rf ../claude-from-obsidian-issue-* 2>/dev/null || true
```

## Important Notes

1. **Check for conflicts first** - Before selecting issues, verify they don't touch the same files
2. **One issue per agent** - Each agent works on exactly one issue
3. **Don't interfere** - Let agents work autonomously, only intervene if stuck
4. **Review PRs** - Agents create PRs but you should review them before merging
5. **Stagger if needed** - If issues might conflict, spawn agents with delays between them

## Troubleshooting

### Terminal vs Tmux Session

**Important:** The terminal window and tmux session are separate:

- **Closing the terminal window** (e.g., clicking X or `$mod+Shift+q` in i3) does NOT kill the tmux session
- Agents continue running in the background even if you close the terminal
- To reconnect: open a new terminal and run `tmux attach -t agents`

### If You Accidentally Close the Terminal

```bash
# Check if tmux session is still running
tmux list-sessions | grep agents

# If it exists, reattach
tmux attach -t agents

# Or open it on workspace 5 again
i3-msg "workspace 5: claude-agents; exec alacritty -e tmux attach -t agents"
```

### If You Want to Actually Stop Agents

You must kill the tmux session, not just close the terminal:

```bash
# Kill the entire session (stops all agents)
tmux kill-session -t agents

# Or kill a specific pane (stops one agent)
tmux kill-pane -t agents:0.0
```

### Session Already Exists Error

If you get "duplicate session: agents" error:

```bash
# Kill existing session first
tmux kill-session -t agents

# Then create new one
tmux new-session -d -s agents -c /home/mfranc/Work/claude-from-obsidian
# ... continue with setup
```
