/**
 * UI Modals for session selection and creation
 */

import { App, Modal, Setting } from 'obsidian';
import { SessionMetadata, SessionSelectCallback, NewSessionCallback } from './types';
import { formatRelativeTime, validateDirectory } from './utils';

/**
 * Modal for selecting an existing session or creating a new one
 */
export class SessionSelectorModal extends Modal {
	private sessions: SessionMetadata[];
	private onSelect: SessionSelectCallback;

	constructor(app: App, sessions: SessionMetadata[], onSelect: SessionSelectCallback) {
		super(app);
		this.sessions = sessions;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select or Create Claude Session' });

		// Create New Session button
		new Setting(contentEl)
			.setName('Create New Session')
			.setDesc('Start a new Claude Shell session')
			.addButton((btn) =>
				btn
					.setButtonText('Create New')
					.setCta()
					.onClick(() => {
						this.close();
						new NewSessionModal(this.app, (name, workingDir) => {
							// Signal that we want to create a new session
							// The callback will handle the actual creation
							this.onSelect(`new:${name}:${workingDir}`);
						}).open();
					})
			);

		contentEl.createEl('h3', { text: 'Existing Sessions' });

		// Show message if no sessions
		if (this.sessions.length === 0) {
			contentEl.createEl('p', {
				text: 'No existing sessions. Create your first session above.',
				cls: 'claude-no-sessions',
			});
		}

		// List existing sessions
		for (const session of this.sessions) {
			this.renderSession(contentEl, session);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private renderSession(container: HTMLElement, session: SessionMetadata): void {
		const sessionEl = container.createDiv({ cls: 'claude-session-item' });

		// Status badge
		const statusBadge = sessionEl.createSpan({
			cls: `claude-status-badge claude-status-${session.status}`,
		});

		switch (session.status) {
			case 'active':
				statusBadge.setText('● Active');
				break;
			case 'stopped':
				statusBadge.setText('○ Stopped');
				break;
			case 'crashed':
				statusBadge.setText('⚠ Crashed');
				break;
		}

		// Session info
		const infoEl = sessionEl.createDiv({ cls: 'claude-session-info' });

		const nameEl = infoEl.createDiv({ cls: 'claude-session-name' });
		nameEl.setText(session.name);

		const dirEl = infoEl.createDiv({ cls: 'claude-session-dir' });
		dirEl.setText(session.workingDirectory);

		const timeEl = infoEl.createDiv({ cls: 'claude-session-time' });
		timeEl.setText(`Last used: ${formatRelativeTime(session.lastUsedAt)}`);

		// Click to select
		sessionEl.addEventListener('click', () => {
			this.close();
			this.onSelect(session.id);
		});

		// Add hover effect
		sessionEl.addClass('clickable');
	}
}

/**
 * Modal for creating a new session
 */
export class NewSessionModal extends Modal {
	private onSubmit: NewSessionCallback;
	private sessionName: string = '';
	private workingDirectory: string = '~';

	constructor(app: App, onSubmit: NewSessionCallback) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Create New Claude Session' });

		// Session name input
		new Setting(contentEl)
			.setName('Session Name')
			.setDesc('A descriptive name for this session')
			.addText((text) =>
				text
					.setPlaceholder('e.g., Blog Writing')
					.setValue(this.sessionName)
					.onChange((value) => {
						this.sessionName = value;
					})
			);

		// Working directory input
		new Setting(contentEl)
			.setName('Working Directory')
			.setDesc('Directory where Claude Shell will run')
			.addText((text) =>
				text
					.setPlaceholder('~')
					.setValue(this.workingDirectory)
					.onChange((value) => {
						this.workingDirectory = value;
					})
			);

		// Buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Create Session')
					.setCta()
					.onClick(() => {
						this.handleSubmit();
					})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private handleSubmit(): void {
		// Validate session name
		if (!this.sessionName || this.sessionName.trim() === '') {
			// Show error
			new Modal(this.app).setContent(
				'Please enter a session name'
			);
			return;
		}

		// Validate directory
		const dirValidation = validateDirectory(this.workingDirectory);
		if (!dirValidation.valid) {
			new Modal(this.app).setContent(
				dirValidation.error || 'Invalid directory'
			);
			return;
		}

		this.close();
		this.onSubmit(this.sessionName.trim(), this.workingDirectory);
	}
}
