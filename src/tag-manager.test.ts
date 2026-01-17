/**
 * Unit tests for TagManager
 * Issue #16: Performance - Tag search bounds hardcoded
 */

import { TagManager } from './tag-manager';

// Mock editor for testing
const createMockEditor = (content: string) => {
	let docContent = content;
	return {
		getValue: () => docContent,
		getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
		replaceSelection: jest.fn((text: string) => {
			docContent = text;
		}),
		replaceRange: jest.fn((text: string, from: any, to?: any) => {
			const lines = docContent.split('\n');
			// Simple implementation for testing
			if (to) {
				const beforeLines = lines.slice(0, from.line);
				const afterLines = lines.slice(to.line + 1);
				docContent = [...beforeLines, text, ...afterLines].join('\n');
			}
		}),
	} as any;
};

describe('TagManager', () => {
	describe('findTags', () => {
		it('should find a simple callout', () => {
			const content = `Some text
> [!claude-processing]
> Content here
More text`;
			const editor = createMockEditor(content);
			const tagManager = new TagManager();

			const result = tagManager.findTags(editor, { line: 1, ch: 0 });

			expect(result.found).toBe(true);
			expect(result.startPos?.line).toBe(1);
			expect(result.endPos?.line).toBe(2);
		});

		it('should find callout content', () => {
			const content = `> [!claude-processing]
> Selected text here`;
			const editor = createMockEditor(content);
			const tagManager = new TagManager();

			const result = tagManager.findTags(editor, { line: 0, ch: 0 });

			expect(result.found).toBe(true);
			expect(result.content).toBe('Selected text here');
		});
	});
});

/**
 * Issue #16: Performance - Tag search bounds hardcoded
 *
 * Problem: The search for callout end uses hardcoded bounds (openLineNum + 50)
 * which could cause UI stutter on very large documents if callout parsing
 * fails or encounters edge cases.
 */
describe('Issue #16: Tag search bounds', () => {
	it('should have configurable search bounds', () => {
		const tagManager = new TagManager();

		// TagManager should expose configurable bounds via searchConfig
		expect(tagManager.searchConfig).toBeDefined();
		expect(typeof tagManager.searchConfig.searchLinesBefore).toBe('number');
		expect(typeof tagManager.searchConfig.searchLinesAfter).toBe('number');
	});

	it('should accept custom search config', () => {
		const customConfig = { searchLinesBefore: 10, searchLinesAfter: 30 };
		const tagManager = new TagManager(customConfig);

		expect(tagManager.searchConfig.searchLinesBefore).toBe(10);
		expect(tagManager.searchConfig.searchLinesAfter).toBe(30);
	});

	it('should handle callouts longer than 50 lines', () => {
		// Create a callout with more than 50 lines of content
		const contentLines = Array(60).fill('> Line of content');
		const content = `> [!claude-processing]
${contentLines.join('\n')}
End of document`;

		const editor = createMockEditor(content);
		const tagManager = new TagManager();

		const result = tagManager.findTags(editor, { line: 0, ch: 0 });

		// EXPECTED: Should find the entire callout (all 60+ lines)
		// CURRENT BEHAVIOR: Only finds up to 50 lines due to hardcoded bound
		expect(result.found).toBe(true);
		expect(result.endPos?.line).toBe(60); // Should be line 60 (0-indexed: header + 60 content lines)
	});

	it('should early exit for malformed callouts instead of scanning 50 lines', () => {
		// A document where the callout is immediately followed by non-callout content
		// No need to scan 50 lines - should stop as soon as it finds non-> line
		const content = `> [!claude-processing]
> Short content
Not a callout line
More regular text
Even more text`;

		const editor = createMockEditor(content);
		const tagManager = new TagManager();

		const result = tagManager.findTags(editor, { line: 0, ch: 0 });

		expect(result.found).toBe(true);
		// Callout should end at line 1 (the "> Short content" line)
		expect(result.endPos?.line).toBe(1);
	});

	it('should handle empty callouts efficiently', () => {
		// Empty callout - should immediately stop
		const content = `> [!claude-processing]
Regular text immediately`;

		const editor = createMockEditor(content);
		const tagManager = new TagManager();

		const result = tagManager.findTags(editor, { line: 0, ch: 0 });

		expect(result.found).toBe(true);
		// Empty callout ends at the header line
		expect(result.endPos?.line).toBe(0);
	});
});
