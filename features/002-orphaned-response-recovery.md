# 002: Orphaned Response Recovery

## Status
Draft

## Context
When a user closes a file (or Obsidian) while a Claude request is still processing, the response has nowhere to go. The user loses their response and has no way to recover it.

This is a follow-up to feature 001 (Parallel Claude Execution).

## Decision
Archive orphaned responses and notify user on next Obsidian launch.

### Core Behavior
1. When response arrives but target file is closed:
   - Save response to an archive file (e.g., `.obsidian/plugins/claude-from-obsidian/orphaned-responses.json`)
   - Store: response text, original file path, original command, timestamp

2. On next Obsidian startup (or plugin reload):
   - Check for orphaned responses
   - Show notification to user: "You have X undelivered Claude responses"
   - On click: Open modal listing orphaned responses
   - User can copy response or dismiss

3. Archive management:
   - User can clear archive from modal
   - Auto-expire old entries? (e.g., after 7 days)

## Implementation Plan

### Phase 1: Archive Storage
- Create orphaned response data structure
- Implement save/load from archive file

### Phase 2: Detection & Storage
- Detect when target file is unavailable
- Store response in archive instead of discarding

### Phase 3: Notification & Recovery UI
- Check for orphaned responses on startup
- Show notification
- Create modal for viewing/copying orphaned responses

## Consequences

### Pros
- No lost work
- User can recover responses at their convenience

### Cons
- Additional storage/state management
- Need to handle archive cleanup

## Open Questions
1. How long to keep orphaned responses before auto-cleanup?
2. Should we attempt to re-open the file and inject, or just archive?
