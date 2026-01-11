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

export class Plugin {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	addStatusBarItem(): HTMLElement {
		const el = document.createElement('div');
		document.body.appendChild(el);
		return el;
	}
}

export class Modal {
	app: App;
	contentEl: HTMLElement;
	containerEl: HTMLElement;

	constructor(app: App) {
		this.app = app;
		this.containerEl = document.createElement('div');
		this.contentEl = document.createElement('div');
		this.containerEl.appendChild(this.contentEl);
	}

	open(): void {
		document.body.appendChild(this.containerEl);
		this.onOpen();
	}

	close(): void {
		this.onClose();
		if (this.containerEl.parentNode) {
			this.containerEl.parentNode.removeChild(this.containerEl);
		}
	}

	onOpen(): void {
		// Override in subclass
	}

	onClose(): void {
		// Override in subclass
	}
}
