# Makefile for Claude from Obsidian Plugin

# Configuration
OBSIDIAN_VAULT := /home/mfranc/Work/notes
PLUGIN_DIR := $(OBSIDIAN_VAULT)/.obsidian/plugins/claude-from-obsidian
PLUGIN_FILES := main.js manifest.json styles.css

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

.PHONY: all build publish install dev clean help

# Default target
all: build

# Build the plugin
build:
	@echo "$(YELLOW)Building plugin...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

# Build and copy to Obsidian test instance
publish: build
	@echo "$(YELLOW)Publishing to Obsidian test instance...$(NC)"
	@mkdir -p $(PLUGIN_DIR)
	@cp $(PLUGIN_FILES) $(PLUGIN_DIR)/
	@echo "$(GREEN)✓ Published to $(PLUGIN_DIR)$(NC)"
	@echo "$(YELLOW)Restart Obsidian or reload the plugin to see changes$(NC)"

# Install npm dependencies
install:
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

# Development mode (watch for changes)
dev:
	@echo "$(YELLOW)Starting development mode (watch for changes)...$(NC)"
	npm run dev

# Clean build artifacts
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -f main.js main.js.map
	@echo "$(GREEN)✓ Clean complete$(NC)"

# Clean and remove from Obsidian
uninstall: clean
	@echo "$(YELLOW)Removing plugin from Obsidian...$(NC)"
	rm -rf $(PLUGIN_DIR)
	@echo "$(GREEN)✓ Plugin removed from Obsidian$(NC)"

# Show plugin status
status:
	@echo "$(YELLOW)Plugin Status:$(NC)"
	@echo "  Build files:"
	@ls -lh main.js 2>/dev/null || echo "    main.js: not built"
	@echo ""
	@echo "  Obsidian installation:"
	@if [ -d "$(PLUGIN_DIR)" ]; then \
		echo "    Installed: $(GREEN)YES$(NC)"; \
		ls -lh $(PLUGIN_DIR); \
	else \
		echo "    Installed: $(YELLOW)NO$(NC)"; \
	fi

# Quick rebuild and publish
quick: clean publish

# Help target
help:
	@echo "$(GREEN)Claude from Obsidian - Available Commands:$(NC)"
	@echo ""
	@echo "  $(YELLOW)make build$(NC)      - Build the plugin"
	@echo "  $(YELLOW)make publish$(NC)    - Build and copy to Obsidian test instance"
	@echo "  $(YELLOW)make install$(NC)    - Install npm dependencies"
	@echo "  $(YELLOW)make dev$(NC)        - Start development mode (watch)"
	@echo "  $(YELLOW)make clean$(NC)      - Remove build artifacts"
	@echo "  $(YELLOW)make uninstall$(NC)  - Remove plugin from Obsidian"
	@echo "  $(YELLOW)make status$(NC)     - Show plugin build and install status"
	@echo "  $(YELLOW)make quick$(NC)      - Clean, build, and publish"
	@echo "  $(YELLOW)make help$(NC)       - Show this help message"
	@echo ""
	@echo "$(GREEN)Configuration:$(NC)"
	@echo "  Obsidian Vault: $(OBSIDIAN_VAULT)"
	@echo "  Plugin Dir: $(PLUGIN_DIR)"
