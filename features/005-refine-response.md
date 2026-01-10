# 005: Refine Response - Iterative Refinement

## Status
Draft

## Context
After Claude responds, users often want to refine the response - make it shorter, change the tone, add details, etc. Currently they would need to select the response text and trigger a new command, losing the context of the original request.

Users want to:
- Quickly iterate on Claude's response
- Ask for modifications like "make this shorter" or "more formal"
- Keep the conversation context

## Decision

### Approach: Refine Button on Response Callout
Add a small button/icon on the response callout that opens the inline prompt.

```
> [!claude]
> Claude's response here...
> [Accept ✓] [Refine ↻]  ← Buttons in callout
```

Note: Accept button is part of Feature 006.

### Behavior
1. **Click Refine button** → Opens inline prompt near the callout
2. **User types refinement** → e.g., "make this shorter"
3. **Submit** → Claude receives full context and refinement request
4. **Response replaces original** → New response overwrites the callout content

### Context Sent to Claude
Include full conversation context:
- Original selected text
- Original command/prompt
- Previous response
- New refinement request

Example prompt structure:
```
Original text: [user's selected text]
Original request: [user's first command]
Previous response: [Claude's response]
Refinement request: [user's new instruction, e.g., "make this shorter"]
```

### What Happens to Original Response
**Replace** - The new refined response replaces the original callout content. No history kept (simple approach for v1).

## Implementation Plan

### Phase 1: Store Context with Response
- Modify tag-manager to embed metadata in callout (original text, command)
- Use HTML comments or data attributes to store context invisibly
- Example: `<!-- claude-context: {"original": "...", "command": "..."} -->`

### Phase 2: Add Refine Button
- Register a Markdown post-processor to detect `[!claude]` callouts
- Inject a "Refine" button into rendered callouts
- Style button to be subtle but visible

### Phase 3: Refine Workflow
- On button click, extract context from callout metadata
- Open inline prompt near the callout
- On submit, build refinement prompt with full context
- Replace callout content with new response (preserve metadata for further refinements)

## Technical Considerations

- **Callout detection**: Use `registerMarkdownPostProcessor` to find rendered callouts
- **Context storage**: Embed as HTML comment at end of callout content
- **Button injection**: Add button element to callout's DOM
- **Position tracking**: Need to track callout position for inline prompt placement

## Future Enhancements
- Refinement history / undo
- Quick action buttons ("shorter", "formal", "casual")
- Show diff between versions
- Multiple refinement chains
