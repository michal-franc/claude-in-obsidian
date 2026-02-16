/**
 * Status bar manager for Claude plugin
 * Shows processing status and handles click for details
 */

import { Plugin, Modal, App } from 'obsidian';
import { logger } from './logger';

export type StatusBarState = 'idle' | 'processing' | 'warning' | 'error';

/** Timeout for auto-cleanup of orphaned responses (5 minutes) */
const ORPHANED_RESPONSE_CLEANUP_TIMEOUT_MS = 5 * 60 * 1000;

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
	/** Timer for auto-cleanup of orphaned responses */
	private warningCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
	/** Countdown interval for processing timer */
	private countdownInterval: ReturnType<typeof setInterval> | null = null;
	/** Timestamp when countdown started */
	private countdownStartTime: number = 0;
	/** Total countdown duration in milliseconds */
	private countdownTotalMs: number = 0;

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
		this.clearWarningCleanupTimer();
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
	 * Starts auto-cleanup timer to prevent memory leaks from orphaned responses
	 */
	setWarning(orphanedResponse: string, originalCommand?: string): void {
		// Clear any existing cleanup timer
		this.clearWarningCleanupTimer();

		this.setState({
			state: 'warning',
			message: 'Click to view response',
			orphanedResponse,
			originalCommand,
		});

		// Start cleanup timer to auto-clear orphaned response after timeout
		this.warningCleanupTimeout = setTimeout(() => {
			logger.info('[StatusBarManager] Auto-cleaning orphaned response after timeout');
			this.setIdle();
		}, ORPHANED_RESPONSE_CLEANUP_TIMEOUT_MS);
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
	 * Get the countdown remaining seconds, or null if no countdown is active
	 */
	getCountdownRemaining(): number | null {
		if (!this.countdownInterval) return null;
		const elapsed = Date.now() - this.countdownStartTime;
		const remainingMs = Math.max(0, this.countdownTotalMs - elapsed);
		return Math.ceil(remainingMs / 1000);
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

			case 'processing': {
				this.statusBarEl.addClass('claude-status-processing');
				const remaining = this.getCountdownRemaining();
				if (remaining !== null) {
					this.statusBarEl.setText(`Claude: Processing... (${remaining}s)`);
				} else {
					this.statusBarEl.setText(this.currentInfo.message || 'Claude: Processing...');
				}
				break;
			}

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
	 * Clear the warning cleanup timer if it exists
	 */
	private clearWarningCleanupTimer(): void {
		if (this.warningCleanupTimeout) {
			clearTimeout(this.warningCleanupTimeout);
			this.warningCleanupTimeout = null;
		}
	}

	/**
	 * Start a countdown timer that updates the status bar and callout overlay
	 */
	startCountdown(totalMs: number): void {
		this.stopCountdown();
		this.countdownStartTime = Date.now();
		this.countdownTotalMs = totalMs;
		logger.debug('[StatusBarManager] Starting countdown:', totalMs, 'ms');
		this.countdownInterval = setInterval(() => this.updateCountdownDisplay(), 1000);
		this.updateCountdownDisplay();
	}

	/**
	 * Stop the countdown timer and clean up callout DOM
	 */
	stopCountdown(): void {
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval);
			this.countdownInterval = null;
		}
		this.clearCalloutCountdown();
	}

	/**
	 * Update the countdown display in status bar and callout DOM
	 */
	private updateCountdownDisplay(): void {
		const elapsed = Date.now() - this.countdownStartTime;
		const remainingMs = Math.max(0, this.countdownTotalMs - elapsed);
		const remainingSec = Math.ceil(remainingMs / 1000);

		// Re-render status bar (render() reads countdown state)
		this.render();

		// Update callout DOM element (re-apply every tick since Obsidian may recreate DOM)
		if (typeof document !== 'undefined') {
			const calloutEl = document.querySelector('.callout[data-callout="claude-processing"]');
			if (calloutEl) {
				calloutEl.setAttribute('data-countdown', `Claude is processing... (${remainingSec}s)`);
			}
		}

		// Auto-stop at 0
		if (remainingMs <= 0 && this.countdownInterval) {
			clearInterval(this.countdownInterval);
			this.countdownInterval = null;
		}
	}

	/**
	 * Remove countdown attribute from all processing callouts
	 */
	private clearCalloutCountdown(): void {
		if (typeof document !== 'undefined') {
			const callouts = document.querySelectorAll('.callout[data-callout="claude-processing"][data-countdown]');
			callouts.forEach((el) => el.removeAttribute('data-countdown'));
		}
	}

	/**
	 * Clean up status bar
	 */
	destroy(): void {
		this.stopCountdown();
		this.clearWarningCleanupTimer();
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
