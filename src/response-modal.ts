/**
 * Modal for displaying Claude's response
 */

import { App, Modal, Notice } from 'obsidian';
import { ResponseActionCallback } from './types';

/**
 * Modal for displaying Claude's response with actions
 */
export class ResponseModal extends Modal {
	private response: string | null = null;
	private isLoading: boolean = true;
	private error: string | null = null;
	private onAction: ResponseActionCallback;

	constructor(app: App, onAction: ResponseActionCallback) {
		super(app);
		this.onAction = onAction;
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Set loading state
	 */
	setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.render();
	}

	/**
	 * Set response text
	 */
	setResponse(response: string): void {
		this.response = response;
		this.isLoading = false;
		this.error = null;
		this.render();
	}

	/**
	 * Set error text
	 */
	setError(error: string): void {
		this.error = error;
		this.isLoading = false;
		this.render();
	}

	/**
	 * Render the modal content
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: "Claude's Response" });

		if (this.isLoading) {
			this.renderLoading(contentEl);
		} else if (this.error) {
			this.renderError(contentEl);
		} else if (this.response) {
			this.renderResponse(contentEl);
		}
	}

	/**
	 * Render loading state
	 */
	private renderLoading(container: HTMLElement): void {
		const loadingEl = container.createDiv({ cls: 'claude-response-loading' });
		loadingEl.createDiv({ cls: 'claude-response-spinner' });
		loadingEl.createEl('p', { text: 'Waiting for Claude...' });
	}

	/**
	 * Render error state
	 */
	private renderError(container: HTMLElement): void {
		const errorEl = container.createDiv({ cls: 'claude-response-error' });
		errorEl.createEl('strong', { text: 'Error: ' });
		errorEl.appendText(this.error || 'Unknown error');

		// Close button
		const buttonContainer = container.createDiv({ cls: 'claude-response-actions' });
		const closeBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'mod-cta',
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	/**
	 * Render response content
	 */
	private renderResponse(container: HTMLElement): void {
		const responseEl = container.createDiv({ cls: 'claude-response-content' });
		responseEl.setText(this.response || '');

		// Action buttons
		const buttonContainer = container.createDiv({ cls: 'claude-response-actions' });

		const copyBtn = buttonContainer.createEl('button', {
			text: 'Copy',
		});
		copyBtn.addEventListener('click', () => {
			this.handleAction('copy');
		});

		const insertBtn = buttonContainer.createEl('button', {
			text: 'Insert at Cursor',
		});
		insertBtn.addEventListener('click', () => {
			this.handleAction('insert');
		});

		const replaceBtn = buttonContainer.createEl('button', {
			text: 'Replace Selection',
		});
		replaceBtn.addEventListener('click', () => {
			this.handleAction('replace');
		});

		const closeBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'mod-cta',
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	/**
	 * Handle action button click
	 */
	private handleAction(action: 'copy' | 'insert' | 'replace'): void {
		if (!this.response) {
			return;
		}

		try {
			this.onAction(action, this.response);

			// Show success notice
			switch (action) {
				case 'copy':
					new Notice('Response copied to clipboard');
					break;
				case 'insert':
					new Notice('Response inserted at cursor');
					this.close();
					break;
				case 'replace':
					new Notice('Selection replaced with response');
					this.close();
					break;
			}
		} catch (error) {
			new Notice(`Failed to ${action}: ${(error as Error).message}`);
		}
	}
}
