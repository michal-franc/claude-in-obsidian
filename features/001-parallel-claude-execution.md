# 001: Parallel Claude Execution with Visual Indicators

## Status
Implemented

## Context
Currently, when a user sends a command to Claude, they must wait for the response before continuing their work. This blocks the user's workflow, especially for longer-running requests.

Users want to:
- Continue working while Claude processes their request
- See visual feedback on where Claude's response will appear
- Know the status of ongoing Claude operations

## Decision
Implement parallel (non-blocking) Claude execution with visual placeholders and status updates.

### Core Behavior
1. When user triggers Claude command with selected text or cursor position:
   - Inject `<CLAUDE Processing...>` tags wrapping the selected text (or empty if no selection)
   - Original text is preserved inside tags
   - The tagged region is visually dimmed/styled to indicate work in progress

2. When Claude responds:
   - Keep original text
   - Add separator `<!-- Claude -->` below original
   - Add Claude's response below separator
   - Remove the `<CLAUDE>` tags
   - Visual dimming is removed

   Example with selection:
   ```
   Before:    My selected text
   Inject:    <CLAUDE Processing...>My selected text</CLAUDE>
   Response:  My selected text
              <!-- Claude -->
              Claude's improved version
   ```

   Example without selection (cursor only):
   ```
   Before:    Text here| (cursor)
   Inject:    Text here<CLAUDE Processing...></CLAUDE>
   Response:  Text here
              <!-- Claude -->
              Claude's response
   ```

3. Status bar at bottom of Obsidian shows:
   - Simple "Processing..." text when request is active
   - On click: Opens modal with detailed status/info
   - Shows warnings when tags were modified/deleted (click for response)

### Edge Cases & Decisions
- **User edits text inside tags while processing**: Ignore - let them edit, response will replace anyway
- **User edits/breaks the tags themselves**: Show warning in status bar. On click, open modal explaining plugin couldn't auto-inject, but display the response for manual copy
- **User deletes the tags entirely**: Same as above - warning + modal with response
- **Request fails/times out**: Display error message inside the `<CLAUDE></CLAUDE>` tags
- **Max parallel requests**: 1 - queue additional requests, process sequentially
- **User closes file before response**: Out of scope - see feature 002

## Implementation Plan

### Phase 1: Status Bar Component
- Add status bar item to Obsidian
- Show connection status and active request count
- Update in real-time

### Phase 2: Tag Injection
- Modify command flow to inject tags before sending request
- Add CSS styling for dimmed appearance of tagged regions
- Handle cursor position vs selection scenarios

### Phase 3: Async Response Handling
- Refactor to non-blocking request/response
- Implement response insertion at tagged location
- Handle tag cleanup after response

### Phase 4: Error Handling & Polish
- Timeout handling
- Error display in tagged region
- User cancellation support

## Consequences

### Pros
- Non-blocking workflow
- Clear visual feedback
- Can run multiple requests simultaneously

### Cons
- More complex state management
- Need to handle edge cases (editing during processing, file changes)
- Tags in document may be unexpected for some users

## Open Questions
None - all questions resolved. Ready for approval.
