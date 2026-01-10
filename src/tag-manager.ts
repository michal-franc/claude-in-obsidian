/**
 * Tag manager for injecting and managing Claude callouts in documents
 * Uses Obsidian native callout format: > [!type]
 */

import { Editor } from 'obsidian';
import { ActiveRequest, DocumentPosition } from './types';
import { logger } from './logger';

// Obsidian native callout types
const CALLOUT_PROCESSING = 'claude-processing';
const CALLOUT_RESPONSE = 'claude';
const CALLOUT_ERROR = 'claude-error';

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
 * Helper to convert text to callout format
 * Each line must be prefixed with "> "
 */
function toCallout(type: string, content: string): string {
	const lines = content.split('\n');
	const calloutLines = lines.map(line => `> ${line}`);
	return `> [!${type}]\n${calloutLines.join('\n')}`;
}

/**
 * Helper to extract content from callout format
 * Removes "> " prefix from each line
 */
function fromCallout(calloutContent: string): string {
	const lines = calloutContent.split('\n');
	// Skip the first line (> [!type]) and strip "> " from remaining lines
	return lines
		.slice(1)
		.map(line => line.replace(/^>\s?/, ''))
		.join('\n');
}

/**
 * Manages callout injection and response replacement in documents
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

			// Create the callout content
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
			// Callout continues as long as line starts with ">" or is empty
			if (!line.startsWith('>') && line.trim() !== '') {
				break;
			}
			// If line starts with ">", it's part of the callout
			if (line.startsWith('>')) {
				closeLineNum = lineNum;
			}
		}

		// Extract content (the callout lines)
		const calloutLines = lines.slice(openLineNum, closeLineNum + 1);
		const content = fromCallout(calloutLines.join('\n'));

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
	 * Replace processing callout with response callout
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
			// Build replacement: original text + response callout
			const originalText = request.originalText;
			const responseCallout = toCallout(CALLOUT_RESPONSE, response);
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n\n${responseCallout}`;
			} else {
				replacement = responseCallout;
			}

			// Replace the entire callout region
			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Response callout injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to replace callout:', error);
			return false;
		}
	}

	/**
	 * Replace processing callout with error callout
	 */
	injectError(
		editor: Editor,
		request: ActiveRequest,
		errorMessage: string
	): boolean {
		logger.info('[TagManager] Injecting error callout...');

		const tagSearch = this.findTags(editor, request.tagStartPos);

		if (!tagSearch.found || !tagSearch.startPos || !tagSearch.endPos) {
			logger.warn('[TagManager] Callout not found, cannot inject error');
			return false;
		}

		try {
			// Build replacement: original text + error callout
			const originalText = request.originalText;
			const errorCallout = toCallout(CALLOUT_ERROR, errorMessage);
			let replacement: string;

			if (originalText.length > 0) {
				replacement = `${originalText}\n\n${errorCallout}`;
			} else {
				replacement = errorCallout;
			}

			editor.replaceRange(
				replacement,
				tagSearch.startPos,
				tagSearch.endPos
			);

			logger.info('[TagManager] Error callout injected successfully');
			return true;
		} catch (error) {
			logger.error('[TagManager] Failed to inject error callout:', error);
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
