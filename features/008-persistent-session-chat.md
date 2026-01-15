# 008: Persistent Session with Direct Chat

## Status
Draft

## Context
Currently, the plugin spawns a fresh Claude process for each command (one-shot model). Users lose conversation context between requests and cannot have an ongoing dialogue with Claude.

Users want to:
- Reuse the same Claude process session across multiple interactions
- Write directly to the chat without going through the inline prompt
- Maintain conversation history within a session
- Have a more interactive, conversational experience

## Decision

### Approach: Persistent Process with Chat Panel

Keep a Claude process running and provide a dedicated chat interface to interact with it directly.

### Core Components

1. **Persistent Process Manager**
   - Keep Claude process alive between commands
   - Manage stdin/stdout streams for ongoing communication
   - Handle process lifecycle (start, keep-alive, terminate)

2. **Chat Panel UI**
   - Side panel or modal for direct chat interaction
   - Show conversation history
   - Input field to send messages directly to the session
   - Clear visual distinction from inline document responses

### Behavior
1. **Start Session** → Launch Claude process, keep it running
2. **Open Chat** → Show chat panel with session history
3. **Send Message** → Write directly to Claude's stdin
4. **Receive Response** → Display in chat panel (not in document)
5. **End Session** → Terminate process, clear history

### Integration with Existing Features
- Inline commands (`Cmd+Shift+C`) can optionally use the persistent session
- Chat panel provides direct access to the same session
- Session context is shared between inline and chat interactions

## Implementation Plan

### Phase 1: Persistent Process
- Modify `ClaudeProcess` to support long-running mode
- Handle ongoing stdin/stdout communication (not close after each command)
- Add session keepalive and health checks

### Phase 2: Chat Panel UI
- Create Obsidian view for chat panel
- Display message history (user messages + Claude responses)
- Input field with send functionality
- Session status indicator

### Phase 3: Stream Integration
- Parse Claude's streaming output to detect response boundaries
- Handle multi-turn conversation state
- Manage response buffering and display

## Technical Considerations

- **Response boundaries**: Need to detect when Claude finishes responding (may need sentinel or timeout)
- **Process health**: Monitor process and restart if it crashes
- **Memory**: Long sessions may accumulate context; consider session reset option
- **Concurrency**: Coordinate between chat panel and inline commands using same session

## Open Questions

- Should the chat panel be a sidebar view or a modal?
- How to handle very long conversations (memory/context limits)?
- Should users be able to have multiple named sessions?

## Future Enhancements
- Multiple concurrent sessions with different contexts
- Session persistence (save/restore conversation history)
- Export chat history to note
- Session templates with pre-configured system prompts
