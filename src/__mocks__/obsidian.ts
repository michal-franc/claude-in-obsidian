/**
 * Mock for Obsidian module - used in tests
 */

export class TFolder {
	path: string;
	name: string;
	children: (TFolder | TFile)[] = [];

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
	}
}

export class TFile {
	path: string;
	name: string;

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
	}
}

export class App {
	vault = {
		getAbstractFileByPath: jest.fn(),
		read: jest.fn(),
		adapter: {
			exists: jest.fn(),
			list: jest.fn(),
			read: jest.fn(),
		},
	};
}

/**
 * Mock HTMLElement for status bar testing
 */
export function createMockHTMLElement(): HTMLElement {
	const listeners: Map<string, Function[]> = new Map();

	const element = {
		addEventListener: jest.fn((event: string, handler: Function) => {
			if (!listeners.has(event)) {
				listeners.set(event, []);
			}
			listeners.get(event)!.push(handler);
		}),
		removeEventListener: jest.fn((event: string, handler: Function) => {
			const handlers = listeners.get(event);
			if (handlers) {
				const index = handlers.indexOf(handler);
				if (index > -1) {
					handlers.splice(index, 1);
				}
			}
		}),
		addClass: jest.fn(),
		removeClass: jest.fn(),
		setText: jest.fn(),
		empty: jest.fn(),
		remove: jest.fn(),
		// Expose listeners for testing
		_listeners: listeners,
	};

	return element as unknown as HTMLElement;
}

export class Plugin {
	app: App;
	private statusBarItems: HTMLElement[] = [];

	constructor(app: App) {
		this.app = app;
	}

	addStatusBarItem(): HTMLElement {
		const element = createMockHTMLElement();
		this.statusBarItems.push(element);
		return element;
	}
}

export class Modal {
	app: App;
	contentEl = {
		empty: jest.fn(),
		addClass: jest.fn(),
		createEl: jest.fn(),
		createDiv: jest.fn(),
	};

	constructor(app: App) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}
