/**
 * Settings tab for Claude from Obsidian plugin
 * Simplified for single default session (Feature 004)
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
			.setName('Working Directory')
			.setDesc('Directory where Claude will run commands. Use ~ for home directory.')
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

		// Session status
		containerEl.createEl('h3', { text: 'Session Status' });

		const status = this.plugin.sessionManager.getStatus();
		const statusText = status.ready ? 'Ready' : 'Not initialized';

		new Setting(containerEl)
			.setName('Status')
			.setDesc(`${statusText} - Working directory: ${status.workingDirectory}`);

		// About section
		containerEl.createEl('h3', { text: 'About' });

		const aboutDiv = containerEl.createDiv({ cls: 'claude-settings-about' });
		aboutDiv.createEl('p', {
			text: 'This plugin provides a simplified inline workflow for asking Claude questions about selected text.',
		});
		aboutDiv.createEl('p', {
			text: 'For advanced features like sidebar chat, agentic tools, or diff preview, consider using Claudian.',
		});
	}
}
