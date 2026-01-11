/**
 * Unit tests for StatusBarManager modals
 * Issue #9: Memory leak - Modal button event listeners not cleaned up
 *
 * @jest-environment jsdom
 */

import {
	OrphanedResponseModal,
	ProcessingDetailsModal,
} from './status-bar-manager';
import { App } from 'obsidian';

// Mock the logger module
jest.mock('./logger', () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Add Obsidian's helper methods to HTMLElement prototype
beforeAll(() => {
	HTMLElement.prototype.addClass = function (cls: string) {
		this.classList.add(cls);
	};

	HTMLElement.prototype.removeClass = function (...classes: string[]) {
		this.classList.remove(...classes);
	};

	HTMLElement.prototype.createDiv = function (options?: { cls?: string; text?: string }) {
		const div = document.createElement('div');
		if (options?.cls) div.className = options.cls;
		if (options?.text) div.textContent = options.text;
		this.appendChild(div);
		return div;
	};

	HTMLElement.prototype.createSpan = function (options?: { cls?: string; text?: string }) {
		const span = document.createElement('span');
		if (options?.cls) span.className = options.cls;
		if (options?.text) span.textContent = options.text;
		this.appendChild(span);
		return span;
	};

	HTMLElement.prototype.createEl = function (
		tag: string,
		options?: { cls?: string; text?: string; attr?: Record<string, string> }
	) {
		const el = document.createElement(tag);
		if (options?.cls) el.className = options.cls;
		if (options?.text) el.textContent = options.text;
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				el.setAttribute(key, value);
			}
		}
		this.appendChild(el);
		return el;
	};

	HTMLElement.prototype.setText = function (text: string) {
		this.textContent = text;
	};

	HTMLElement.prototype.empty = function () {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
});

// Extend HTMLElement type to include Obsidian's methods
declare global {
	interface HTMLElement {
		addClass(cls: string): void;
		removeClass(...classes: string[]): void;
		createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
		createSpan(options?: { cls?: string; text?: string }): HTMLSpanElement;
		createEl(
			tag: string,
			options?: { cls?: string; text?: string; attr?: Record<string, string> }
		): HTMLElement;
		setText(text: string): void;
		empty(): void;
	}
}

describe('Issue #9: Memory leak - Modal button event listeners not cleaned up', () => {
	let mockApp: App;

	beforeEach(() => {
		document.body.innerHTML = '';
		mockApp = new App();
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	describe('OrphanedResponseModal', () => {
		it('should remove event listeners on buttons when close() is called - currently failing', () => {
			const onDismissMock = jest.fn();
			const modal = new OrphanedResponseModal(
				mockApp,
				'Test response content',
				'Test command',
				onDismissMock
			);

			// Open the modal
			modal.open();

			// Find the buttons
			const buttons = modal.contentEl.querySelectorAll('button');
			expect(buttons.length).toBe(2); // Copy and Dismiss buttons

			// Track removeEventListener calls on each button
			const removeListenerSpies: jest.SpyInstance[] = [];
			buttons.forEach((btn) => {
				const spy = jest.spyOn(btn, 'removeEventListener');
				removeListenerSpies.push(spy);
			});

			// Close the modal
			modal.close();

			// Assert - each button should have had removeEventListener called for 'click'
			let removeClickCalls = 0;
			removeListenerSpies.forEach((spy) => {
				const clickCalls = spy.mock.calls.filter(
					(call: [string, EventListener]) => call[0] === 'click'
				);
				removeClickCalls += clickCalls.length;
			});

			// We expect 2 removeEventListener('click', ...) calls - one per button
			expect(removeClickCalls).toBe(2);
		});

		it('should call onDismiss callback when closed', () => {
			const onDismissMock = jest.fn();
			const modal = new OrphanedResponseModal(
				mockApp,
				'Test response',
				undefined,
				onDismissMock
			);

			modal.open();
			modal.close();

			expect(onDismissMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('ProcessingDetailsModal', () => {
		it('should remove event listeners on close button when close() is called - currently failing', () => {
			const modal = new ProcessingDetailsModal(mockApp);

			// Open the modal
			modal.open();

			// Find the close button
			const closeBtn = modal.contentEl.querySelector('button');
			expect(closeBtn).not.toBeNull();

			// Track removeEventListener calls
			const removeSpy = jest.spyOn(closeBtn!, 'removeEventListener');

			// Close the modal
			modal.close();

			// Assert - button should have had removeEventListener called for 'click'
			const clickRemoves = removeSpy.mock.calls.filter(
				(call: [string, EventListener]) => call[0] === 'click'
			);
			expect(clickRemoves.length).toBe(1);
		});
	});
});

describe('StatusBarManager modals - basic functionality', () => {
	let mockApp: App;

	beforeEach(() => {
		document.body.innerHTML = '';
		mockApp = new App();
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	describe('OrphanedResponseModal', () => {
		it('should display response content when opened', () => {
			const modal = new OrphanedResponseModal(
				mockApp,
				'Test response content',
				'Test command',
				jest.fn()
			);

			modal.open();

			const responseEl = modal.contentEl.querySelector('.claude-orphaned-response');
			expect(responseEl).not.toBeNull();
			expect(responseEl!.textContent).toBe('Test response content');
		});

		it('should display original command when provided', () => {
			const modal = new OrphanedResponseModal(
				mockApp,
				'Response',
				'Original command text',
				jest.fn()
			);

			modal.open();

			const commandEl = modal.contentEl.querySelector('.claude-orphaned-command');
			expect(commandEl).not.toBeNull();
			expect(commandEl!.textContent).toBe('Original command text');
		});

		it('should have Copy and Dismiss buttons', () => {
			const modal = new OrphanedResponseModal(mockApp, 'Response', undefined, jest.fn());

			modal.open();

			const buttons = modal.contentEl.querySelectorAll('button');
			expect(buttons.length).toBe(2);
			expect(buttons[0].textContent).toBe('Copy to Clipboard');
			expect(buttons[1].textContent).toBe('Dismiss');
		});
	});

	describe('ProcessingDetailsModal', () => {
		it('should display processing message when opened', () => {
			const modal = new ProcessingDetailsModal(mockApp);

			modal.open();

			const text = modal.contentEl.textContent;
			expect(text).toContain('Claude is currently processing');
		});

		it('should have a Close button', () => {
			const modal = new ProcessingDetailsModal(mockApp);

			modal.open();

			const button = modal.contentEl.querySelector('button');
			expect(button).not.toBeNull();
			expect(button!.textContent).toBe('Close');
		});
	});
});
