# Claude from Obsidian

A lightweight Obsidian plugin for quick inline communication with Claude Shell CLI. Select text, type a command, and get responses directly in your notes.

## Features

- **Inline Prompt**: Floating input appears near your selection - no modal dialogs
- **Non-blocking**: Continue editing while Claude processes your request
- **Visual Feedback**: Processing state shown with styled callouts
- **Simple**: Single session, minimal configuration, just works

## Quick Start

1. Install [Claude CLI](https://docs.anthropic.com/claude/docs/claude-cli) and authenticate
2. Install this plugin
3. Select text → Press `Ctrl+Shift+C` → Type command → Press Enter
4. Done!

## Requirements

**Claude CLI must be installed and authenticated:**

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-cli

# Authenticate
claude auth login
```

## Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/claude-from-obsidian/`
3. Copy the files into that folder
4. Reload Obsidian and enable the plugin

### From Source

```bash
git clone https://github.com/mfranc/claude-from-obsidian
cd claude-from-obsidian
npm install
make publish  # Builds and copies to your vault
```

## Usage

### Basic Workflow

1. **Select text** in your note (optional)
2. Press **`Ctrl+Shift+C`** (Mac: `Cmd+Shift+C`)
3. **Type your command** in the floating prompt
4. Press **Enter** to send (or Escape to cancel)
5. Your text is wrapped in a processing callout while Claude works
6. Response appears as a callout below your original text

### Visual States

The plugin uses native Obsidian callouts for visual feedback:

**Processing:**
```markdown
> [!claude-processing]
> Your selected text here...
```
Shown with animated overlay while Claude is working.

**Response:**
```markdown
> [!claude]
> Claude's response here...
```

**Error:**
```markdown
> [!claude-error]
> Error message here...
```

### Example Use Cases

**Improve Writing:**
1. Select a paragraph
2. `Ctrl+Shift+C` → "Make this more concise"
3. Review the response callout

**Fix Code:**
1. Select code block
2. `Ctrl+Shift+C` → "Fix the bug in this code"
3. Copy the fixed version from the response

**Summarize:**
1. Select long text
2. `Ctrl+Shift+C` → "Summarize in 3 bullet points"

## Configuration

Settings → Claude from Obsidian:

| Setting | Description | Default |
|---------|-------------|---------|
| Working Directory | Where Claude runs commands | `~` |
| Command Timeout | Max wait time (seconds) | 30 |

## Troubleshooting

### "Failed to spawn Claude process"

Claude CLI not installed or not in PATH:
```bash
claude --version  # Should show version
npm install -g @anthropic-ai/claude-cli  # If not installed
```

### "Command timeout"

- Increase timeout in settings
- Check network connection
- Try a simpler command

### Callout styling not working

Make sure you copied `styles.css` to the plugin folder and reloaded Obsidian.

## Development

```bash
# Install dependencies
make install

# Build
make build

# Build and copy to Obsidian
make publish

# Development mode (watch)
make dev
```

### Project Structure

```
src/
├── main.ts                  # Plugin entry point
├── inline-prompt.ts         # Floating input UI
├── default-session-manager.ts # Session management
├── process-manager.ts       # Claude process lifecycle
├── tag-manager.ts           # Callout injection
├── request-manager.ts       # Request queue
├── status-bar-manager.ts    # Status bar UI
├── settings-tab.ts          # Settings page
├── types.ts                 # TypeScript types
├── utils.ts                 # Utilities
└── logger.ts                # Logging
```

### Issue Tracking

This project uses [Beads](https://github.com/beads-project/beads) for issue tracking:

```bash
bd ready              # See open issues
bd create "desc" -t feature  # Create issue
bd close <id> --reason "Done"  # Close issue
```

## Privacy & Security

- Commands are sent only to Claude via the official CLI
- No data sent to external servers
- Session data stored locally in your vault
- Working directory should be chosen carefully

## Alternatives

For advanced features like sidebar chat, agentic tools, or diff preview, check out [Claudian](https://github.com/YishenTu/claudian) - this plugin was inspired by its inline editing approach.

## License

MIT

## Credits

- Built with [Obsidian API](https://docs.obsidian.md/)
- Uses [Claude CLI](https://docs.anthropic.com/claude/docs/claude-cli)
- Inspired by [Claudian](https://github.com/YishenTu/claudian)
- Developed with Claude

## Changelog

### v0.2.0

- Simplified to inline prompt workflow (no modals)
- Single default session (removed multi-session complexity)
- Native Obsidian callouts for processing/response/error states
- Animated processing indicator
- Non-blocking command execution

### v0.1.0

- Initial release with modal-based workflow
- Multiple session management
- Session persistence
