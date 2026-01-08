/**
 * Settings tab for Claude from Obsidian plugin
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import ClaudeFromObsidianPlugin from './main';

export class ClaudeSettingsTab extends PluginSettingTab {
	plugin: ClaudeFromObsidianPlugin;

	constructor(app: App, plugin: ClaudeFromObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Claude from Obsidian Settings' });

		// Default working directory
		new Setting(containerEl)
			.setName('Default Working Directory')
			.setDesc('Default directory for new Claude Shell sessions')
			.addText((text) =>
				text
					.setPlaceholder('~')
					.setValue(this.plugin.settings.defaultWorkingDirectory)
					.onChange(async (value) => {
						this.plugin.settings.defaultWorkingDirectory = value;
						await this.plugin.saveSettings();
					})
			);

		// Command timeout
		new Setting(containerEl)
			.setName('Command Timeout')
			.setDesc('Maximum time (in seconds) to wait for Claude response')
			.addText((text) =>
				text
					.setPlaceholder('30')
					.setValue(String(this.plugin.settings.commandTimeout / 1000))
					.onChange(async (value) => {
						const timeout = parseInt(value);
						if (!isNaN(timeout) && timeout > 0) {
							this.plugin.settings.commandTimeout = timeout * 1000;
							await this.plugin.saveSettings();
						}
					})
			);

		// Command history limit
		new Setting(containerEl)
			.setName('Command History Limit')
			.setDesc('Number of commands to keep in session history')
			.addText((text) =>
				text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.commandHistoryLimit))
					.onChange(async (value) => {
						const limit = parseInt(value);
						if (!isNaN(limit) && limit > 0) {
							this.plugin.settings.commandHistoryLimit = limit;
							await this.plugin.saveSettings();
						}
					})
			);

		// Auto-reconnect sessions
		new Setting(containerEl)
			.setName('Auto-reconnect Sessions')
			.setDesc('Automatically reconnect to sessions on plugin load')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoReconnectSessions)
					.onChange(async (value) => {
						this.plugin.settings.autoReconnectSessions = value;
						await this.plugin.saveSettings();
					})
			);

		// Session information
		containerEl.createEl('h3', { text: 'Session Management' });

		new Setting(containerEl)
			.setName('Active Sessions')
			.setDesc(`Currently running: ${this.plugin.processManager.getSessionCount()}`)
			.addButton((btn) =>
				btn
					.setButtonText('View All Sessions')
					.onClick(() => {
						this.plugin.handleManageSessions();
					})
			);

		new Setting(containerEl)
			.setName('Clear Session History')
			.setDesc('Remove command history from all sessions')
			.addButton((btn) =>
				btn
					.setButtonText('Clear History')
					.setWarning()
					.onClick(async () => {
						await this.plugin.sessionManager.clearAllHistory();
						this.display(); // Refresh
					})
			);
	}
}
