# 006: Accept Response - Replace Original Text

## Status
Draft

## Context
After Claude provides a response (e.g., improved text, fixed code), users want to easily accept it and replace their original selection. Currently they would need to manually copy the response and paste over the original text.

Users want to:
- One-click accept Claude's suggestion
- Replace original selected text with the response
- Clean up the callout after accepting

## Decision

### Approach: Accept Button on Response Callout
Add an "Accept" button alongside the "Refine" button on response callouts.

```
> [!claude]
> Claude's response here...
> [Accept ✓] [Refine ↻]  ← Buttons in callout
```

### Behavior
1. **Click Accept button** → Response text replaces original selection
2. **Callout is removed** → Clean document, no Claude artifacts left
3. **Original text is gone** → Replaced by Claude's response

### Requirements
- Need to track original text location in the document
- Need to store original text position with the response
- Handle case where original text was modified/moved

## Implementation Plan

### Phase 1: Track Original Position
- Store original text position (line numbers, offsets) in callout metadata
- Store original text content for reference

### Phase 2: Add Accept Button
- Add "Accept" button next to "Refine" button
- Style as primary action (more prominent than Refine)

### Phase 3: Accept Workflow
- On click, find original text location from metadata
- Replace original text with response content
- Remove the entire callout block
- Handle edge cases (text moved, modified, etc.)

## Technical Considerations

- **Position tracking**: Original text position may shift if document is edited
- **Fallback**: If original position invalid, show error or insert at cursor
- **Undo support**: Obsidian's native undo should work for this operation

## Edge Cases

1. **Original text was deleted**: Show error, offer to insert at cursor
2. **Original text was modified**: Show warning, proceed anyway or cancel
3. **Document was closed**: Metadata might be stale

## Relationship with Feature 005

Both features share:
- Callout metadata storage (original text, position, command)
- Button injection via Markdown post-processor
- Similar UI patterns

Should be implemented together to share infrastructure.

## Future Enhancements
- "Accept & Edit" - replace and open for editing
- Partial accept - select which parts to accept
- Preview diff before accepting
