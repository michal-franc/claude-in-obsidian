/**
 * Claude from Obsidian Plugin - Main Entry Point
 */

import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { ClaudeFromObsidianSettings, DEFAULT_SETTINGS, ActiveRequest } from './types';
import { ClaudeProcessManager } from './process-manager';
import { SessionManager } from './session-manager';
import { SessionSelectorModal } from './session-selector-modal';
import { CommandInputModal } from './command-input-modal';
import { ClaudeSettingsTab } from './settings-tab';
import { StatusBarManager } from './status-bar-manager';
import { RequestManager } from './request-manager';
import { TagManager } from './tag-manager';
import { logger } from './logger';

export default class ClaudeFromObsidianPlugin extends Plugin {
	settings!: ClaudeFromObsidianSettings;
	processManager!: ClaudeProcessManager;
	sessionManager!: SessionManager;
	statusBarManager!: StatusBarManager;
	requestManager!: RequestManager;
	tagManager!: TagManager;

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
			this.sessionManager.setRetentionDays(this.settings.sessionRetentionDays);
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

			// Initialize status bar
			logger.debug('Initializing status bar...');
			this.statusBarManager = new StatusBarManager(this, this.app);
			this.statusBarManager.initialize();
			logger.info('Status bar initialized');

			// Initialize request manager
			logger.debug('Initializing request manager...');
			this.requestManager = new RequestManager();
			this.requestManager.setCompletedCallback((request) => this.handleRequestCompleted(request));
			logger.info('Request manager initialized');

			// Initialize tag manager
			logger.debug('Initializing tag manager...');
			this.tagManager = new TagManager();
			logger.info('Tag manager initialized');

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
			// Clean up status bar
			if (this.statusBarManager) {
				logger.debug('Cleaning up status bar...');
				this.statusBarManager.destroy();
			}

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
	 * Execute the command workflow for a session (non-blocking)
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

		// Step 3: Inject tags into document
		logger.debug('Injecting tags into document...');
		const tagResult = this.tagManager.injectTags(editor, selectedText);
		if (!tagResult.success) {
			logger.error('Failed to inject tags:', tagResult.error);
			new Notice('Failed to inject tags');
			return;
		}
		logger.info('Tags injected successfully');

		// Get the current file path
		const activeFile = this.app.workspace.getActiveFile();
		const filePath = activeFile?.path || 'unknown';

		// Step 4: Create request and queue it
		const request = this.requestManager.createRequest(
			sessionId,
			filePath,
			command,
			selectedText,
			tagResult.startPos,
			tagResult.endPos
		);
		logger.info('Request created:', request.requestId);

		// Step 5: Update status bar with queue info
		const queueLen = this.requestManager.getQueueLength();
		if (queueLen > 1) {
			this.statusBarManager.setProcessing(`Processing... (${queueLen - 1} queued)`);
		} else {
			this.statusBarManager.setProcessing('Processing...');
		}

		// Step 6: Process the queue (non-blocking)
		this.processNextRequest(editor);

		// Control returns to user immediately
		new Notice('Claude is processing your request...', 2000);
	}

	/**
	 * Process the next request in the queue
	 */
	private async processNextRequest(editor: Editor): Promise<void> {
		// Check if already processing
		if (this.requestManager.hasActiveRequest()) {
			logger.debug('Already processing a request, will queue');
			return;
		}

		const request = this.requestManager.getNextRequest();
		if (!request) {
			logger.debug('No request to process');
			this.statusBarManager.setIdle();
			return;
		}

		logger.info('Processing request:', request.requestId);

		try {
			// Execute the command
			const response = await this.executeCommand(
				request.sessionId,
				request.command,
				request.originalText
			);

			// Check if tags are still intact
			if (!this.tagManager.areTagsIntact(editor, request)) {
				logger.warn('Tags were modified, orphaning request');
				this.requestManager.orphanRequest(response);
				return;
			}

			// Replace tags with response
			const replaced = this.tagManager.replaceWithResponse(editor, request, response);
			if (!replaced) {
				logger.warn('Failed to replace tags, orphaning request');
				this.requestManager.orphanRequest(response);
				return;
			}

			// Mark request as completed
			this.requestManager.completeRequest(response);

			// Add to history
			await this.sessionManager.addCommandToHistory(
				request.sessionId,
				request.command,
				this.settings.commandHistoryLimit
			);

		} catch (error) {
			logger.error('Request failed:', error);

			// Try to inject error into tags
			const errorMsg = (error as Error).message;
			const injected = this.tagManager.injectError(editor, request, errorMsg);

			if (!injected) {
				// Tags were modified, orphan the request with error
				this.requestManager.orphanRequest();
			} else {
				this.requestManager.failRequest(errorMsg);
			}
		}
	}

	/**
	 * Handle completed request (callback from RequestManager)
	 */
	private handleRequestCompleted(request: ActiveRequest): void {
		logger.info('Request completed:', {
			requestId: request.requestId,
			status: request.status,
		});

		// Check if there are more requests in queue
		const status = this.requestManager.getStatus();

		if (status.queueLength > 0) {
			// Update status bar with queue info
			this.statusBarManager.setProcessing(`Processing... (${status.queueLength} queued)`);

			// Process next request
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				this.processNextRequest(activeView.editor);
			} else {
				logger.warn('No active editor, cannot process next request');
				// Orphan remaining requests
				while (this.requestManager.getQueueLength() > 0) {
					const next = this.requestManager.getNextRequest();
					if (next) {
						this.requestManager.orphanRequest();
					}
				}
			}
		} else if (!status.active) {
			// No more requests, update status bar
			if (request.status === 'orphaned') {
				// Show warning with orphaned response
				this.statusBarManager.setWarning(
					request.response || 'Response unavailable',
					request.command
				);
				new Notice('Claude response ready - click status bar to view', 5000);
			} else if (request.status === 'failed') {
				this.statusBarManager.setError(request.error || 'Request failed');
				setTimeout(() => this.statusBarManager.setIdle(), 5000);
			} else {
				this.statusBarManager.setIdle();
			}
		}
	}

	/**
	 * Show session selector modal
	 */
	private showSessionSelector(): Promise<string | null> {
		return new Promise((resolve) => {
			this.sessionManager.getAllSessions().then((sessions) => {
				new SessionSelectorModal(
					this.app,
					sessions,
					(sessionId) => {
						resolve(sessionId);
					},
					async () => {
						// Clear stopped sessions callback
						const removed = await this.sessionManager.clearStoppedSessions();
						return removed;
					}
				).open();
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
