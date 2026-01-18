# Manager Agent Instructions

You are a manager agent responsible for coordinating multiple issue-fixing agents. Read open GitHub issues, select suitable ones, and spawn Claude agents in tmux sessions to work on them in parallel.

## Prerequisites

- i3wm workspace 5 configured as "5: claude-agents"
- Agents use **git worktrees** for isolation (e.g., `../claude-from-obsidian-issue-11/`)

## Workflow

```
1. List Issues → 2. Select 3 → 3. Create Tmux → 4. Spawn Agents → 5. Monitor
```

## Issue Labels

| Label | Description |
|-------|-------------|
| `status: ready` | Ready to be worked on |
| `status: in-progress` | Agent is working on this |
| `status: pr-open` | PR submitted, awaiting review |

**Manager:** Assign `status: ready` to new issues, select from ready issues.
**Agents:** Update their own labels as they work (see AGENT_ISSUES.md).

## Step-by-Step Process

### Step 1: List and Select Issues

```bash
gh issue list --state open --label "status: ready"
```

Select 3 issues that are:
- Independent of each other
- Don't modify the same files
- Have clear acceptance criteria

### Step 2: Create Tmux Session with Split Panes

```bash
tmux kill-session -t agents 2>/dev/null || true
tmux new-session -d -s agents -c /home/mfranc/Work/claude-from-obsidian
tmux split-window -h -t agents -c /home/mfranc/Work/claude-from-obsidian
tmux split-window -v -t agents -c /home/mfranc/Work/claude-from-obsidian
tmux select-layout -t agents tiled
```

### Step 3: Open on Workspace 5 and Spawn Agents

```bash
i3-msg 'workspace "5: claude-agents"; exec alacritty -e tmux attach -t agents'

tmux send-keys -t agents:0.0 'claude "Read AGENT_ISSUES.md and work on Issue #11. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.1 'claude "Read AGENT_ISSUES.md and work on Issue #12. Follow the workflow exactly."' Enter
tmux send-keys -t agents:0.2 'claude "Read AGENT_ISSUES.md and work on Issue #13. Follow the workflow exactly."' Enter
```

**Tmux navigation:** `Ctrl+B, arrows` switch panes, `Ctrl+B, z` zoom, `Ctrl+B, d` detach.

### Step 4: Monitor Progress

```bash
gh pr list --state open
gh issue list --state open  # Check label changes
```

## Cleanup

```bash
# Kill tmux session
tmux kill-session -t agents

# Clean up worktrees (after PRs merged)
git worktree list
git worktree remove ../claude-from-obsidian-issue-11
git worktree prune
```

## Important Notes

1. **Check for conflicts first** - Verify issues don't touch the same files
2. **One issue per agent** - Each agent works on exactly one issue
3. **Don't interfere** - Let agents work autonomously
4. **Review PRs** - Agents create PRs but you should review before merging

## Troubleshooting

Closing terminal doesn't kill tmux - agents keep running. To reconnect: `tmux attach -t agents`. To stop agents: `tmux kill-session -t agents`.
