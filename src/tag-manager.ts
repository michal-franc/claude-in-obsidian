/**
 * Tag manager for injecting and managing Claude tags in documents
 */

import { Editor } from 'obsidian';
import { ActiveRequest, DocumentPosition } from './types';
import { logger } from './logger';

const CLAUDE_TAG_OPEN = '=== CLAUDE PROCESSING ===';
const CLAUDE_TAG_CLOSE = '=== END CLAUDE ===';
const CLAUDE_RESPONSE_START = '```ad-claude';
const CLAUDE_RESPONSE_END = '```';

/**
 * Result of tag injection
 */
export interface TagInjectionResult {
	success: boolean;
	startPos: DocumentPosition;
	endPos: DocumentPosition;
	error?: string;
}

/**
 * Manages tag injection and response replacement in documents
 */
export class TagManager {
	constructor() {
		logger.info('[TagManager] Initialized');
	}

	/**
	 * Inject Claude tags at the current selection or cursor position
	 * Returns the positions of the injected tags
	 */
	injectTags(editor: Editor, selectedText: string): TagInjectionResult {
		logger.info('[TagManager] Injecting tags...');
		logger.debug('[TagManager] Selected text length:', selectedText.length);

		try {
			const cursor = editor.getCursor();
			const hasSelection = selectedText.length > 0;

			let taggedContent: string;
			let startPos: DocumentPosition;
			let endPos: DocumentPosition;

			if (hasSelection) {
				// Wrap selected text with tags on separate lines
				taggedContent = `${CLAUDE_TAG_OPEN}\n${selectedText}\n${CLAUDE_TAG_CLOSE}`;

				// Get selection boundaries
				const from = editor.getCursor('from');

				startPos = { line: from.line, ch: from.ch };

				// Replace selection with tagged content
				editor.replaceSelection(taggedContent);

				// Calculate end position after insertion
				const lines = taggedContent.split('\n');
				endPos = {
					line: from.line + lines.length - 1,
					ch: lines[lines.length - 1].length
				};
			} else {
				// No selection - insert tags at cursor with empty line between
				taggedContent = `${CLAUDE_TAG_OPEN}\n\n${CLAUDE_TAG_CLOSE}`;
				startPos = { line: cursor.line, ch: cursor.ch };

				// Insert at cursor
				editor.replaceRange(taggedContent, cursor);

				const lines = taggedContent.split('\n');
				endPos = {
					line: cursor.line + lines.length - 1,
					ch: lines[lines.length - 1].length
				};
			}

			logger.info('[TagManager] Tags injected:', { startPos, endPos });

			return {
				success: true,
				startPos,
				endPos,
			};
		} catch (error) {
			logger.error('[TagManager] Failed to inject tags:', error);
			return {
				success: false,
				startPos: { line: 0, ch: 0 },
				endPos: { line: 0, ch: 0 },
				error: (error as Error).message,
			};
		}
	}

	/**
	 * Find Claude tags in the document
	 * Returns the position of the tags or null if not found
	 */
	findTags(editor: Editor, expectedStartPos: DocumentPosition): {
		found: boolean;
		startPos?: DocumentPosition;
		endPos?: DocumentPosition;
		content?: string;
	} {
		logger.debug('[TagManager] Searching for tags near:', expectedStartPos);

		const docContent = editor.getValue();
		const lines = docContent.split('\n');

		// Search in a range around the expected position
		const searchStartLine = Math.max(0, expectedStartPos.line - 5);
		const searchEndLine = Math.min(lines.length, expectedStartPos.line + 20);

		// Find the opening tag line
		let openLineNum = -1;
		let openCh = 0;
		for (let lineNum = searchStartLine; lineNum < searchEndLine; lineNum++) {
			const line = lines[lineNum];
			const openIdx = line.indexOf(CLAUDE_TAG_OPEN);
			if (openIdx >= 0) {
				openLineNum = lineNum;
				openCh = openIdx;
				break;
			}
		}

		if (openLineNum === -1) {
			logger.warn('[TagManager] Opening tag not found');
			return { found: false };
		}

		// Find the closing tag line (search from after opening tag)
		let closeLineNum = -1;
		let closeCh = 0;
		for (let lineNum = openLineNum + 1; lineNum < Math.min(lines.length, openLineNum + 50); lineNum++) {
			const line = lines[lineNum];
			const closeIdx = line.indexOf(CLAUDE_TAG_CLOSE);
			if (closeIdx >= 0) {
				closeLineNum = lineNum;
				closeCh = closeIdx + CLAUDE_TAG_CLOSE.length;
				break;
			}
		}

		if (closeLineNum === -1) {
			logger.warn('[TagManager] Closing tag not found');
			return { found: false };
		}

		// Extract content between tags (excluding the tag lines themselves)
		const contentLines = lines.slice(openLineNum + 1, closeLineNum);
		const content = contentLines.join('\n');

		const startPos = { line: openLineNum, ch: openCh };
		const endPos = { line: closeLineNum, ch: closeCh };

		logger.debug('[TagManager] Tags found:', { startPos, endPos });

		return {
			found: true,
			startPos,
			endPos,
			content,
		};
	}

	/**
	 * Replace tags with response (keeps original text, wraps response in admonition)
	 */
	replaceWithResponse(
		editor: Editor,
		request: ActiveRequest,
		response: string
	): boolean {
		logger.info('[TagManager] Replacing tags with response...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Tags not found, cannot replace');
			return false;
		}

		try {
			// Build the replacement text:
			// original text
			// ```ad-claude
			// response
			// ```
			const originalText = request.originalText;
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n${CLAUDE_RESPONSE_START}\n${response}\n${CLAUDE_RESPONSE_END}`;
			} else {
				replacement = `${CLAUDE_RESPONSE_START}\n${response}\n${CLAUDE_RESPONSE_END}`;
			}

			// Replace the entire tagged region
			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Response injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to replace tags:', error);
			return false;
		}
	}

	/**
	 * Inject error message inside the tags
	 */
	injectError(
		editor: Editor,
		request: ActiveRequest,
		errorMessage: string
	): boolean {
		logger.info('[TagManager] Injecting error into tags...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Tags not found, cannot inject error');
			return false;
		}

		try {
			// Keep original text and add error in admonition
			const originalText = request.originalText;
			const errorContent = `**Error:** ${errorMessage}`;
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n${CLAUDE_RESPONSE_START}\n${errorContent}\n${CLAUDE_RESPONSE_END}`;
			} else {
				replacement = `${CLAUDE_RESPONSE_START}\n${errorContent}\n${CLAUDE_RESPONSE_END}`;
			}

			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Error injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to inject error:', error);
			return false;
		}
	}

	/**
	 * Check if tags are still intact (not modified by user)
	 */
	areTagsIntact(editor: Editor, request: ActiveRequest): boolean {
		const tagSearch = this.findTags(editor, request.tagStartPos);
		return tagSearch.found;
	}

	/**
	 * Remove tags without adding response (cleanup)
	 */
	removeTags(editor: Editor, request: ActiveRequest): boolean {
		logger.info('[TagManager] Removing tags...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Tags not found, nothing to remove');
			return false;
		}

		try {
			// Just restore the original text
			editor.replaceRange(
				request.originalText,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Tags removed successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to remove tags:', error);
			return false;
		}
	}
}
