#!/bin/bash
# Cleanup after e2e tests - removes test vault from Obsidian config
# Usage: ./cleanup.sh

echo "=== Cleaning up e2e test environment ==="

# Kill Obsidian
echo "Closing Obsidian..."
pkill -9 obsidian 2>/dev/null || true
sleep 1

# Remove test vault from Obsidian config
echo "Removing test vault from Obsidian config..."
python3 << 'EOF'
import json
import hashlib

config_path = "/home/mfranc/.config/obsidian/obsidian.json"
test_vault_path = "/home/mfranc/Work/claude-from-obsidian/tests/e2e/testvault"

vault_id = hashlib.md5(test_vault_path.encode()).hexdigest()[:16]

with open(config_path, 'r') as f:
    config = json.load(f)

if vault_id in config['vaults']:
    del config['vaults'][vault_id]
    print(f"Removed vault: {vault_id}")
else:
    print("Test vault not found in config")

with open(config_path, 'w') as f:
    json.dump(config, f)
EOF

# Remove backup if exists
rm -f ~/.config/obsidian/obsidian.json.backup

echo "✅ Cleanup complete"
