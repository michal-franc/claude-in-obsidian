/**
 * Claude from Obsidian Plugin - Main Entry Point
 * Simplified version with single default session and inline prompt
 */

import { Editor, MarkdownView, MarkdownFileInfo, Notice, Plugin } from 'obsidian';
import { ClaudeFromObsidianSettings, DEFAULT_SETTINGS, ActiveRequest } from './types';
import { ClaudeProcessManager } from './process-manager';
import { DefaultSessionManager } from './default-session-manager';
import { ClaudeSettingsTab } from './settings-tab';
import { StatusBarManager } from './status-bar-manager';
import { RequestManager } from './request-manager';
import { TagManager } from './tag-manager';
import { InlinePrompt } from './inline-prompt';
import { SkillManager } from './skill-manager';
import { logger } from './logger';

export default class ClaudeFromObsidianPlugin extends Plugin {
	settings!: ClaudeFromObsidianSettings;
	processManager!: ClaudeProcessManager;
	sessionManager!: DefaultSessionManager;
	statusBarManager!: StatusBarManager;
	requestManager!: RequestManager;
	tagManager!: TagManager;
	skillManager!: SkillManager;

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
				workingDir: this.settings.defaultWorkingDirectory,
			});

			// Initialize process manager
			logger.debug('Initializing process manager...');
			this.processManager = new ClaudeProcessManager(this.settings.commandTimeout);
			logger.info('Process manager initialized');

			// Initialize default session manager (single session)
			logger.debug('Initializing default session manager...');
			this.sessionManager = new DefaultSessionManager(
				this.processManager,
				this.settings.defaultWorkingDirectory
			);
			logger.info('Default session manager initialized');

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
			this.statusBarManager.setStopCallback(() => {
				logger.info('User requested stop via callout button');
				this.sessionManager.abortCurrentCommand();
			});
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

			// Initialize skill manager and load skills
			logger.debug('Initializing skill manager...');
			this.skillManager = new SkillManager(this.app);
			await this.skillManager.loadSkills();
			logger.info('Skill manager initialized');

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

			// Terminate session
			if (this.sessionManager) {
				logger.debug('Terminating session...');
				await this.sessionManager.terminate();
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
		// Update session manager with new working directory
		if (this.sessionManager) {
			this.sessionManager.setWorkingDirectory(this.settings.defaultWorkingDirectory);
		}
	}

	/**
	 * Register plugin commands
	 */
	private registerCommands(): void {
		// Main command: Ask Claude with selected text
		this.addCommand({
			id: 'ask-claude',
			name: 'Ask Claude',
			editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				// Get the MarkdownView from context
				const view = ctx instanceof MarkdownView
					? ctx
					: this.app.workspace.getActiveViewOfType(MarkdownView);

				if (view) {
					this.handleAskClaude(editor, view);
				} else {
					new Notice('Cannot show prompt - no active markdown view');
				}
			},
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
		});
	}

	/**
	 * Handle "Ask Claude" command - shows inline prompt
	 */
	private async handleAskClaude(editor: Editor, view: MarkdownView): Promise<void> {
		logger.info('========================================');
		logger.info('User triggered "Ask Claude" command');
		const selectedText = editor.getSelection();
		logger.debug('Selected text length:', selectedText.length);

		// Show inline prompt
		const inlinePrompt = new InlinePrompt(
			this.app,
			view,
			editor,
			selectedText,
			(command: string) => {
				this.executeCommand(editor, selectedText, command);
			}
		);
		inlinePrompt.show();

		// Add skill buttons if skills are available
		const skills = this.skillManager.getSkills();
		if (skills.length > 0) {
			inlinePrompt.addSkillButtons(skills);
		}
	}

	/**
	 * Execute command with inline workflow
	 */
	private async executeCommand(
		editor: Editor,
		selectedText: string,
		command: string
	): Promise<void> {
		logger.info('Executing command:', command.substring(0, 100));

		// Inject tags into document
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

		// Create request and queue it
		const request = this.requestManager.createRequest(
			this.sessionManager.getSessionId(),
			filePath,
			command,
			selectedText,
			tagResult.startPos,
			tagResult.endPos
		);
		logger.info('Request created:', request.requestId);

		// Update status bar
		const queueLen = this.requestManager.getQueueLength();
		if (queueLen > 1) {
			this.statusBarManager.setProcessing(`Processing... (${queueLen - 1} queued)`);
		} else {
			this.statusBarManager.setProcessing('Processing...');
		}

		// Start timer based on auto-stop setting
		if (this.settings.autoStopOnTimeout) {
			this.statusBarManager.startCountdown(this.settings.commandTimeout);
		} else {
			this.statusBarManager.startElapsedTimer();
		}

		// Process the queue (non-blocking)
		this.processNextRequest(editor);
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
			// Get file path for context awareness (Feature 007)
			const activeFile = this.app.workspace.getActiveFile();
			const filePath = activeFile?.path;

			// Execute the command via session manager
			const response = await this.sessionManager.executeCommand(
				request.command,
				request.originalText,
				filePath,
				this.settings.autoStopOnTimeout
			);

			// Stop countdown after command completes
			this.statusBarManager.stopCountdown();

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

		} catch (error) {
			logger.error('Request failed:', error);

			// Stop countdown on error
			this.statusBarManager.stopCountdown();

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

			// Start timer for next queued request
			if (this.settings.autoStopOnTimeout) {
				this.statusBarManager.startCountdown(this.settings.commandTimeout);
			} else {
				this.statusBarManager.startElapsedTimer();
			}

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
}
