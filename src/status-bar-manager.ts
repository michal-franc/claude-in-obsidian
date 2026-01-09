/**
 * Status bar manager for Claude plugin
 * Shows processing status and handles click for details
 */

import { Plugin, Modal, App } from 'obsidian';
import { logger } from './logger';

export type StatusBarState = 'idle' | 'processing' | 'warning' | 'error';

export interface StatusBarInfo {
	state: StatusBarState;
	message?: string;
	/** Stored response when tags were modified/deleted */
	orphanedResponse?: string;
	/** Original command for context */
	originalCommand?: string;
}

/**
 * Manages the status bar item for Claude plugin
 */
export class StatusBarManager {
	private statusBarEl: HTMLElement | null = null;
	private plugin: Plugin;
	private app: App;
	private currentInfo: StatusBarInfo = { state: 'idle' };

	constructor(plugin: Plugin, app: App) {
		this.plugin = plugin;
		this.app = app;
	}

	/**
	 * Initialize the status bar item
	 */
	initialize(): void {
		logger.info('[StatusBarManager] Initializing status bar...');
		this.statusBarEl = this.plugin.addStatusBarItem();
		this.statusBarEl.addClass('claude-status-bar');
		this.statusBarEl.addEventListener('click', () => this.handleClick());
		this.render();
		logger.info('[StatusBarManager] Status bar initialized');
	}

	/**
	 * Update the status bar state
	 */
	setState(info: StatusBarInfo): void {
		logger.debug('[StatusBarManager] Setting state:', info);
		this.currentInfo = info;
		this.render();
	}

	/**
	 * Set to idle state
	 */
	setIdle(): void {
		this.setState({ state: 'idle' });
	}

	/**
	 * Set to processing state
	 */
	setProcessing(message?: string): void {
		this.setState({ state: 'processing', message });
	}

	/**
	 * Set to warning state (tags modified, response available)
	 */
	setWarning(orphanedResponse: string, originalCommand?: string): void {
		this.setState({
			state: 'warning',
			message: 'Click to view response',
			orphanedResponse,
			originalCommand,
		});
	}

	/**
	 * Set to error state
	 */
	setError(message: string): void {
		this.setState({ state: 'error', message });
	}

	/**
	 * Get current state
	 */
	getState(): StatusBarInfo {
		return this.currentInfo;
	}

	/**
	 * Render the status bar content
	 */
	private render(): void {
		if (!this.statusBarEl) return;

		this.statusBarEl.empty();
		this.statusBarEl.removeClass('claude-status-idle', 'claude-status-processing', 'claude-status-warning', 'claude-status-error');

		switch (this.currentInfo.state) {
			case 'idle':
				this.statusBarEl.addClass('claude-status-idle');
				this.statusBarEl.setText('Claude: Idle');
				break;

			case 'processing':
				this.statusBarEl.addClass('claude-status-processing');
				this.statusBarEl.setText(this.currentInfo.message || 'Claude: Processing...');
				break;

			case 'warning':
				this.statusBarEl.addClass('claude-status-warning');
				this.statusBarEl.setText('Claude: ⚠ Response ready');
				break;

			case 'error':
				this.statusBarEl.addClass('claude-status-error');
				this.statusBarEl.setText(`Claude: ✗ ${this.currentInfo.message || 'Error'}`);
				break;
		}
	}

	/**
	 * Handle click on status bar
	 */
	private handleClick(): void {
		logger.debug('[StatusBarManager] Status bar clicked, state:', this.currentInfo.state);

		if (this.currentInfo.state === 'warning' && this.currentInfo.orphanedResponse) {
			// Show modal with orphaned response
			new OrphanedResponseModal(
				this.app,
				this.currentInfo.orphanedResponse,
				this.currentInfo.originalCommand,
				() => this.setIdle()
			).open();
		} else if (this.currentInfo.state === 'processing') {
			// Show processing details modal
			new ProcessingDetailsModal(this.app).open();
		}
	}

	/**
	 * Clean up status bar
	 */
	destroy(): void {
		if (this.statusBarEl) {
			this.statusBarEl.remove();
			this.statusBarEl = null;
		}
	}
}

/**
 * Modal shown when response couldn't be auto-injected
 */
class OrphanedResponseModal extends Modal {
	private response: string;
	private originalCommand?: string;
	private onDismiss: () => void;

	constructor(app: App, response: string, originalCommand: string | undefined, onDismiss: () => void) {
		super(app);
		this.response = response;
		this.originalCommand = originalCommand;
		this.onDismiss = onDismiss;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('claude-orphaned-response-modal');

		contentEl.createEl('h2', { text: 'Claude Response Ready' });

		contentEl.createEl('p', {
			text: 'The document was modified while Claude was processing. The response could not be automatically inserted.',
			cls: 'claude-orphaned-explanation',
		});

		if (this.originalCommand) {
			contentEl.createEl('h4', { text: 'Original Command:' });
			contentEl.createEl('pre', {
				text: this.originalCommand,
				cls: 'claude-orphaned-command',
			});
		}

		contentEl.createEl('h4', { text: 'Response:' });
		const responseEl = contentEl.createEl('pre', {
			text: this.response,
			cls: 'claude-orphaned-response',
		});

		// Copy button
		const buttonContainer = contentEl.createDiv({ cls: 'claude-orphaned-buttons' });

		const copyBtn = buttonContainer.createEl('button', { text: 'Copy to Clipboard' });
		copyBtn.addEventListener('click', async () => {
			await navigator.clipboard.writeText(this.response);
			copyBtn.setText('Copied!');
			setTimeout(() => copyBtn.setText('Copy to Clipboard'), 2000);
		});

		const dismissBtn = buttonContainer.createEl('button', { text: 'Dismiss' });
		dismissBtn.addEventListener('click', () => {
			this.close();
		});
	}

	onClose(): void {
		this.onDismiss();
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal showing processing details
 */
class ProcessingDetailsModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Claude Processing' });
		contentEl.createEl('p', { text: 'Claude is currently processing your request...' });
		contentEl.createEl('p', { text: 'You can continue working. The response will appear in your document when ready.' });

		const closeBtn = contentEl.createEl('button', { text: 'Close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
