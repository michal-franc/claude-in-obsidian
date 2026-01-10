/**
 * Skill Manager - Loads and manages skills from .claude/skills/
 * Feature 003: Shared Skills
 */

import { App, TFolder, TFile } from 'obsidian';
import { Skill } from './types';
import { logger } from './logger';

const SKILLS_FOLDER = '.claude/skills';
const SKILL_FILE = 'SKILL.md';
const MAX_SKILLS = 3;
const SKILL_NAME_FILTER = 'claude-in-obsidian';

/**
 * Parses YAML frontmatter from a SKILL.md file
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
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
	 * Load skills from .claude/skills/ folder
	 * Call this on plugin startup
	 */
	async loadSkills(): Promise<void> {
		logger.info('[SkillManager] Loading skills...');
		this.skills = [];

		const skillsFolder = this.app.vault.getAbstractFileByPath(SKILLS_FOLDER);

		if (!skillsFolder) {
			logger.debug('[SkillManager] Skills folder not found:', SKILLS_FOLDER);
			this.loaded = true;
			return;
		}

		if (!(skillsFolder instanceof TFolder)) {
			logger.warn('[SkillManager] Skills path is not a folder:', SKILLS_FOLDER);
			this.loaded = true;
			return;
		}

		// Iterate through skill folders (only those with 'claude-in-obsidian' in the name)
		for (const child of skillsFolder.children) {
			if (child instanceof TFolder) {
				// Filter: only load skills with 'claude-in-obsidian' in folder name
				if (!child.name.toLowerCase().includes(SKILL_NAME_FILTER)) {
					logger.debug(`[SkillManager] Skipping skill folder (no '${SKILL_NAME_FILTER}' in name): ${child.name}`);
					continue;
				}

				const skill = await this.loadSkillFromFolder(child);
				if (skill) {
					this.skills.push(skill);
				}
			}
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
	 * Load a skill from a folder containing SKILL.md
	 */
	private async loadSkillFromFolder(folder: TFolder): Promise<Skill | null> {
		const skillFilePath = `${folder.path}/${SKILL_FILE}`;
		const skillFile = this.app.vault.getAbstractFileByPath(skillFilePath);

		if (!skillFile || !(skillFile instanceof TFile)) {
			logger.debug(`[SkillManager] No SKILL.md in ${folder.name}`);
			return null;
		}

		try {
			const content = await this.app.vault.read(skillFile);
			const { frontmatter, body } = parseFrontmatter(content);

			if (!frontmatter.name) {
				logger.warn(`[SkillManager] Skill missing 'name' in frontmatter: ${folder.name}`);
				return null;
			}

			const skill: Skill = {
				name: frontmatter.name,
				description: frontmatter.description || '',
				template: body,
				folderName: folder.name,
			};

			logger.debug(`[SkillManager] Loaded skill: ${skill.name}`);
			return skill;
		} catch (error) {
			logger.error(`[SkillManager] Failed to load skill from ${folder.name}:`, error);
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
	 */
	async reloadSkills(): Promise<void> {
		this.loaded = false;
		await this.loadSkills();
	}
}
