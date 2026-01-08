# Implementation Plan: Claude from Obsidian Plugin

## Project Overview

This is a greenfield Obsidian plugin that enables seamless communication between Obsidian and the Claude Shell CLI running locally.

**Core Goal:** Allow users to select text in Obsidian, send it to Claude Shell with commands/prompts, and receive responses back in Obsidian.

**Primary Use Case:** While writing blog posts or taking notes, select text and ask Claude to improve, expand, or modify it.

---

## Conversation Summary & Architectural Decisions

### Decision 1: Communication Method

**Question:** How should the Obsidian plugin communicate with the locally running Claude Shell?

**Options Considered:**
1. Execute Claude CLI commands (spawn processes)
2. HTTP API/WebSocket connection
3. File-based communication

**Choice:** Execute Claude CLI commands ✓

**User's Concern:** "How will we ensure the context is saved so we don't spawn a new session each time?"

**Resolution:** Use long-running Claude Shell processes with persistent stdin/stdout pipes to maintain conversation context.

### Decision 2: Response Handling

**Question:** What should happen with Claude's response in Obsidian?

**Options Considered:**
1. Replace selected text
2. Insert response below selection
3. Show in modal dialog
4. Create new note with response

**Choice:** Show in modal dialog ✓

**Rationale:** Non-destructive approach that gives users control. Modal will include options to copy, insert at cursor, or replace selection.

### Decision 3: Context Preservation

**Question:** How should we maintain conversation context when communicating with Claude Shell?

**Options Considered:**
1. Long-running shell session (keep process alive)
2. Session ID/conversation tracking via CLI args
3. Fresh context each time (new process per command)

**Choice:** Long-running shell session ✓

**User's Addition:** "I want the user to be asked to spawn new session or reuse existing one - if user already has shells running they can decide to connect to it."

**Implementation:**
- Maintain background Claude Shell processes with open stdin/stdout pipes
- Let users choose between existing sessions or create new ones
- Support multiple named sessions for different contexts/projects

### Decision 4: Session Discovery

**Question:** How should the plugin discover and connect to existing Claude Shell sessions?

**Options Considered:**
1. Auto-detect running processes (scan process list)
2. Socket/IPC-based discovery (requires Claude Shell support)
3. Manual port/connection configuration

**Choice:** Auto-detect running processes ✓

**Implementation Details:**
- Plugin will spawn and manage its own Claude Shell processes
- Track processes by PID stored in session metadata
- On startup, check if PIDs still exist and belong to `claude` processes
- Cannot connect to arbitrary external Claude processes (only plugin-managed ones)
- Users select from list of plugin-managed sessions

---

## Technical Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────┐
│                  Obsidian Plugin                    │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │    Main      │  │    UI Layer                 │ │
│  │   Plugin     │  │  - Session Selector Modal   │ │
│  │              │  │  - Command Input Modal      │ │
│  │  - Commands  │  │  - Response Modal           │ │
│  │  - Workflow  │  │  - New Session Modal        │ │
│  └──────┬───────┘  └─────────────────────────────┘ │
│         │                                            │
│  ┌──────▼──────────────────────────────────────┐   │
│  │      Session Manager                        │   │
│  │  - Session CRUD                             │   │
│  │  - Persistence (sessions.json)              │   │
│  │  - Session detection & recovery             │   │
│  └──────┬──────────────────────────────────────┘   │
│         │                                            │
│  ┌──────▼──────────────────────────────────────┐   │
│  │      Process Manager                        │   │
│  │  - Spawn Claude Shell processes             │   │
│  │  - Maintain stdin/stdout pipes              │   │
│  │  - Command queueing & timeout               │   │
│  │  - Crash detection & recovery               │   │
│  └──────┬──────────────────────────────────────┘   │
│         │                                            │
└─────────┼────────────────────────────────────────────┘
          │
   ┌──────▼────────┐
   │ Claude Shell  │ (Background Process)
   │   Process     │
   │               │
   │  - stdin pipe │
   │  - stdout pipe│
   │  - stderr pipe│
   └───────────────┘
```

### Project File Structure

```
/home/mfranc/Work/claude-from-obsidian/
├── src/
│   ├── main.ts                     # Plugin entry point & workflow coordinator
│   ├── process-manager.ts          # Claude process lifecycle management
│   ├── session-manager.ts          # Session tracking & persistence
│   ├── session-selector-modal.ts   # UI: Choose/create sessions
│   ├── command-input-modal.ts      # UI: Enter command with context
│   ├── response-modal.ts           # UI: Display Claude's response
│   ├── types.ts                    # TypeScript interfaces & types
│   └── utils.ts                    # Utility functions
├── manifest.json                   # Obsidian plugin metadata
├── package.json                    # npm dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── esbuild.config.mjs              # Build configuration
├── .gitignore                      # Git ignore patterns
├── styles.css                      # Plugin styling (optional)
├── README.md                       # Plugin documentation
├── PLAN.md                         # This file - implementation plan
├── PROJECT.md                      # Conversation history and decisions
├── CLAUDE.md                       # Project documentation (existing)
└── ISSUETRACKING.md               # Beads workflow (existing)
```

---

## Implementation Phases

See detailed breakdown of all 10 phases in sections below. Each phase will be tracked as a Beads issue.

### Phase 1: Project Setup
- Create configuration files (package.json, tsconfig.json, etc.)
- Create src/ directory structure
- Install dependencies
- Verify build works

### Phase 2: Type Definitions
- Define TypeScript interfaces in src/types.ts
- Define utility functions in src/utils.ts

### Phase 3: Process Management
- Implement ClaudeProcess class
- Implement ClaudeProcessManager class
- Implement command-response protocol

### Phase 4: Session Management
- Implement SessionManager class
- Implement session persistence
- Implement session detection

### Phase 5: UI - Session Selection
- Implement SessionSelectorModal
- Implement NewSessionModal

### Phase 6: UI - Command & Response
- Implement CommandInputModal
- Implement ResponseModal

### Phase 7: Plugin Integration
- Implement main plugin class
- Wire up complete workflow
- Register commands

### Phase 8: Polish & Error Handling
- Add comprehensive error handling
- Implement crash recovery
- Add settings page

### Phase 9: Documentation
- Write README.md
- Add inline documentation
- Create usage examples

### Phase 10: Testing
- Manual test all workflows
- Test edge cases
- Performance testing

---

## Critical Files

1. **src/process-manager.ts** - Core process communication logic
2. **src/session-manager.ts** - Session lifecycle and persistence
3. **src/main.ts** - Plugin entry point and workflow coordination
4. **src/session-selector-modal.ts** - First UI touchpoint
5. **src/types.ts** - Type definitions for entire codebase

---

## Success Criteria

1. ✅ User can install plugin in Obsidian
2. ✅ User can create named Claude Shell sessions
3. ✅ User can select text in editor
4. ✅ User can run "Ask Claude" command (Ctrl+Shift+C)
5. ✅ User can choose from existing sessions or create new one
6. ✅ User can enter command/prompt in modal
7. ✅ Selected text + command is sent to Claude Shell
8. ✅ Claude's response appears in modal
9. ✅ User can copy, insert at cursor, or replace selection with response
10. ✅ Sessions persist across Obsidian restarts
11. ✅ Multiple sessions can coexist independently
12. ✅ Crashed sessions are detected and can be restarted
13. ✅ Plugin cleans up processes on unload
14. ✅ Error messages are clear and helpful
15. ✅ README documentation is complete

---

For complete details on each phase, architecture, technical challenges, and security considerations, see the full plan file.
