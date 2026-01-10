/**
 * Tag manager for injecting and managing Claude admonitions in documents
 * Uses Admonitions plugin format: ```ad-type
 */

import { Editor } from 'obsidian';
import { ActiveRequest, DocumentPosition } from './types';
import { logger } from './logger';

// Callout type for processing (uses > [!type] format)
const CALLOUT_PROCESSING = 'claude-processing';

// Admonition types for response/error (uses ```ad-type format)
const ADMONITION_RESPONSE = 'claude';
const ADMONITION_ERROR = 'claude-error';

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
 * Helper to convert text to callout format (for processing state)
 */
function toCallout(type: string, content: string): string {
	const lines = content.split('\n');
	const calloutLines = lines.map(line => `> ${line}`);
	return `> [!${type}]\n${calloutLines.join('\n')}`;
}

/**
 * Helper to convert text to admonition format (for response/error)
 */
function toAdmonition(type: string, content: string): string {
	return `\`\`\`ad-${type}\n${content}\n\`\`\``;
}

/**
 * Manages admonition injection and response replacement in documents
 */
export class TagManager {
	constructor() {
		logger.info('[TagManager] Initialized');
	}

	/**
	 * Inject Claude processing callout at the current selection or cursor position
	 * Returns the positions of the injected callout
	 */
	injectTags(editor: Editor, selectedText: string): TagInjectionResult {
		logger.info('[TagManager] Injecting processing callout...');
		logger.debug('[TagManager] Selected text length:', selectedText.length);

		try {
			const hasSelection = selectedText.length > 0;
			const from = editor.getCursor('from');

			// Create the callout content (processing uses callout format)
			const content = hasSelection ? selectedText : '';
			const callout = toCallout(CALLOUT_PROCESSING, content);

			const startPos = { line: from.line, ch: from.ch };

			// Replace selection or insert at cursor
			if (hasSelection) {
				editor.replaceSelection(callout);
			} else {
				editor.replaceRange(callout, from);
			}

			// Calculate end position after insertion
			const lines = callout.split('\n');
			const endPos = {
				line: from.line + lines.length - 1,
				ch: lines[lines.length - 1].length
			};

			logger.info('[TagManager] Processing callout injected:', { startPos, endPos });

			return {
				success: true,
				startPos,
				endPos,
			};
		} catch (error) {
			logger.error('[TagManager] Failed to inject processing callout:', error);
			return {
				success: false,
				startPos: { line: 0, ch: 0 },
				endPos: { line: 0, ch: 0 },
				error: (error as Error).message,
			};
		}
	}

	/**
	 * Find Claude processing callout in the document
	 * Returns the position of the callout or null if not found
	 */
	findTags(editor: Editor, expectedStartPos: DocumentPosition): {
		found: boolean;
		startPos?: DocumentPosition;
		endPos?: DocumentPosition;
		content?: string;
	} {
		logger.debug('[TagManager] Searching for processing callout near:', expectedStartPos);

		const docContent = editor.getValue();
		const lines = docContent.split('\n');

		// Search in a range around the expected position
		const searchStartLine = Math.max(0, expectedStartPos.line - 5);
		const searchEndLine = Math.min(lines.length, expectedStartPos.line + 20);

		// Find the opening callout line: > [!claude-processing]
		const calloutHeader = `> [!${CALLOUT_PROCESSING}]`;
		let openLineNum = -1;
		let openCh = 0;
		for (let lineNum = searchStartLine; lineNum < searchEndLine; lineNum++) {
			const line = lines[lineNum];
			const openIdx = line.indexOf(calloutHeader);
			if (openIdx >= 0) {
				openLineNum = lineNum;
				openCh = openIdx;
				break;
			}
		}

		if (openLineNum === -1) {
			logger.warn('[TagManager] Processing callout not found');
			return { found: false };
		}

		// Find the end of the callout (first line that doesn't start with ">")
		let closeLineNum = openLineNum;
		for (let lineNum = openLineNum + 1; lineNum < Math.min(lines.length, openLineNum + 50); lineNum++) {
			const line = lines[lineNum];
			// Callout continues as long as line starts with ">"
			if (!line.startsWith('>')) {
				break;
			}
			closeLineNum = lineNum;
		}

		// Extract content from callout
		const calloutLines = lines.slice(openLineNum, closeLineNum + 1);
		const contentLines = calloutLines.slice(1).map(line => line.replace(/^>\s?/, ''));
		const content = contentLines.join('\n');

		const startPos = { line: openLineNum, ch: openCh };
		const endPos = { line: closeLineNum, ch: lines[closeLineNum].length };

		logger.debug('[TagManager] Processing callout found:', { startPos, endPos });

		return {
			found: true,
			startPos,
			endPos,
			content,
		};
	}

	/**
	 * Replace processing callout with response admonition
	 */
	replaceWithResponse(
		editor: Editor,
		request: ActiveRequest,
		response: string
	): boolean {
		logger.info('[TagManager] Replacing callout with response...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Callout not found, cannot replace');
			return false;
		}

		try {
			// Build replacement: original text + response admonition
			const originalText = request.originalText;
			const responseAdmonition = toAdmonition(ADMONITION_RESPONSE, response);
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n\n${responseAdmonition}`;
			} else {
				replacement = responseAdmonition;
			}

			// Replace the entire admonition region
			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Response admonition injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to replace admonition:', error);
			return false;
		}
	}

	/**
	 * Replace processing callout with error admonition
	 */
	injectError(
		editor: Editor,
		request: ActiveRequest,
		errorMessage: string
	): boolean {
		logger.info('[TagManager] Injecting error admonition...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Callout not found, cannot inject error');
			return false;
		}

		try {
			// Build replacement: original text + error admonition
			const originalText = request.originalText;
			const errorAdmonition = toAdmonition(ADMONITION_ERROR, errorMessage);
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n\n${errorAdmonition}`;
			} else {
				replacement = errorAdmonition;
			}

			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Error admonition injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to inject error admonition:', error);
			return false;
		}
	}

	/**
	 * Check if processing callout is still intact (not modified by user)
	 */
	areTagsIntact(editor: Editor, request: ActiveRequest): boolean {
		const tagSearch = this.findTags(editor, request.tagStartPos);
		return tagSearch.found;
	}

	/**
	 * Remove callout and restore original text
	 */
	removeTags(editor: Editor, request: ActiveRequest): boolean {
		logger.info('[TagManager] Removing callout...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Callout not found, nothing to remove');
			return false;
		}

		try {
			editor.replaceRange(
				request.originalText,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Callout removed successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to remove callout:', error);
			return false;
		}
	}
}
