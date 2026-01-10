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
