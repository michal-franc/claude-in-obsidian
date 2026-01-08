/**
 * Modal for command input
 */

import { App, Modal, Setting } from 'obsidian';
import { CommandSubmitCallback } from './types';
import { truncateText } from './utils';

/**
 * Modal for entering a command with context
 */
export class CommandInputModal extends Modal {
	private sessionName: string;
	private selectedText: string;
	private command: string = '';
	private onSubmit: CommandSubmitCallback;

	constructor(
		app: App,
		sessionName: string,
		selectedText: string,
		onSubmit: CommandSubmitCallback
	) {
		super(app);
		this.sessionName = sessionName;
		this.selectedText = selectedText;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header with session name
		const header = contentEl.createDiv({ cls: 'claude-session-header' });
		header.setText(`Session: ${this.sessionName}`);

		contentEl.createEl('h2', { text: 'Ask Claude' });

		// Show selected text if any
		if (this.selectedText && this.selectedText.length > 0) {
			const section = contentEl.createDiv({ cls: 'claude-command-section' });
			section.createEl('h3', { text: 'Selected Text' });

			const contextDisplay = section.createDiv({ cls: 'claude-context-display' });

			// Show full text if short, truncated if long
			if (this.selectedText.length > 500) {
				contextDisplay.setText(truncateText(this.selectedText, 500));
				const expandBtn = section.createEl('button', {
					text: 'Show full text',
					cls: 'mod-cta',
				});
				expandBtn.addEventListener('click', () => {
					contextDisplay.setText(this.selectedText);
					expandBtn.remove();
				});
			} else {
				contextDisplay.setText(this.selectedText);
			}
		}

		// Command input
		const commandSection = contentEl.createDiv({ cls: 'claude-command-section' });
		commandSection.createEl('h3', { text: 'Your Command' });

		const textarea = commandSection.createEl('textarea', {
			cls: 'claude-command-input',
			attr: {
				placeholder: 'e.g., "Improve this text", "Make it more concise", "Fix grammar"',
			},
		});

		textarea.addEventListener('input', (e) => {
			this.command = (e.target as HTMLTextAreaElement).value;
		});

		// Auto-focus the textarea
		textarea.focus();

		// Ctrl+Enter to submit
		textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.handleSubmit();
			}
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'claude-response-actions' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
		});
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const submitBtn = buttonContainer.createEl('button', {
			text: 'Send (Ctrl+Enter)',
			cls: 'mod-cta',
		});
		submitBtn.addEventListener('click', () => {
			this.handleSubmit();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private handleSubmit(): void {
		if (!this.command || this.command.trim() === '') {
			// Show error
			return;
		}

		this.close();
		this.onSubmit(this.command.trim());
	}
}
