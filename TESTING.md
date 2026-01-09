# Testing Guide

This document provides a comprehensive testing checklist for the Claude from Obsidian plugin.

## Prerequisites

Before testing:
- ✅ Claude CLI installed: `npm install -g @anthropic-ai/claude-cli`
- ✅ Claude CLI authenticated: `claude auth login`
- ✅ Plugin built successfully: `npm run build`
- ✅ Plugin installed in Obsidian vault

## Installation & Setup Tests

### Test 1: Plugin Installation
- [x] Plugin files exist in `.obsidian/plugins/claude-from-obsidian/`
- [x] `main.js` and `manifest.json` present
- [x] Plugin appears in Obsidian Settings → Community Plugins
- [x] Plugin can be enabled without errors

### Test 2: Plugin Load
- [ ] Console shows "Loading Claude from Obsidian plugin"
- [ ] No error messages in console on load
- [ ] Settings tab appears in Obsidian Settings
- [ ] Commands appear in command palette

## Session Management Tests

### Test 3: Create New Session
- [ ] Open "Ask Claude" command (Ctrl+Shift+C)
- [ ] Click "Create New Session"
- [ ] Enter session name: "Test Session"
- [ ] Enter working directory: `~`
- [ ] Session creates successfully
- [ ] No error notices

### Test 4: Session Persistence
- [ ] Create a session
- [ ] Close and reopen Obsidian
- [ ] Open "Ask Claude" command
- [ ] Previously created session appears in list
- [ ] Session shows correct status (stopped after restart)

### Test 5: Multiple Sessions
- [ ] Create 3 different sessions with different names
- [ ] All 3 sessions appear in session selector
- [ ] Each session shows correct working directory
- [ ] Sessions have different IDs

### Test 6: Invalid Directory Handling
- [ ] Try to create session with empty directory
- [ ] Error message shown
- [ ] Session not created

## Command Execution Tests

### Test 7: Command Without Selection
- [ ] Open "Ask Claude" without selecting text
- [ ] Choose/create a session
- [ ] Enter command: "Say hello"
- [ ] Response modal shows loading state
- [ ] Response appears (if Claude CLI works)
- [ ] No errors in console

### Test 8: Command With Selection
- [ ] Type "This is a test paragraph."
- [ ] Select the text
- [ ] Run "Ask Claude" command
- [ ] Choose a session
- [ ] Enter command: "Improve this"
- [ ] Response modal shows loading state
- [ ] Response appears with improvement
- [ ] Selected text was sent as context

### Test 9: Long Text Selection
- [ ] Create a paragraph with >500 characters
- [ ] Select all text
- [ ] Run "Ask Claude" command
- [ ] Command input modal shows truncated text
- [ ] "Show full text" button appears
- [ ] Clicking button expands full text
- [ ] Full text is sent as context

### Test 10: Command Timeout
- [ ] Adjust timeout to 5 seconds in settings
- [ ] Ask a complex question that might take >5s
- [ ] Verify timeout error shown
- [ ] Error message is user-friendly

## Response Handling Tests

### Test 11: Copy Response
- [ ] Execute a command successfully
- [ ] Click "Copy" button
- [ ] Paste clipboard content
- [ ] Clipboard contains response text
- [ ] Success notice shown

### Test 12: Insert at Cursor
- [ ] Position cursor in middle of text
- [ ] Execute command
- [ ] Click "Insert at Cursor"
- [ ] Response inserted at cursor position
- [ ] Original text preserved
- [ ] Success notice shown
- [ ] Modal closes

### Test 13: Replace Selection
- [ ] Select some text
- [ ] Execute command with selection
- [ ] Click "Replace Selection"
- [ ] Selected text replaced with response
- [ ] Success notice shown
- [ ] Modal closes

## Error Handling Tests

### Test 14: Claude CLI Not Installed
- [ ] Temporarily rename `claude` binary (or modify PATH)
- [ ] Try to create a session
- [ ] Error shown: "Failed to spawn Claude process"
- [ ] Helpful error message displayed

### Test 15: Claude Not Authenticated
- [ ] Log out: `claude auth logout`
- [ ] Try to execute a command
- [ ] Auth error caught and displayed
- [ ] Re-authenticate: `claude auth login`

### Test 16: Process Crash During Command
- [ ] Start a command
- [ ] Kill Claude process: `pkill -f claude`
- [ ] Error shown in response modal
- [ ] Session marked as crashed
- [ ] Can restart session

### Test 17: Empty Command
- [ ] Open command input modal
- [ ] Leave command field empty
- [ ] Try to submit
- [ ] Validation prevents submission

### Test 18: Session Not Running
- [ ] Create a session
- [ ] Kill the process externally
- [ ] Try to use the session
- [ ] Auto-restart attempted
- [ ] Command executes after restart

## Session Management UI Tests

### Test 19: View Sessions Command
- [ ] Run "Manage Claude sessions" from command palette
- [ ] Notice displays all sessions
- [ ] Shows session names, status, directories
- [ ] Shows command count per session

