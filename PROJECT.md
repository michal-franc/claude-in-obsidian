# Project Documentation: Claude from Obsidian

## Project Genesis

This document captures the conversation history and key decisions made during the planning phase of the Claude from Obsidian plugin.

**Date:** January 8, 2026
**Project:** Obsidian Plugin for Claude Shell Integration
**Goal:** Enable seamless communication between Obsidian editor and Claude Shell CLI

---

## Initial Requirements

The user wanted to create an Obsidian plugin with the following features:

### Core Feature
> "As a user inside obsidian I can use shortcut to open up a modal that will enable me to write a command that will be sent to locally running claude shell on my machine. This command is then executed and results are send back to obsidian."

### Primary Use Case
> "When writing text, or blog posts, I can select text and ask claude to improve / change it"

---

## Architectural Decision Process

### Question 1: Communication Method

**Claude Asked:** "How should the Obsidian plugin communicate with the locally running Claude Shell?"

**Options Presented:**
1. Execute Claude CLI commands (spawn processes) - Simple, uses standard CLI
2. HTTP API/WebSocket connection - Requires Claude Shell to expose API
3. File-based communication - Requires file watchers

**User's Choice:** Option 1 (Execute Claude CLI commands)

**User's Follow-up Concern:**
> "i like option one but then how we will ensure the context is saved somehow so that we dont spawn new session each time?"

**Resolution:** Use long-running Claude Shell processes with persistent stdin/stdout pipes to maintain conversation context across multiple commands.

### Question 2: Response Handling

**Claude Asked:** "What should happen with Claude's response in Obsidian?"

**Options Presented:**
1. Replace selected text - Direct replacement
2. Insert response below selection - Keep original
3. Show in modal dialog - Review before applying
4. Create new note with response - Keep separate

**User's Choice:** Show in modal dialog

**Rationale:** This is non-destructive and gives users control. The modal will include action buttons to copy, insert, or replace as needed.

### Question 3: Context Preservation

**Claude Asked:** "How should we maintain conversation context when communicating with Claude Shell?"

**Options Presented:**
1. Long-running shell session - Keep process alive, automatic context
2. Session ID/conversation tracking - Requires Claude Shell support
3. Fresh context each time - No persistence, simpler

**User's Choice:** Long-running shell session

**User's Additional Requirement:**
> "ok i like idea number 1 but then i want the user to be asked to spawn new session or reuse existing one - for instance if user already has shells running he can decide to connect to it - does it make sense?"

**Agreed Implementation:**
- Maintain background Claude Shell processes
- Let users choose: connect to existing session OR start new session
- Support multiple named sessions (e.g., "Blog Writing", "Code Assistant", "Research")
- Each session maintains its own conversation context

### Question 4: Session Discovery

**Claude Asked:** "How should the plugin discover and connect to existing Claude Shell sessions?"

**Options Presented:**
1. Auto-detect running processes - Scan process list, simple
2. Socket/IPC-based discovery - Requires Claude Shell support
3. Manual port/connection config - Flexible but manual

**User's Choice:** Auto-detect running processes

**Implementation Decision:**
- Plugin spawns and manages its own Claude Shell processes
- Cannot attach to arbitrary external processes (only plugin-managed ones)
- Track processes by PID stored in session metadata
- On startup, verify PIDs still exist and belong to `claude` processes

---

## Key Technical Decisions

### Session Management Strategy

**Chosen Approach:**
- Store session metadata in `<plugin-data-dir>/sessions.json`
- Each session has: ID, name, working directory, PID, status, creation time
- Track status: active, stopped, crashed
- On plugin load, check if PIDs are still running
- Mark crashed sessions and allow restart

### Process Communication Protocol

**Chosen Approach:**
- Spawn: `child_process.spawn('claude', [], { cwd: workingDir, stdio: ['pipe', 'pipe', 'pipe'] })`
- Keep stdin/stdout/stderr pipes open
- Write commands to stdin
- Buffer stdout until prompt detected
- Parse and return response

### UI Workflow

