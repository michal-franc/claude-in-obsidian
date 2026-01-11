#!/bin/bash
# Deploy plugin to test vault
# Usage: ./deploy-plugin.sh [vault-path]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEFAULT_VAULT="$REPO_ROOT/tests/e2e/testvault"
VAULT_PATH="${1:-$DEFAULT_VAULT}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/claude-from-obsidian"

echo "=== Deploying plugin to test vault ==="
echo "Repo: $REPO_ROOT"
echo "Vault: $VAULT_PATH"
echo "Plugin dir: $PLUGIN_DIR"

# Build plugin
echo ""
echo "Building plugin..."
cd "$REPO_ROOT"
npm run build

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
echo "Copying plugin files..."
cp "$REPO_ROOT/main.js" "$PLUGIN_DIR/"
cp "$REPO_ROOT/manifest.json" "$PLUGIN_DIR/"
cp "$REPO_ROOT/styles.css" "$PLUGIN_DIR/" 2>/dev/null || true

echo ""
echo "✅ Plugin deployed to: $PLUGIN_DIR"
echo ""
echo "To use this vault:"
echo "1. Open Obsidian"
echo "2. Open vault: $VAULT_PATH"
echo "3. Enable community plugins if prompted"
echo "4. Enable 'Claude from Obsidian' plugin"
