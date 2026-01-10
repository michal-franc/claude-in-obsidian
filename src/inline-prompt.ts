/**
 * Inline Prompt - Floating input for Claude commands
 * Part of Feature 004: Simplified Inline Editing
 */

import { App, MarkdownView, Editor } from 'obsidian';
import { logger } from './logger';

export type CommandCallback = (command: string) => void;

/**
 * Floating inline prompt that appears near the selection
 */
export class InlinePrompt {
	private app: App;
	private view: MarkdownView;
	private editor: Editor;
	private selectedText: string;
	private onSubmit: CommandCallback;
	private containerEl: HTMLElement | null = null;
	private inputEl: HTMLInputElement | null = null;
	private boundHandleKeydown: (e: KeyboardEvent) => void;
	private boundHandleClickOutside: (e: MouseEvent) => void;

	constructor(
		app: App,
		view: MarkdownView,
		editor: Editor,
		selectedText: string,
		onSubmit: CommandCallback
	) {
		this.app = app;
		this.view = view;
		this.editor = editor;
		this.selectedText = selectedText;
		this.onSubmit = onSubmit;
		this.boundHandleKeydown = this.handleKeydown.bind(this);
		this.boundHandleClickOutside = this.handleClickOutside.bind(this);
	}

	/**
	 * Show the inline prompt
	 */
	show(): void {
		logger.debug('[InlinePrompt] Showing inline prompt');

		// Create container
		this.containerEl = document.createElement('div');
		this.containerEl.addClass('claude-inline-prompt');

		// Create input row
		const inputRow = this.containerEl.createDiv({ cls: 'claude-inline-input-row' });

		// Label
		const label = inputRow.createSpan({ cls: 'claude-inline-label' });
		label.setText('Ask Claude:');

		// Input field
		this.inputEl = inputRow.createEl('input', {
			cls: 'claude-inline-input',
			attr: {
				type: 'text',
				placeholder: 'Type command and press Enter...',
			},
		});

		// Submit hint
		const hint = inputRow.createSpan({ cls: 'claude-inline-hint' });
		hint.setText('⏎');

		// Skills row (placeholder for feature 003)
		// Will be populated by SkillManager when implemented
		const skillsRow = this.containerEl.createDiv({ cls: 'claude-inline-skills' });
		skillsRow.style.display = 'none'; // Hidden until skills are implemented

		// Position and show
		this.positionNearSelection();
		document.body.appendChild(this.containerEl);

		// Focus input
		this.inputEl.focus();

		// Add event listeners
		this.inputEl.addEventListener('keydown', this.boundHandleKeydown);
		document.addEventListener('mousedown', this.boundHandleClickOutside);

		logger.info('[InlinePrompt] Inline prompt shown');
	}

	/**
	 * Hide and cleanup the inline prompt
	 */
	hide(): void {
		if (this.inputEl) {
			this.inputEl.removeEventListener('keydown', this.boundHandleKeydown);
		}
		document.removeEventListener('mousedown', this.boundHandleClickOutside);

		if (this.containerEl && this.containerEl.parentNode) {
			this.containerEl.parentNode.removeChild(this.containerEl);
		}
		this.containerEl = null;
		this.inputEl = null;

		logger.debug('[InlinePrompt] Inline prompt hidden');
	}

	/**
	 * Position the prompt near the current selection/cursor
	 */
	private positionNearSelection(): void {
		if (!this.containerEl) return;

		// Get cursor position from CodeMirror
		const cursor = this.editor.getCursor('to');
		const coords = this.editor.posToOffset(cursor);

		// Try to get screen coordinates from the editor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const cm = (this.editor as any).cm;
		let screenCoords: { left: number; top: number; bottom: number } | null = null;

		if (cm && cm.coordsAtPos) {
			// CodeMirror 6
			const pos = this.editor.posToOffset(cursor);
			screenCoords = cm.coordsAtPos(pos);
		} else if (cm && cm.cursorCoords) {
			// CodeMirror 5 fallback
			screenCoords = cm.cursorCoords(true, 'window');
		}

		if (screenCoords) {
			// Position below the cursor
			this.containerEl.style.position = 'fixed';
			this.containerEl.style.left = `${screenCoords.left}px`;
			this.containerEl.style.top = `${screenCoords.bottom + 8}px`;
			this.containerEl.style.zIndex = '1000';

			// Adjust if going off-screen
			requestAnimationFrame(() => {
				if (!this.containerEl) return;
				const rect = this.containerEl.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Adjust horizontal position if needed
				if (rect.right > viewportWidth - 20) {
					this.containerEl.style.left = `${viewportWidth - rect.width - 20}px`;
				}
				if (rect.left < 20) {
					this.containerEl.style.left = '20px';
				}

				// Adjust vertical position if needed
				if (rect.bottom > viewportHeight - 20) {
					// Show above cursor instead
					if (screenCoords) {
						this.containerEl.style.top = `${screenCoords.top - rect.height - 8}px`;
					}
				}
			});
		} else {
			// Fallback: center in the view
			logger.warn('[InlinePrompt] Could not get cursor coordinates, centering prompt');
			this.containerEl.style.position = 'fixed';
			this.containerEl.style.left = '50%';
			this.containerEl.style.top = '50%';
			this.containerEl.style.transform = 'translate(-50%, -50%)';
			this.containerEl.style.zIndex = '1000';
		}
	}

	/**
	 * Handle keydown events
	 */
	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			logger.debug('[InlinePrompt] Escape pressed, hiding prompt');
			this.hide();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			this.submit();
		}
	}

	/**
	 * Handle clicks outside the prompt
	 */
	private handleClickOutside(e: MouseEvent): void {
		if (this.containerEl && !this.containerEl.contains(e.target as Node)) {
			logger.debug('[InlinePrompt] Click outside, hiding prompt');
			this.hide();
		}
	}

	/**
	 * Submit the command
	 */
	private submit(): void {
		if (!this.inputEl) return;

		const command = this.inputEl.value.trim();
		if (!command) {
			logger.debug('[InlinePrompt] Empty command, not submitting');
			return;
		}

		logger.info('[InlinePrompt] Submitting command:', command.substring(0, 50));
		this.hide();
		this.onSubmit(command);
	}

	/**
	 * Add skill buttons (for future Feature 003)
	 * This method will be called by SkillManager when implemented
	 */
	addSkillButtons(skills: Array<{ name: string; template: string }>): void {
		if (!this.containerEl) return;

		const skillsRow = this.containerEl.querySelector('.claude-inline-skills');
		if (!skillsRow) return;

		// Show skills row
		(skillsRow as HTMLElement).style.display = 'flex';

		// Clear existing buttons
		skillsRow.empty();

		// Add skill buttons (max 3)
		const maxSkills = Math.min(skills.length, 3);
		for (let i = 0; i < maxSkills; i++) {
			const skill = skills[i];
			const btn = skillsRow.createEl('button', {
				cls: 'claude-skill-button',
				text: skill.name,
			});
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				logger.info('[InlinePrompt] Skill button clicked:', skill.name);
				// Substitute {{selection}} and auto-submit
				const command = skill.template.replace('{{selection}}', this.selectedText);
				this.hide();
				this.onSubmit(command);
			});
		}
	}
}
