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
import { logger } from './logger';

export default class ClaudeFromObsidianPlugin extends Plugin {
	settings!: ClaudeFromObsidianSettings;
	processManager!: ClaudeProcessManager;
	sessionManager!: SessionManager;

	async onload() {
		logger.info('========================================');
		logger.info('Loading Claude from Obsidian plugin');
		logger.info('========================================');

		try {
			// Load settings
			logger.debug('Loading plugin settings...');
			await this.loadSettings();
			logger.info('Settings loaded:', {
				timeout: this.settings.commandTimeout,
				historyLimit: this.settings.commandHistoryLimit,
				autoReconnect: this.settings.autoReconnectSessions,
			});

			// Initialize process manager
			logger.debug('Initializing process manager...');
			this.processManager = new ClaudeProcessManager(this.settings.commandTimeout);
			logger.info('Process manager initialized');

			// Initialize session manager
			const dataDir = this.app.vault.configDir + '/plugins/claude-from-obsidian';
			logger.debug('Initializing session manager with data dir:', dataDir);
			this.sessionManager = new SessionManager(dataDir, this.processManager);
			await this.sessionManager.initialize();
			logger.info('Session manager initialized');

			// Register commands
			logger.debug('Registering commands...');
			this.registerCommands();
			logger.info('Commands registered');

			// Add settings tab
			logger.debug('Adding settings tab...');
			this.addSettingTab(new ClaudeSettingsTab(this.app, this));
			logger.info('Settings tab added');

			logger.info('Plugin loaded successfully');
		} catch (error) {
			logger.error('Failed to load plugin:', error);
			new Notice(`Failed to load Claude plugin: ${(error as Error).message}`);
		}
	}

	async onunload() {
		logger.info('========================================');
		logger.info('Unloading Claude from Obsidian plugin');
		logger.info('========================================');

		try {
			// Terminate all Claude processes
			logger.debug('Terminating all Claude processes...');
			await this.processManager.terminateAll();
			logger.info('All Claude processes terminated');
			logger.info('Plugin unloaded successfully');
		} catch (error) {
			logger.error('Error during plugin unload:', error);
		}
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
		logger.info('========================================');
		logger.info('User triggered "Ask Claude" command');
		const selectedText = editor.getSelection();
		logger.debug('Selected text length:', selectedText.length);
		if (selectedText) {
			logger.debug('Selected text preview:', selectedText.substring(0, 100));
		}

		try {
			// Step 1: Session selection
			logger.debug('Showing session selector...');
			const sessionId = await this.showSessionSelector();
			if (!sessionId) {
				logger.info('User cancelled session selection');
				return; // User cancelled
			}
			logger.info('Session selected:', sessionId);

			// Handle new session creation
			if (sessionId.startsWith('new:')) {
				const parts = sessionId.substring(4).split(':');
				const name = parts[0];
				const workingDir = parts.slice(1).join(':');
				logger.info('Creating new session:', { name, workingDir });

				try {
					const session = await this.sessionManager.createSession(name, workingDir);
					logger.info('New session created successfully:', session.id);
					await this.executeCommandWorkflow(session.id, selectedText, editor);
				} catch (error) {
					logger.error('Failed to create session:', error);
					new Notice(`Failed to create session: ${(error as Error).message}`);
					return;
				}
			} else {
				// Use existing session
				logger.info('Using existing session:', sessionId);
				await this.executeCommandWorkflow(sessionId, selectedText, editor);
			}
		} catch (error) {
			logger.error('Error in handleAskClaude:', error);
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
		logger.debug('Starting command workflow for session:', sessionId);
		const session = await this.sessionManager.getSession(sessionId);
		if (!session) {
			logger.error('Session not found:', sessionId);
			new Notice('Session not found');
			return;
		}
		logger.info('Session found:', { name: session.name, status: session.status });

		// Step 2: Command input
		logger.debug('Showing command input modal...');
		const command = await this.showCommandInput(session.name, selectedText);
		if (!command) {
			logger.info('User cancelled command input');
			return; // User cancelled
		}
		logger.info('Command entered:', command.substring(0, 100));

		// Step 3: Execute and show response
		logger.debug('Opening response modal...');
		const responseModal = new ResponseModal(this.app, (action, text) => {
			this.handleResponseAction(action, text, editor);
		});
		responseModal.open();
		responseModal.setLoading(true);

		try {
			logger.info('Executing command on Claude process...');
			const startTime = Date.now();
			const response = await this.executeCommand(sessionId, command, selectedText);
			const duration = Date.now() - startTime;
			logger.info(`Command executed successfully in ${duration}ms`);
			logger.debug('Response length:', response.length);
			logger.debug('Response preview:', response.substring(0, 200));

			responseModal.setResponse(response);

			// Add to history
			logger.debug('Adding command to history...');
			await this.sessionManager.addCommandToHistory(
				sessionId,
				command,
				this.settings.commandHistoryLimit
			);
			logger.debug('Command added to history');
		} catch (error) {
			logger.error('Command execution failed:', error);
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
		logger.debug('Getting Claude process for session:', sessionId);
		// Get the process
		const process = this.processManager.getSession(sessionId);
		if (!process || !process.isRunning()) {
			logger.warn('Process not running, attempting to restart session:', sessionId);
			// Try to restart the session
			try {
				await this.sessionManager.restartSession(sessionId);
				logger.info('Session restarted successfully');
				const newProcess = this.processManager.getSession(sessionId);
				if (!newProcess) {
					logger.error('Process still not available after restart');
					throw new Error('Failed to restart session');
				}
				logger.debug('Sending command to restarted process...');
				return await newProcess.sendCommand(command, context);
			} catch (error) {
				logger.error('Failed to restart session:', error);
				throw new Error(`Session not running: ${(error as Error).message}`);
			}
		}

		// Send command
		logger.debug('Sending command to active process...');
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
