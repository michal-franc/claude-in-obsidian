/**
 * Unit tests for InlinePrompt
 * Issue #7: Memory leak - Skill button event listeners not cleaned up
 *
 * @jest-environment jsdom
 */

import { InlinePrompt } from './inline-prompt';
import { Skill } from './types';

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
	// addClass - Obsidian's method to add CSS classes
	HTMLElement.prototype.addClass = function (cls: string) {
		this.classList.add(cls);
	};

	// createDiv - Obsidian's helper to create child div
	HTMLElement.prototype.createDiv = function (options?: { cls?: string; text?: string }) {
		const div = document.createElement('div');
		if (options?.cls) div.className = options.cls;
		if (options?.text) div.textContent = options.text;
		this.appendChild(div);
		return div;
	};

	// createSpan - Obsidian's helper to create child span
	HTMLElement.prototype.createSpan = function (options?: { cls?: string; text?: string }) {
		const span = document.createElement('span');
		if (options?.cls) span.className = options.cls;
		if (options?.text) span.textContent = options.text;
		this.appendChild(span);
		return span;
	};

	// createEl - Obsidian's helper to create child element
	HTMLElement.prototype.createEl = function (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
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

	// setText - Obsidian's helper to set text content
	HTMLElement.prototype.setText = function (text: string) {
		this.textContent = text;
	};

	// empty - Obsidian's helper to clear contents
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
		createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
		createSpan(options?: { cls?: string; text?: string }): HTMLSpanElement;
		createEl(tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }): HTMLElement;
		setText(text: string): void;
		empty(): void;
	}
}

// Create mock objects for Obsidian components
function createMockEditor() {
	return {
		getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
		posToOffset: jest.fn().mockReturnValue(0),
		cm: {
			coordsAtPos: jest.fn().mockReturnValue({ left: 100, top: 100, bottom: 120 }),
		},
	};
}

function createMockView() {
	return {
		containerEl: {
			ownerDocument: document,
		},
	};
}

function createMockApp() {
	return {};
}

describe('Issue #7: Memory leak - Skill button event listeners not cleaned up', () => {
	let inlinePrompt: InlinePrompt;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockView: ReturnType<typeof createMockView>;
	let mockEditor: ReturnType<typeof createMockEditor>;
	let onSubmitMock: jest.Mock;

	beforeEach(() => {
		// Clear document body
		document.body.innerHTML = '';

		mockApp = createMockApp();
		mockView = createMockView();
		mockEditor = createMockEditor();
		onSubmitMock = jest.fn();

		inlinePrompt = new InlinePrompt(
			mockApp as any,
			mockView as any,
			mockEditor as any,
			'test selection',
			onSubmitMock
		);
	});

	afterEach(() => {
		// Clean up any remaining DOM elements
		document.body.innerHTML = '';
	});

	it('should remove event listeners on skill buttons when hide() is called - currently failing', () => {
		// Arrange
		const skills: Skill[] = [
			{ name: 'Skill 1', template: 'Template 1 {{selection}}' },
			{ name: 'Skill 2', template: 'Template 2 {{selection}}' },
			{ name: 'Skill 3', template: 'Template 3 {{selection}}' },
		];

		// Show the prompt and add skill buttons
		inlinePrompt.show();
		inlinePrompt.addSkillButtons(skills);

		// Get all skill buttons
		const skillButtons = document.querySelectorAll('.claude-skill-button');
		expect(skillButtons.length).toBe(3);

		// Track addEventListener and removeEventListener calls on each button
		const addListenerSpies: jest.SpyInstance[] = [];
		const removeListenerSpies: jest.SpyInstance[] = [];

		skillButtons.forEach((btn) => {
			// Create spies for each button
			const addSpy = jest.spyOn(btn, 'addEventListener');
			const removeSpy = jest.spyOn(btn, 'removeEventListener');
			addListenerSpies.push(addSpy);
			removeListenerSpies.push(removeSpy);
		});

		// Act - hide the prompt
		inlinePrompt.hide();

		// Assert - each button should have had removeEventListener called for 'click'
		// This test is expected to FAIL because the current implementation doesn't remove
		// event listeners from skill buttons
		let removeClickCalls = 0;
		removeListenerSpies.forEach((spy) => {
			const clickCalls = spy.mock.calls.filter(
				(call: [string, EventListener]) => call[0] === 'click'
			);
			removeClickCalls += clickCalls.length;
		});

		// We expect 3 removeEventListener('click', ...) calls - one per button
		expect(removeClickCalls).toBe(3);
	});

	it('should properly track skill button click handlers for cleanup', () => {
		// Arrange
		const skills: Skill[] = [
			{ name: 'Test Skill', template: 'Hello {{selection}}' },
		];

		// Show and add skill buttons
		inlinePrompt.show();
		inlinePrompt.addSkillButtons(skills);

		const skillButton = document.querySelector('.claude-skill-button');
		expect(skillButton).not.toBeNull();

		// Spy on removeEventListener before hide()
		const removeSpy = jest.spyOn(skillButton!, 'removeEventListener');

		// Act
		inlinePrompt.hide();

		// Assert - we should see removeEventListener called for 'click'
		const clickRemoves = removeSpy.mock.calls.filter(
			(call: [string, EventListener]) => call[0] === 'click'
		);
		expect(clickRemoves.length).toBeGreaterThan(0);
	});
});

describe('InlinePrompt - basic functionality', () => {
	let inlinePrompt: InlinePrompt;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockView: ReturnType<typeof createMockView>;
	let mockEditor: ReturnType<typeof createMockEditor>;
	let onSubmitMock: jest.Mock;

	beforeEach(() => {
		document.body.innerHTML = '';
		mockApp = createMockApp();
		mockView = createMockView();
		mockEditor = createMockEditor();
		onSubmitMock = jest.fn();

		inlinePrompt = new InlinePrompt(
			mockApp as any,
			mockView as any,
			mockEditor as any,
			'test selection',
			onSubmitMock
		);
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('should create prompt container when show() is called', () => {
		inlinePrompt.show();

		const container = document.querySelector('.claude-inline-prompt');
		expect(container).not.toBeNull();
	});

	it('should remove prompt container when hide() is called', () => {
		inlinePrompt.show();
		inlinePrompt.hide();

		const container = document.querySelector('.claude-inline-prompt');
		expect(container).toBeNull();
	});

	it('should add skill buttons when addSkillButtons() is called', () => {
		const skills: Skill[] = [
			{ name: 'Skill A', template: 'Template A' },
			{ name: 'Skill B', template: 'Template B' },
		];

		inlinePrompt.show();
		inlinePrompt.addSkillButtons(skills);

		const buttons = document.querySelectorAll('.claude-skill-button');
		expect(buttons.length).toBe(2);
		expect(buttons[0].textContent).toBe('Skill A');
		expect(buttons[1].textContent).toBe('Skill B');
	});

	it('should call onSubmit with correct template when skill button is clicked', () => {
		const skills: Skill[] = [
			{ name: 'Test', template: 'Process: {{selection}}' },
		];

		inlinePrompt.show();
		inlinePrompt.addSkillButtons(skills);

		const button = document.querySelector('.claude-skill-button') as HTMLButtonElement;
		button.click();

		expect(onSubmitMock).toHaveBeenCalledWith('Process: test selection');
	});
});
