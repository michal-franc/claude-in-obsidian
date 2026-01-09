/**
 * Tag manager for injecting and managing Claude tags in documents
 */

import { Editor } from 'obsidian';
import { ActiveRequest, DocumentPosition } from './types';
import { logger } from './logger';

const CLAUDE_TAG_OPEN = '<CLAUDE Processing...>';
const CLAUDE_TAG_CLOSE = '</CLAUDE>';
const CLAUDE_SEPARATOR = '<!-- Claude -->';

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
				// Wrap selected text with tags
				taggedContent = `${CLAUDE_TAG_OPEN}${selectedText}${CLAUDE_TAG_CLOSE}`;

				// Get selection boundaries
				const from = editor.getCursor('from');
				const to = editor.getCursor('to');

				startPos = { line: from.line, ch: from.ch };

				// Replace selection with tagged content
				editor.replaceSelection(taggedContent);

				// Calculate end position after insertion
				const lines = taggedContent.split('\n');
				if (lines.length === 1) {
					endPos = { line: from.line, ch: from.ch + taggedContent.length };
				} else {
					endPos = {
						line: from.line + lines.length - 1,
						ch: lines[lines.length - 1].length
					};
				}
			} else {
				// No selection - insert empty tags at cursor
				taggedContent = `${CLAUDE_TAG_OPEN}${CLAUDE_TAG_CLOSE}`;
				startPos = { line: cursor.line, ch: cursor.ch };

				// Insert at cursor
				editor.replaceRange(taggedContent, cursor);

				endPos = { line: cursor.line, ch: cursor.ch + taggedContent.length };
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
		const searchEndLine = Math.min(lines.length, expectedStartPos.line + 10);

		for (let lineNum = searchStartLine; lineNum < searchEndLine; lineNum++) {
			const line = lines[lineNum];
			const openIdx = line.indexOf(CLAUDE_TAG_OPEN);

			if (openIdx >= 0) {
				// Found opening tag, now find closing tag
				const closeTagSearch = docContent.substring(
					docContent.split('\n').slice(0, lineNum).join('\n').length + openIdx
				);
				const closeIdx = closeTagSearch.indexOf(CLAUDE_TAG_CLOSE);

				if (closeIdx >= 0) {
					// Calculate positions
					const startPos = { line: lineNum, ch: openIdx };

					// Find end position
					const contentBeforeClose = closeTagSearch.substring(0, closeIdx + CLAUDE_TAG_CLOSE.length);
					const closeLines = contentBeforeClose.split('\n');
					const endLine = lineNum + closeLines.length - 1;
					const endCh = closeLines.length === 1
						? openIdx + contentBeforeClose.length
						: closeLines[closeLines.length - 1].length;

					// Extract content between tags
					const contentStart = openIdx + CLAUDE_TAG_OPEN.length;
					const fullContent = closeTagSearch.substring(
						CLAUDE_TAG_OPEN.length,
						closeIdx
					);

					logger.debug('[TagManager] Tags found:', { startPos, endPos: { line: endLine, ch: endCh } });

					return {
						found: true,
						startPos,
						endPos: { line: endLine, ch: endCh },
						content: fullContent,
					};
				}
			}
		}

		logger.warn('[TagManager] Tags not found near expected position');
		return { found: false };
	}

	/**
	 * Replace tags with response (keeps original text, adds separator and response)
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
			// <!-- Claude -->
			// response
			const originalText = request.originalText;
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n${CLAUDE_SEPARATOR}\n${response}`;
			} else {
				replacement = `${CLAUDE_SEPARATOR}\n${response}`;
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
			// Keep original text and add error
			const originalText = request.originalText;
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n${CLAUDE_SEPARATOR}\n**Error:** ${errorMessage}`;
			} else {
				replacement = `${CLAUDE_SEPARATOR}\n**Error:** ${errorMessage}`;
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
