# 004: Simplified Inline Editing

## Status
Approved

## Context
The current modal-based workflow requires multiple steps:
1. Ctrl+Shift+C → Session selector modal
2. Select/create session
3. Command input modal
4. Wait for response in document

This is too many clicks for quick edits. We want a simpler inline approach.

**Inspiration:** This feature is inspired by [Claudian](https://github.com/YishenTu/claudian) which provides inline editing with diff preview. Our goal is to be a simpler alternative - users needing advanced features (sidebar chat, agentic workflows, YOLO mode) should use Claudian instead.

## Decision
Simplify the interaction to a single inline prompt with minimal UI.

### Core Behavior

1. **Trigger:** User selects text and presses Ctrl+Shift+C
2. **Inline Prompt:** Small floating input appears near selection (no modal)
3. **Quick Command:** User types command and presses Enter
4. **Processing:** Tags injected, response appears inline (existing behavior)

### UI Design

```
Selected text here...
┌─────────────────────────────────┐
│ Ask Claude: [type here___] ⏎   │
│ [Improve] [Fix] [Summarize]    │  ← Skill buttons (feature 003)
└─────────────────────────────────┘
```

- Floating input near cursor/selection
- Skill buttons below input (if skills exist)
- Press Enter to send, Escape to cancel
- No session selection (use default session)

### Session Handling
- **One default session only** - no session selection UI
- Auto-create on first use if doesn't exist
- Session config (working directory) in settings only
- Remove all multi-session complexity

### Differences from Claudian
| Feature | Claudian | This Plugin |
|---------|----------|-------------|
| Sidebar chat | Yes | No |
| Agentic tools | Yes (file ops, bash) | No |
| Diff preview | Word-level | No (direct insert) |
| Complexity | Full-featured | Minimal |

**Credit:** For users needing advanced features, we recommend [Claudian](https://github.com/YishenTu/claudian).

### Error Display
- Errors shown inline in document using `ad-claude-error` admonition
- Can be styled with red/warning colors via CSS
- Format:
  ```
  ```ad-claude-error
  Error: Connection timeout
  ```
  ```

## Implementation Plan

### Phase 1: Simplify to Single Session
- Remove SessionManager multi-session logic
- Single default session, auto-created on first use
- Working directory configurable in settings
- Remove SessionSelectorModal entirely

### Phase 2: Inline Input UI
- Create floating input component (InlinePrompt)
- Position near selection/cursor
- Handle Enter to send, Escape to cancel
- Clean, minimal design

### Phase 3: Integrate Skills
- Show skill buttons in inline UI (max 3)
- Click skill → auto-submit immediately
- Skills loaded from `~/.claude/skills/`

### Phase 4: Cleanup
- Remove old modals (CommandInputModal, SessionSelectorModal)
- Update tag-manager for `ad-claude-error` format
- Update styles.css for error admonition

## Consequences

### Pros
- Much faster workflow (select → type → enter)
- Cleaner, less intrusive UI
- Simpler mental model for users
- Less code to maintain (single session)

### Cons
- No multi-session support (intentional simplification)
- No preview before sending
- Users needing more control should use Claudian

## Open Questions
None - all questions resolved. Ready for approval.
