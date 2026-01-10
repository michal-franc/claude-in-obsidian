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