**User Flow:**
1. User selects text in Obsidian editor
2. User presses Ctrl+Shift+C (or runs "Ask Claude" command)
3. Session Selector Modal opens showing available sessions
4. User selects existing session OR creates new one
5. Command Input Modal opens with selected text shown
6. User enters command/prompt
7. Response Modal opens with loading indicator
8. Claude's response is displayed
9. User can: Copy, Insert at Cursor, or Replace Selection

---

## Project Structure

### File Organization
```
/home/mfranc/Work/claude-from-obsidian/
├── src/
│   ├── main.ts                     # Plugin entry point
│   ├── process-manager.ts          # Process lifecycle
│   ├── session-manager.ts          # Session tracking
│   ├── session-selector-modal.ts   # Session UI
│   ├── command-input-modal.ts      # Command UI
│   ├── response-modal.ts           # Response UI
│   ├── types.ts                    # TypeScript types
│   └── utils.ts                    # Utilities
├── manifest.json                   # Obsidian plugin metadata
├── package.json                    # npm configuration
├── tsconfig.json                   # TypeScript config
├── esbuild.config.mjs              # Build config
├── README.md                       # User documentation
├── PLAN.md                         # Implementation plan
├── PROJECT.md                      # This file
├── CLAUDE.md                       # Project overview
└── ISSUETRACKING.md               # Beads workflow
```

### Core Components

1. **Process Manager** - Spawns and manages Claude Shell processes
2. **Session Manager** - Tracks session metadata and persistence
3. **UI Modals** - Session selector, command input, response display
4. **Main Plugin** - Coordinates workflow and registers commands

---

## Implementation Tracking

**Tool:** Beads (bd)
**Location:** See ISSUETRACKING.md for workflow

Implementation is divided into 10 phases:

1. **Phase 1:** Project Setup - Configuration files and directory structure
2. **Phase 2:** Type Definitions - TypeScript interfaces and utilities
3. **Phase 3:** Process Management - Claude process spawning and communication
4. **Phase 4:** Session Management - Session tracking and persistence
5. **Phase 5:** UI - Session Selection - Modals for session management
6. **Phase 6:** UI - Command & Response - Input and output modals
7. **Phase 7:** Plugin Integration - Main plugin class and workflow
8. **Phase 8:** Polish & Error Handling - Robustness and UX
9. **Phase 9:** Documentation - README and inline docs
10. **Phase 10:** Testing - Comprehensive testing

Each phase is tracked as a Beads issue. Use `bd ready --json` to see available work.

---

## Security Considerations

### Command Injection Prevention
- Never use `shell: true` in spawn options
- Pass commands via stdin, not as shell arguments
- User commands cannot execute arbitrary shell commands

### Process Isolation
- User specifies working directory (not defaulted to vault)
- Claude process isolated from vault data
- Document security implications in README

### Data Privacy
- Don't store command responses in session history
- Limit command history to last N commands
- Provide option to clear history

---

## Future Enhancements (Not v0.1.0)

These were discussed but are out of scope for initial release:

1. Streaming responses (show Claude typing in real-time)
2. Session sharing (export/import configurations)
3. Command templates (saved prompts)
4. Full conversation history persistence
5. Model selection (choose different Claude models)
6. Batch processing (multiple selections at once)
7. Canvas integration
8. Inline editing (without modal)
9. Voice input
10. Multi-language support

---

## Notes & Observations

### User's Request for Documentation
> "can you also write down in PROJECT.md our conversation and choices we have made"

This document fulfills that request, capturing the decision-making process and rationale.

### User's Request for Issue Tracking
> "and also remember about ISSUETRACKING.md to use BEADS for implementation so we have memory of the progress in external bank"

Beads issues are being created for each implementation phase to track progress persistently.

---

## Next Steps

1. ✅ Plan created and documented
2. ✅ PLAN.md saved to project root
3. ✅ PROJECT.md created with conversation history
4. ⏳ Create Beads issues for all phases
5. ⏳ Begin Phase 1: Project Setup

---

**Plan Approved:** January 8, 2026
**Implementation Start:** Pending Beads issue creation
