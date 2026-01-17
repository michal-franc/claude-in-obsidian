#!/bin/bash
# Start Obsidian with test vault on workspace 5 (claude-agents)
# Usage: ./start-obsidian.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VAULT_PATH="$REPO_ROOT/tests/e2e/testvault"

echo "=== Starting Obsidian with test vault ==="
echo "Vault: $VAULT_PATH"

# Kill any existing Obsidian instances
echo "Closing existing Obsidian instances..."
# Use -x for exact match to avoid killing scripts with 'obsidian' in path
pkill -9 -x obsidian 2>/dev/null || true
sleep 2

# Deploy plugin first
echo "Deploying plugin..."
"$SCRIPT_DIR/deploy-plugin.sh" "$VAULT_PATH"

# Register test vault in Obsidian config
echo "Registering test vault..."
python3 << EOF
import json
import hashlib

config_path = "/home/mfranc/.config/obsidian/obsidian.json"
test_vault_path = "$VAULT_PATH"

vault_id = hashlib.md5(test_vault_path.encode()).hexdigest()[:16]

with open(config_path, 'r') as f:
    config = json.load(f)

# Close all other vaults
for vid in config['vaults']:
    config['vaults'][vid]['open'] = False

# Add/update test vault
config['vaults'][vault_id] = {
    "path": test_vault_path,
    "ts": 1765047329770,
    "open": True
}

with open(config_path, 'w') as f:
    json.dump(config, f)

print(f"  Vault registered: {vault_id}")
EOF

# Switch to workspace 5 and launch Obsidian
echo "Launching Obsidian on workspace '5: claude-agents'..."
i3-msg 'workspace "5: claude-agents"'

# Launch Obsidian with vault URI
nohup obsidian --no-sandbox "obsidian://open?vault=testvault" > /tmp/obsidian.log 2>&1 &

# Wait for Obsidian to start
echo "Waiting for Obsidian to start..."
for i in {1..10}; do
    sleep 1
    if xdotool search --name "testvault" &>/dev/null || xdotool search --name "Obsidian" &>/dev/null; then
        echo "✅ Obsidian started"
        break
    fi
    echo "  Waiting... ($i/10)"
done

if ! pgrep obsidian &>/dev/null; then
    echo "❌ Failed to start Obsidian"
    echo "Log:"
    cat /tmp/obsidian.log
    exit 1
fi

echo ""
echo "=== Obsidian ready on workspace '5: claude-agents' ==="
echo ""
echo "Next steps:"
echo "1. Enable the plugin if first time (Settings → Community plugins)"
echo "2. Run tests: ./tests/e2e/scripts/run-test.sh uppercase 'make this uppercase' 'HELLO'"
echo ""
echo "To cleanup after testing: ./tests/e2e/scripts/cleanup.sh"
