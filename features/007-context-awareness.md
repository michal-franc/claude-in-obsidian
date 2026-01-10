# 007: Context Awareness - File and Vault Context

## Status
Future

## Context
Currently, Claude only receives the selected text and the user's command. It has no knowledge of:
- Which file the user is working in
- The file's content beyond the selection
- The vault structure or other related files

Users want to:
- Ask questions like "summarize this file" without selecting everything
- Reference the current file naturally (e.g., "fix the imports in this file")
- Potentially reference other files in the vault

## Decision
TBD - Needs design discussion

### Possible Context Levels

1. **Current File Context**
   - File name and path
   - Full file content (or surrounding context)
   - File metadata (frontmatter, tags)

2. **Vault Context** (future)
   - Vault name
   - Related files (backlinks, outlinks)
   - Folder structure

### Possible Implementation Approaches

**Option A: Always Include File Context**
- Always send file name + full content with every request
- Pros: Simple, always available
- Cons: Token usage, may be unnecessary for simple edits

**Option B: On-Demand Context**
- User explicitly requests context (e.g., checkbox in prompt)
- Pros: Efficient, user control
- Cons: Extra step for user

**Option C: Smart Context Detection**
- Detect when user references "this file", "the document", etc.
- Automatically include file context
- Pros: Natural UX
- Cons: Complex detection, may miss cases

### Example Use Cases

```
"Summarize this file"
→ Claude receives: file path, full content, command

"Fix the TypeScript errors in this file"
→ Claude receives: file path, full content, command

"What's the main topic of this note?"
→ Claude receives: file path, full content, command

"Add a table of contents based on the headings"
→ Claude receives: file path, full content, command
```

## Open Questions

1. How much context to include by default?
2. Token limits - what if file is very large?
3. Should vault-level context be separate feature?
4. How to handle binary files or unsupported formats?

## Future Enhancements
- Vault-wide search context
- Multi-file context (e.g., "compare this with X.md")
- Template variables like `{{filename}}`, `{{filepath}}`, `{{filecontent}}`
