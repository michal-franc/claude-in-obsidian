# Claude from Obsidian

An Obsidian plugin that enables seamless communication with Claude Shell CLI directly from your notes.

## Features

- **Send Text to Claude**: Select any text in your notes and send it to Claude with a custom command
- **Multiple Sessions**: Manage multiple named Claude Shell sessions for different projects or contexts
- **Session Persistence**: Sessions are saved and can be resumed across Obsidian restarts
- **Flexible Response Handling**: Copy, insert at cursor, or replace selected text with Claude's response
- **Keyboard Shortcut**: Quick access with `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)

## Requirements

**Important**: Claude Shell CLI must be installed and authenticated on your system.

1. Install Claude Shell CLI:
   ```bash
   npm install -g @anthropic-ai/claude-cli
   ```

2. Authenticate:
   ```bash
   claude auth login
   ```

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Claude from Obsidian"
4. Click Install
5. Enable the plugin

### Manual Installation

1. Download the latest release from GitHub
2. Extract `main.js` and `manifest.json` to your vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/claude-from-obsidian/
   ```
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Usage

### Basic Workflow

1. **Select text** in your note (optional - you can also send commands without context)
2. Press **`Ctrl+Shift+C`** (or `Cmd+Shift+C` on Mac)
3. **Choose a session**:
   - Select an existing session
   - Or create a new one by clicking "Create New Session"
4. **Enter your command**:
   - E.g., "Improve this text"
   - E.g., "Make it more concise"
   - E.g., "Fix grammar and spelling"
5. **View Claude's response** and choose an action:
   - **Copy**: Copy to clipboard
   - **Insert at Cursor**: Add at current cursor position
   - **Replace Selection**: Replace your selected text

### Creating Sessions

Sessions represent persistent Claude Shell instances with their own conversation context.

1. Click "Create New Session" in the session selector
2. Enter a descriptive name (e.g., "Blog Writing", "Code Assistant")
3. Specify a working directory (default: `~`)
4. The session will maintain conversation context across multiple commands

### Managing Sessions

- **View Sessions**: Open command palette → "Manage Claude sessions"
- **Settings**: Go to Settings → Claude from Obsidian to:
  - Set default working directory
  - Configure command timeout
  - Adjust command history limit
  - Toggle auto-reconnect on startup

### Example Use Cases

#### Blog Post Editing
1. Write a draft paragraph
2. Select the text
3. Ask Claude: "Make this more engaging"
4. Review and insert the improved version

#### Code Documentation
1. Select a code snippet
2. Ask Claude: "Add JSDoc comments to this code"
3. Replace the original with documented version

#### Research Notes
1. Select rough notes
2. Ask Claude: "Organize these notes into bullet points"
3. Insert the structured version below

## Configuration

### Plugin Settings

Access via Settings → Claude from Obsidian:

- **Default Working Directory**: Where new Claude Shell sessions run (default: `~`)
- **Command Timeout**: Maximum wait time for responses in seconds (default: 30)
- **Command History Limit**: Number of commands to keep per session (default: 10)
- **Auto-reconnect Sessions**: Automatically restore sessions on plugin load (default: enabled)

### Keyboard Shortcuts

- **Ask Claude**: `Ctrl+Shift+C` (Mac: `Cmd+Shift+C`)
  - Customize in Settings → Hotkeys → "Ask Claude with selected text"

## Troubleshooting

### "Failed to spawn Claude process"

**Cause**: Claude CLI not installed or not in PATH

**Solution**:
1. Verify installation: `claude --version`
2. If not installed: `npm install -g @anthropic-ai/claude-cli`
3. Restart Obsidian after installation

### "Claude CLI not authenticated"

**Cause**: Not logged in to Claude

**Solution**:
```bash
claude auth login
```

### "Session not running"

**Cause**: Claude process crashed or was terminated externally

**Solution**:
- The plugin will attempt to auto-restart
- Or manually select the session again (it will restart automatically)

### "Command timeout"

**Cause**: Claude is taking longer than configured timeout

**Solution**:
- Increase timeout in Settings → Claude from Obsidian → Command Timeout
- Check your network connection
- Try a simpler command

### Session shows as "Crashed"

**Cause**: Claude process exited unexpectedly

**Solution**:
- Select the session again to restart it automatically
- Check Claude Shell logs for errors
- Verify Claude CLI is working: `claude` in terminal

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-from-obsidian
cd claude-from-obsidian

# Install dependencies
npm install

# Build the plugin
npm run build

# Or run in development mode (watch for changes)
npm run dev
```

### Project Structure

```
src/
├── main.ts                     # Plugin entry point
├── process-manager.ts          # Claude process lifecycle
├── session-manager.ts          # Session tracking & persistence
├── session-selector-modal.ts   # Session selection UI
├── command-input-modal.ts      # Command input UI
├── response-modal.ts           # Response display UI
├── settings-tab.ts             # Settings configuration
├── types.ts                    # TypeScript interfaces
└── utils.ts                    # Utility functions
```

### Issue Tracking

This project uses [Beads](https://github.com/StevenACoffman/bd) for issue tracking.

```bash
# See ready issues
bd ready

# Create a new issue
bd create "Issue description" -t bug|feature|task -p 0-4

# Update issue
bd update <id> --status in_progress

# Complete issue
bd close <id> --reason "Done"
```

## Privacy & Security

- **No data is sent** to external servers except to Claude via the official CLI
- **Session data** (names, directories, command history) is stored locally in your vault
- **Command responses** are not persisted (only command text for history)
- **Working directories** should be chosen carefully to avoid exposing sensitive files

## License

MIT

## Credits

- Built with [Obsidian API](https://docs.obsidian.md/)
- Uses [Claude Shell CLI](https://claude.ai/docs/cli)
- Developed with assistance from Claude Sonnet 4.5

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/claude-from-obsidian/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/claude-from-obsidian/discussions)
- **Documentation**: See [PLAN.md](PLAN.md) for implementation details

## Changelog

### v0.1.0 (Initial Release)

- Basic Claude Shell integration
- Multiple session management
- Session persistence
- Command history
- Response actions (copy/insert/replace)
- Settings configuration
- Keyboard shortcuts
