/**
 * Claude from Obsidian Plugin - Main Entry Point
 */

import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { ClaudeFromObsidianSettings, DEFAULT_SETTINGS } from './types';
import { ClaudeProcessManager } from './process-manager';
import { SessionManager } from './session-manager';
import { SessionSelectorModal } from './session-selector-modal';
import { CommandInputModal } from './command-input-modal';
import { ResponseModal } from './response-modal';
import { ClaudeSettingsTab } from './settings-tab';

export default class ClaudeFromObsidianPlugin extends Plugin {
	settings!: ClaudeFromObsidianSettings;
	processManager!: ClaudeProcessManager;
	sessionManager!: SessionManager;

	async onload() {
		console.log('Loading Claude from Obsidian plugin');

		// Load settings
		await this.loadSettings();

		// Initialize process manager
		this.processManager = new ClaudeProcessManager(this.settings.commandTimeout);

		// Initialize session manager
		const dataDir = this.app.vault.configDir + '/plugins/claude-from-obsidian';
		this.sessionManager = new SessionManager(dataDir, this.processManager);
		await this.sessionManager.initialize();

		// Register commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new ClaudeSettingsTab(this.app, this));
	}

	async onunload() {
		console.log('Unloading Claude from Obsidian plugin');

		// Terminate all Claude processes
		await this.processManager.terminateAll();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Register plugin commands
	 */
	private registerCommands(): void {
		// Main command: Ask Claude with selected text
		this.addCommand({
			id: 'ask-claude',
			name: 'Ask Claude with selected text',
			editorCallback: (editor: Editor) => {
				this.handleAskClaude(editor);
			},
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
		});

		// Command: Manage Claude sessions
		this.addCommand({
			id: 'manage-sessions',
			name: 'Manage Claude sessions',
			callback: () => {
				this.handleManageSessions();
			},
		});
	}

	/**
	 * Handle "Ask Claude" command
	 */
	private async handleAskClaude(editor: Editor): Promise<void> {
		const selectedText = editor.getSelection();

		try {
			// Step 1: Session selection
			const sessionId = await this.showSessionSelector();
			if (!sessionId) {
				return; // User cancelled
			}

			// Handle new session creation
			if (sessionId.startsWith('new:')) {
				const parts = sessionId.substring(4).split(':');
				const name = parts[0];
				const workingDir = parts.slice(1).join(':');

				try {
					const session = await this.sessionManager.createSession(name, workingDir);
					await this.executeCommandWorkflow(session.id, selectedText, editor);
				} catch (error) {
					new Notice(`Failed to create session: ${(error as Error).message}`);
					return;
				}
			} else {
				// Use existing session
				await this.executeCommandWorkflow(sessionId, selectedText, editor);
			}
		} catch (error) {
			new Notice(`Error: ${(error as Error).message}`);
		}
	}

	/**
	 * Execute the command workflow for a session
	 */
	private async executeCommandWorkflow(
		sessionId: string,
		selectedText: string,
		editor: Editor
	): Promise<void> {
		const session = await this.sessionManager.getSession(sessionId);
		if (!session) {
			new Notice('Session not found');
			return;
		}

		// Step 2: Command input
		const command = await this.showCommandInput(session.name, selectedText);
		if (!command) {
			return; // User cancelled
		}

		// Step 3: Execute and show response
		const responseModal = new ResponseModal(this.app, (action, text) => {
			this.handleResponseAction(action, text, editor);
		});
		responseModal.open();
		responseModal.setLoading(true);

		try {
			const response = await this.executeCommand(sessionId, command, selectedText);
			responseModal.setResponse(response);

			// Add to history
			await this.sessionManager.addCommandToHistory(
				sessionId,
				command,
				this.settings.commandHistoryLimit
			);
		} catch (error) {
			responseModal.setError((error as Error).message);
		}
	}

	/**
	 * Show session selector modal
	 */
	private showSessionSelector(): Promise<string | null> {
		return new Promise((resolve) => {
			this.sessionManager.getAllSessions().then((sessions) => {
				new SessionSelectorModal(this.app, sessions, (sessionId) => {
					resolve(sessionId);
				}).open();
			});
		});
	}

	/**
	 * Show command input modal
	 */
	private showCommandInput(sessionName: string, selectedText: string): Promise<string | null> {
		return new Promise((resolve) => {
			new CommandInputModal(this.app, sessionName, selectedText, (command) => {
				resolve(command);
			}).open();
		});
	}

	/**
	 * Execute a command on a Claude process
	 */
	private async executeCommand(
		sessionId: string,
		command: string,
		context?: string
	): Promise<string> {
		// Get the process
		const process = this.processManager.getSession(sessionId);
		if (!process || !process.isRunning()) {
			// Try to restart the session
			try {
				await this.sessionManager.restartSession(sessionId);
				const newProcess = this.processManager.getSession(sessionId);
				if (!newProcess) {
					throw new Error('Failed to restart session');
				}
				return await newProcess.sendCommand(command, context);
			} catch (error) {
				throw new Error(`Session not running: ${(error as Error).message}`);
			}
		}

		// Send command
		return await process.sendCommand(command, context);
	}

	/**
	 * Handle response action (copy/insert/replace)
	 */
	private handleResponseAction(
		action: 'copy' | 'insert' | 'replace',
		text: string,
		editor: Editor
	): void {
		switch (action) {
			case 'copy':
				navigator.clipboard.writeText(text);
				break;

			case 'insert':
				editor.replaceSelection(editor.getSelection() + text);
				break;

			case 'replace':
				editor.replaceSelection(text);
				break;
		}
	}

	/**
	 * Handle "Manage Sessions" command
	 */
	async handleManageSessions(): Promise<void> {
		const sessions = await this.sessionManager.getAllSessions();

		let message = `Active Sessions: ${sessions.length}\n\n`;

		for (const session of sessions) {
			message += `${session.name} (${session.status})\n`;
			message += `  Directory: ${session.workingDirectory}\n`;
			message += `  Commands: ${session.commandHistory.length}\n\n`;
		}

		new Notice(message, 10000);
	}
}
