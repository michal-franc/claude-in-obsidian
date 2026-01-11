/**
 * Unit tests for SkillManager
 */

import { parseFrontmatter, isValidSkillFolder, SKILL_NAME_FILTER } from './skill-manager';

describe('parseFrontmatter', () => {
	it('should parse valid frontmatter with name and description', () => {
		const content = `---
name: Test Skill
description: A test skill
---

This is the template body.

{{selection}}`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe('Test Skill');
		expect(result.frontmatter.description).toBe('A test skill');
		expect(result.body).toBe('This is the template body.\n\n{{selection}}');
	});

	it('should parse frontmatter with only name', () => {
		const content = `---
name: Simple Skill
---

Body content here.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe('Simple Skill');
		expect(result.frontmatter.description).toBeUndefined();
		expect(result.body).toBe('Body content here.');
	});

	it('should return empty frontmatter and full body when no frontmatter present', () => {
		const content = 'Just some content without frontmatter.';

		const result = parseFrontmatter(content);

		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe('Just some content without frontmatter.');
	});

	it('should handle frontmatter with colons in values', () => {
		const content = `---
name: Skill: With Colon
description: This has: a colon too
---

Body`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe('Skill: With Colon');
		expect(result.frontmatter.description).toBe('This has: a colon too');
	});

	it('should handle empty body', () => {
		const content = `---
name: Empty Body Skill
---

`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe('Empty Body Skill');
		expect(result.body).toBe('');
	});

	it('should handle multiline body with {{selection}} placeholder', () => {
		const content = `---
name: Improve Writing
description: Improve text clarity
---

Please improve the following text:

{{selection}}

Make it clearer and more concise.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe('Improve Writing');
		expect(result.body).toContain('{{selection}}');
		expect(result.body).toContain('Please improve the following text:');
		expect(result.body).toContain('Make it clearer and more concise.');
	});
});

describe('isValidSkillFolder', () => {
	it('should return true for folder with exact filter name', () => {
		expect(isValidSkillFolder('claude-in-obsidian')).toBe(true);
	});

	it('should return true for folder with filter as prefix', () => {
		expect(isValidSkillFolder('claude-in-obsidian-improve')).toBe(true);
	});

	it('should return true for folder with filter as suffix', () => {
		expect(isValidSkillFolder('improve-claude-in-obsidian')).toBe(true);
	});

	it('should return true for folder with filter in middle', () => {
		expect(isValidSkillFolder('my-claude-in-obsidian-skill')).toBe(true);
	});

	it('should be case insensitive', () => {
		expect(isValidSkillFolder('Claude-In-Obsidian-Improve')).toBe(true);
		expect(isValidSkillFolder('CLAUDE-IN-OBSIDIAN-FIX')).toBe(true);
	});

	it('should return false for folder without filter', () => {
		expect(isValidSkillFolder('improve-writing')).toBe(false);
	});

	it('should return false for similar but not matching names', () => {
		expect(isValidSkillFolder('claude-obsidian')).toBe(false);
		expect(isValidSkillFolder('claude-in')).toBe(false);
		expect(isValidSkillFolder('in-obsidian')).toBe(false);
	});

	it('should return false for empty string', () => {
		expect(isValidSkillFolder('')).toBe(false);
	});

	it('should return false for unrelated folder names', () => {
		expect(isValidSkillFolder('fix-grammar')).toBe(false);
		expect(isValidSkillFolder('summarize')).toBe(false);
		expect(isValidSkillFolder('my-other-skill')).toBe(false);
	});
});

describe('SKILL_NAME_FILTER constant', () => {
	it('should be claude-in-obsidian', () => {
		expect(SKILL_NAME_FILTER).toBe('claude-in-obsidian');
	});
});

/**
 * Issue #14: Performance - Skill loading is synchronous and not optimized
 *
 * Problem: Skills are loaded synchronously at plugin startup, which can delay
 * plugin load time if there are many skill folders. Each skill folder causes
 * multiple filesystem operations (exists, list, read).
 *
 * Fix: Implement lazy loading where skills are loaded on first access, not at startup.
 * Also add caching to avoid redundant filesystem calls on subsequent loadSkills() calls.
 */
describe('Issue #14: SkillManager lazy loading', () => {
	// Mock the App and adapter for testing SkillManager
	const createMockAdapter = () => ({
		exists: jest.fn(),
		list: jest.fn(),
		read: jest.fn(),
	});

	const createMockApp = (adapter: ReturnType<typeof createMockAdapter>) => ({
		vault: { adapter }
	} as any);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should not load skills during construction', async () => {
		const mockAdapter = createMockAdapter();
		const mockApp = createMockApp(mockAdapter);

		const { SkillManager } = await import('./skill-manager');

		// Create the skill manager
		new SkillManager(mockApp);

		// EXPECTED: No filesystem calls during construction
		expect(mockAdapter.exists).not.toHaveBeenCalled();
		expect(mockAdapter.list).not.toHaveBeenCalled();
		expect(mockAdapter.read).not.toHaveBeenCalled();
	});

	it('should cache skills after loadSkills() - second call should not hit filesystem', async () => {
		const mockAdapter = createMockAdapter();
		mockAdapter.exists.mockResolvedValue(true);
		mockAdapter.list.mockResolvedValue({
			folders: ['.claude/skills/claude-in-obsidian-skill1'],
			files: []
		});
		mockAdapter.read.mockResolvedValue(`---
name: Cached Skill
---

Template`);

		const mockApp = createMockApp(mockAdapter);

		const { SkillManager } = await import('./skill-manager');
		const manager = new SkillManager(mockApp);

		// First load - should hit filesystem
		await manager.loadSkills();
		const existsCallsAfterFirst = mockAdapter.exists.mock.calls.length;
		expect(existsCallsAfterFirst).toBeGreaterThan(0);

		// Reset mock call counts
		mockAdapter.exists.mockClear();
		mockAdapter.list.mockClear();
		mockAdapter.read.mockClear();

		// Second call to loadSkills() - should use cache (no new filesystem calls)
		await manager.loadSkills();

		// EXPECTED AFTER FIX: No new filesystem calls (using cache)
		// CURRENT BEHAVIOR: loadSkills() re-reads everything
		// This test will FAIL with current implementation
		expect(mockAdapter.exists).not.toHaveBeenCalled();
		expect(mockAdapter.list).not.toHaveBeenCalled();
		expect(mockAdapter.read).not.toHaveBeenCalled();
	});

	it('should provide ensureLoaded() for async initialization', async () => {
		const mockAdapter = createMockAdapter();
		mockAdapter.exists.mockResolvedValue(true);
		mockAdapter.list.mockResolvedValue({
			folders: ['.claude/skills/claude-in-obsidian-test'],
			files: []
		});
		mockAdapter.read.mockResolvedValue(`---
name: Test Skill
---

Body`);

		const mockApp = createMockApp(mockAdapter);

		const { SkillManager } = await import('./skill-manager');
		const manager = new SkillManager(mockApp);

		// EXPECTED AFTER FIX: ensureLoaded() should exist for explicit async loading
		// This allows callers to ensure skills are loaded before calling getSkills()
		expect(typeof (manager as any).ensureLoaded).toBe('function');

		// After ensureLoaded(), getSkills() should return skills without warning
		await (manager as any).ensureLoaded();
		const skills = manager.getSkills();
		expect(skills.length).toBe(1);
		expect(skills[0].name).toBe('Test Skill');
	});
});
