# Claude Bridge - See Commands in Your Terminal

The Claude Bridge allows you to start a Claude shell in your terminal and send commands to it from Obsidian. You'll see both the commands and responses in your terminal.

## Quick Start

### 1. Start a Bridge Session

In your terminal, navigate to your working directory and run:

```bash
cd /path/to/your/project
/path/to/claude-from-obsidian/scripts/claude-bridge.sh
```

You'll see output like:

```
[claude-bridge] Starting Claude Bridge v1.0.0
[claude-bridge] Session ID: 8f3a9c2e-1b4d-4f2a-9e3c-7d8e5a6b4c1d
[claude-bridge] Working directory: /path/to/your/project
[claude-bridge] Creating named pipes...
[claude-bridge] Session metadata saved
[claude-bridge] Bridge is ready!
[claude-bridge] You can now send commands to this session from Obsidian
[claude-bridge] Starting Claude...
[claude-bridge] Claude started with PID: 12345
```

Claude will then start normally in your terminal.

### 2. Use from Obsidian

1. Open Obsidian
2. Press `Ctrl+Shift+C` (Ask Claude)
3. You'll see your bridge session in the list: "Bridge: /path/to/your/project"
4. Select it and send your command
5. Watch your terminal - you'll see the command arrive and Claude's response!

### 3. Stop the Bridge

When you're done, press `Ctrl+C` in the terminal where the bridge is running. It will clean up automatically.

## How It Works

The bridge creates three named pipes (FIFOs) in `/tmp/`:

- **Input Pipe**: Plugin writes commands here
- **Output Pipe**: Plugin reads responses from here
- **Status Pipe**: Health check

Session metadata is stored in `~/.claude-sessions/{sessionId}.json`

When you send a command from Obsidian:
1. Plugin writes to input pipe
2. Bridge forwards to Claude's stdin
3. Claude processes and outputs
4. Bridge captures output
5. Output goes to BOTH your terminal AND the output pipe
6. Plugin reads from output pipe and shows response in Obsidian

## Features

### Multiple Sessions

You can run multiple bridge sessions simultaneously:

```bash
# Terminal 1 - Project A
cd ~/projects/project-a
/path/to/scripts/claude-bridge.sh

# Terminal 2 - Project B
cd ~/projects/project-b
/path/to/scripts/claude-bridge.sh
```

Both will appear in Obsidian's session list!

### Session Persistence

The bridge maintains Claude's conversation history. All your commands and Claude's responses are part of one continuous conversation.

### Context Support

When you select text in Obsidian and send a command, the text is included as context in the command sent to Claude.

## Installation (Optional)

To use the bridge from anywhere, copy it to your PATH:

```bash
# Copy to local bin
cp scripts/claude-bridge.sh ~/bin/claude-bridge
chmod +x ~/bin/claude-bridge

# Make sure ~/bin is in your PATH
export PATH="$HOME/bin:$PATH"

# Now use it from anywhere
cd ~/my-project
claude-bridge
```

Or create an alias:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias claude-bridge='/path/to/claude-from-obsidian/scripts/claude-bridge.sh'

# Use it
cd ~/my-project
claude-bridge
```

## Troubleshooting

### Bridge session not showing in Obsidian

1. Make sure the bridge is running (`ps aux | grep claude-bridge`)
2. Check that pipes exist (`ls /tmp/claude-bridge-*`)
3. Reload Obsidian plugin (disable & re-enable)

### "Bridge session not running" error

The bridge process has exited. Check your terminal for errors and restart it.

### Commands timeout

Check the Obsidian console (Ctrl+Shift+I) for detailed logs:
- Are pipes being written to?
- Is output being read?
- Any error messages?

### Pipes not cleaning up

If the bridge crashes, pipes might remain in `/tmp/`. Clean them manually:

```bash
rm -f /tmp/claude-bridge-*.{input,output,status}
rm -f ~/.claude-sessions/*.json
```

## Limitations

- **Linux/macOS only**: Named pipes don't work on Windows
- **Terminal required**: You must keep the terminal window open
- **Manual restart**: Bridge sessions can't be restarted from Obsidian - restart them in terminal
- **One-way terminal visibility**: You can't type directly in the Claude terminal - commands must come from Obsidian

## Comparison with Managed Sessions

| Feature | Bridge Session | Managed Session |
|---------|---------------|-----------------|
| See commands in terminal | ✅ Yes | ❌ No |
| See responses in terminal | ✅ Yes | ❌ No |
| Auto-start from plugin | ❌ No | ✅ Yes |
| Works on Windows | ❌ No | ✅ Yes |
| Terminal required | ✅ Yes | ❌ No |
| Restart from plugin | ❌ No | ✅ Yes |

## Tips

1. **Use tmux/screen**: Run bridge in a tmux session so you can detach and reattach
2. **Multiple projects**: Run one bridge per project directory for better organization
3. **Check logs**: Keep the terminal visible to see what's happening
4. **Test first**: Try a simple "say hello" command before complex ones

## Examples

### Example 1: Code Review

```bash
# Terminal
cd ~/my-app/src
claude-bridge
```

In Obsidian:
1. Open a code file
2. Select a function
3. Press Ctrl+Shift+C
4. Select "Bridge: ~/my-app/src"
5. Enter: "Review this function for bugs"
6. Watch your terminal - you'll see Claude analyzing the code!

### Example 2: Writing Help

```bash
# Terminal
cd ~/documents/blog
claude-bridge
```

In Obsidian:
1. Write a draft paragraph
2. Select it
3. Press Ctrl+Shift+C
4. Select "Bridge: ~/documents/blog"
5. Enter: "Improve this paragraph"
6. See Claude's suggestions appear in your terminal and Obsidian!

## Feedback

If you encounter issues or have suggestions for the bridge, please file an issue on GitHub.