### Test 20: Settings Page
- [ ] Open Settings → Claude from Obsidian
- [ ] All settings visible
- [ ] Active session count displayed
- [ ] Can change default working directory
- [ ] Can change timeout
- [ ] Can change history limit
- [ ] Can toggle auto-reconnect
- [ ] Settings persist after Obsidian restart

### Test 21: Clear History
- [ ] Execute several commands in a session
- [ ] Go to settings
- [ ] Click "Clear History"
- [ ] Confirm command history cleared
- [ ] Sessions still exist

## Edge Cases Tests

### Test 22: Very Long Command
- [ ] Enter a command >1000 characters
- [ ] Command submits successfully
- [ ] Response received (if applicable)

### Test 23: Special Characters
- [ ] Select text with special characters: `!@#$%^&*()`
- [ ] Execute command
- [ ] Special characters preserved
- [ ] No encoding issues

### Test 24: Multiple Concurrent Commands
- [ ] Try to execute 2 commands simultaneously on same session
- [ ] Second command should wait or error appropriately
- [ ] No race conditions

### Test 25: Session Name Collision
- [ ] Create session "Test"
- [ ] Try to create another "Test"
- [ ] System handles collision (generates unique ID)

## Performance Tests

### Test 26: Plugin Load Time
- [ ] Restart Obsidian
- [ ] Plugin loads in <1 second
- [ ] No noticeable UI lag

### Test 27: Large Session List
- [ ] Create 10+ sessions
- [ ] Session selector opens quickly
- [ ] List scrolls smoothly
- [ ] No performance degradation

### Test 28: Memory Leaks
- [ ] Use plugin for extended period
- [ ] Execute 20+ commands
- [ ] Close Obsidian
- [ ] All processes terminated
- [ ] No orphaned Claude processes: `ps aux | grep claude`

## UI/UX Tests

### Test 29: Modal Behavior
- [ ] All modals can be closed with ESC key
- [ ] Clicking outside modal doesn't close it (standard behavior)
- [ ] Modal content is readable
- [ ] Buttons are clearly labeled

### Test 30: Keyboard Shortcuts
- [ ] Ctrl+Shift+C opens Ask Claude
- [ ] Ctrl+Enter submits command in input modal
- [ ] ESC closes modals
- [ ] Custom hotkeys work if configured

### Test 31: Status Badges
- [ ] Active sessions show green "● Active"
- [ ] Stopped sessions show gray "○ Stopped"
- [ ] Crashed sessions show red "⚠ Crashed"
- [ ] Colors match Obsidian theme

### Test 32: Responsive Design
- [ ] Modals fit on smaller screens
- [ ] Text doesn't overflow containers
- [ ] Buttons remain accessible

## Integration Tests

### Test 33: Markdown Compatibility
- [ ] Select text in markdown heading
- [ ] Execute command
- [ ] Replacement preserves markdown syntax

### Test 34: Multi-line Selection
- [ ] Select multiple paragraphs
- [ ] Execute command
- [ ] All paragraphs sent as context
- [ ] Response formatting correct

### Test 35: Different File Types
- [ ] Test in .md files
- [ ] Test in Canvas (if supported)
- [ ] Plugin works consistently

## Regression Tests

Run these after any code changes:

- [ ] All basic workflow tests (3, 7, 8, 12, 13)
- [ ] Session persistence (4)
- [ ] Error handling (14, 16, 18)
- [ ] Settings functionality (20)
- [ ] No new console errors

## Success Criteria

All tests must pass before v0.1.0 release:

✅ **Critical (Must Pass)**
- [ ] Plugin loads without errors
- [ ] Can create sessions
- [ ] Can execute commands with responses
- [ ] Sessions persist across restarts
- [ ] Response actions work (copy/insert/replace)
- [ ] No memory leaks
- [ ] No orphaned processes

⚠️ **Important (Should Pass)**
- [ ] Error messages are clear
- [ ] Timeout handling works
- [ ] Crash recovery works
- [ ] Settings page functional

📝 **Nice to Have (May Defer)**
- [ ] All edge cases covered
- [ ] Performance optimal
- [ ] UI polish complete

## Known Limitations

Document any known issues discovered during testing:

1. **Claude CLI Required**: Plugin will not work without Claude CLI installed and authenticated
2. **Desktop Only**: Plugin uses Node.js child_process, not available in mobile Obsidian
3. **Process Detection**: Can only detect plugin-managed processes, not external Claude instances
4. **Response Parsing**: Simple prompt detection may not work perfectly for all Claude responses

## Testing Tools

- **Console**: Chrome DevTools (Ctrl+Shift+I in Obsidian)
- **Process Monitor**: `ps aux | grep claude`
- **Session Data**: Check `.obsidian/plugins/claude-from-obsidian/sessions.json`
- **Logs**: Obsidian console and Claude Shell stderr

## Reporting Issues

When reporting bugs, include:
1. Obsidian version
2. Plugin version
3. Claude CLI version: `claude --version`
4. Operating system
5. Steps to reproduce
6. Console error messages
7. Session data (if relevant)
