# 007: Context Awareness - File and Vault Context

## Status
Completed

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

### Approach: Send File Path Only
Send just the file path with every request. Claude CLI runs locally and can read files if needed. This keeps token usage low while still providing context.

### Context Sent to Claude
```
File: {{filepath}}

Selected text: {{selection or "none"}}

User request: {{command}}
```

### Behavior
1. Every request includes: file path, selection, command
2. Claude knows which file the user is working on
3. Claude CLI can read the file content if needed (runs locally)

## Implementation

Simple approach:
- Pass file path string through the execution chain
- No file content reading, no truncation logic needed
- Claude CLI has filesystem access and can read files on demand

## Example Prompt Structure
```
You are helping edit a file in Obsidian.

File: notes/projects/my-project.md

Selected text: "Task 1"

User request: "expand this task with subtasks"
```

## Future Enhancements
- Vault-wide search context
- Multi-file context (e.g., "compare this with X.md")
- Template variables like `{{filename}}`, `{{filepath}}`
- Configurable context size limit
