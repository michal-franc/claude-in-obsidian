import { Plugin } from 'obsidian';

export default class ClaudeFromObsidianPlugin extends Plugin {
	async onload() {
		console.log('Loading Claude from Obsidian plugin');
	}

	onunload() {
		console.log('Unloading Claude from Obsidian plugin');
	}
}
