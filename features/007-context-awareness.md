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

### Approach: Always Include File Context
Always send file context with every request. Simple and predictable - Claude always knows about the current file.

### Context Sent to Claude
```
File: {{filepath}}
---
{{file content}}
---

Selected text: {{selection or "none"}}

User request: {{command}}
```

### Behavior
1. Every request includes: file path, full file content, selection, command
2. Claude can reference any part of the file
3. User can ask "summarize this file", "fix imports", etc.

### Large File Handling
- If file > 50KB, truncate with note: `[File truncated - showing first 50KB]`
- Selection is always included in full

## Implementation Plan

### Phase 1: Pass File Context
- Modify `executeCommand` to read full file content
- Update prompt structure to include file path and content
- Pass context to Claude via session manager

### Phase 2: Update Prompt Format
- Structure prompt clearly with file context section
- Ensure selection is highlighted within context
- Add file path for reference

## Example Prompt Structure
```
You are helping edit a file in Obsidian.

File: notes/projects/my-project.md
---
# My Project

## Overview
This is my project description.

## Tasks
- Task 1
- Task 2
---

Selected text: "Task 1"

User request: "expand this task with subtasks"
```

## Future Enhancements
- Vault-wide search context
- Multi-file context (e.g., "compare this with X.md")
- Template variables like `{{filename}}`, `{{filepath}}`
- Configurable context size limit
