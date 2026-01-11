/**
 * Skill Manager - Loads and manages skills from .claude/skills/
 * Feature 003: Shared Skills
 */

import { App } from 'obsidian';
import { Skill } from './types';
import { logger } from './logger';

const SKILLS_FOLDER = '.claude/skills';
const SKILL_FILE = 'SKILL.md';
const MAX_SKILLS = 3;
export const SKILL_NAME_FILTER = 'claude-in-obsidian';

/**
 * Check if a folder name matches the skill filter
 * Exported for testing
 */
export function isValidSkillFolder(folderName: string): boolean {
	return folderName.toLowerCase().includes(SKILL_NAME_FILTER);
}

/**
 * Parses YAML frontmatter from a SKILL.md file
 * Exported for testing
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const frontmatterStr = match[1];
	const body = match[2].trim();

	// Simple YAML parsing (key: value pairs)
	const frontmatter: Record<string, string> = {};
	for (const line of frontmatterStr.split('\n')) {
		const colonIdx = line.indexOf(':');
		if (colonIdx > 0) {
			const key = line.substring(0, colonIdx).trim();
			const value = line.substring(colonIdx + 1).trim();
			frontmatter[key] = value;
		}
	}

	return { frontmatter, body };
}

/**
 * Manages loading skills from the vault's .claude/skills/ folder
 */
export class SkillManager {
	private app: App;
	private skills: Skill[] = [];
	private loaded: boolean = false;

	constructor(app: App) {
		this.app = app;
		logger.info('[SkillManager] Initialized');
	}

	/**
	 * Ensure skills are loaded (lazy loading).
	 * Call this before getSkills() if you need to wait for skills to be ready.
	 * Uses caching - only loads from filesystem once.
	 */
	async ensureLoaded(): Promise<void> {
		if (this.loaded) {
			logger.debug('[SkillManager] Skills already loaded (cached)');
			return;
		}
		await this.loadSkillsFromFilesystem();
	}

	/**
	 * Load skills from .claude/skills/ folder (uses cache if already loaded)
	 * Uses adapter API to access hidden folders that aren't indexed by vault
	 * Call this on plugin startup
	 */
	async loadSkills(): Promise<void> {
		if (this.loaded) {
			logger.debug('[SkillManager] Skills already loaded (cached), skipping reload');
			return;
		}
		await this.loadSkillsFromFilesystem();
	}

	/**
	 * Internal method to load skills from filesystem
	 * Always reads from disk, used by loadSkills() and reloadSkills()
	 */
	private async loadSkillsFromFilesystem(): Promise<void> {
		logger.info('[SkillManager] Loading skills from filesystem...');
		this.skills = [];

		const adapter = this.app.vault.adapter;

		// Check if skills folder exists using adapter (works with hidden folders)
		const folderExists = await adapter.exists(SKILLS_FOLDER);
		if (!folderExists) {
			logger.debug('[SkillManager] Skills folder not found:', SKILLS_FOLDER);
			this.loaded = true;
			return;
		}

		try {
			// List contents of skills folder
			const listing = await adapter.list(SKILLS_FOLDER);
			logger.debug('[SkillManager] Found folders:', listing.folders);

			// Iterate through skill folders (only those with 'claude-in-obsidian' in the name)
			for (const folderPath of listing.folders) {
				const folderName = folderPath.split('/').pop() || '';

				// Filter: only load skills with 'claude-in-obsidian' in folder name
				if (!isValidSkillFolder(folderName)) {
					logger.debug(`[SkillManager] Skipping skill folder (no '${SKILL_NAME_FILTER}' in name): ${folderName}`);
					continue;
				}

				const skill = await this.loadSkillFromPath(folderPath, folderName);
				if (skill) {
					this.skills.push(skill);
				}
			}
		} catch (error) {
			logger.error('[SkillManager] Failed to list skills folder:', error);
		}

		// Sort alphabetically by name and limit to MAX_SKILLS
		this.skills.sort((a, b) => a.name.localeCompare(b.name));
		if (this.skills.length > MAX_SKILLS) {
			logger.debug(`[SkillManager] Limiting to ${MAX_SKILLS} skills (found ${this.skills.length})`);
			this.skills = this.skills.slice(0, MAX_SKILLS);
		}

		this.loaded = true;
		logger.info(`[SkillManager] Loaded ${this.skills.length} skills:`, this.skills.map(s => s.name));
	}

	/**
	 * Load a skill from a folder path containing SKILL.md
	 * Uses adapter API to read from hidden folders
	 */
	private async loadSkillFromPath(folderPath: string, folderName: string): Promise<Skill | null> {
		const adapter = this.app.vault.adapter;
		const skillFilePath = `${folderPath}/${SKILL_FILE}`;

		// Check if SKILL.md exists
		const fileExists = await adapter.exists(skillFilePath);
		if (!fileExists) {
			logger.debug(`[SkillManager] No SKILL.md in ${folderName}`);
			return null;
		}

		try {
			const content = await adapter.read(skillFilePath);
			const { frontmatter, body } = parseFrontmatter(content);

			if (!frontmatter.name) {
				logger.warn(`[SkillManager] Skill missing 'name' in frontmatter: ${folderName}`);
				return null;
			}

			const skill: Skill = {
				name: frontmatter.name,
				description: frontmatter.description || '',
				template: body,
				folderName: folderName,
			};

			logger.debug(`[SkillManager] Loaded skill: ${skill.name}`);
			return skill;
		} catch (error) {
			logger.error(`[SkillManager] Failed to load skill from ${folderName}:`, error);
			return null;
		}
	}

	/**
	 * Get loaded skills (max 3, alphabetically sorted)
	 */
	getSkills(): Skill[] {
		if (!this.loaded) {
			logger.warn('[SkillManager] Skills not loaded yet');
			return [];
		}
		return this.skills;
	}

	/**
	 * Apply a skill template by substituting {{selection}}
	 */
	applySkill(skill: Skill, selection: string): string {
		return skill.template.replace(/\{\{selection\}\}/g, selection);
	}

	/**
	 * Reload skills (e.g., when user adds new skills)
	 * Forces a fresh read from filesystem, bypassing cache
	 */
	async reloadSkills(): Promise<void> {
		this.loaded = false;
		await this.loadSkillsFromFilesystem();
	}
}
