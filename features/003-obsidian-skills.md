# 003: Shared Skills - Quick Action Buttons

## Status
In Progress

## Context
Users often repeat the same commands to Claude - things like "improve this text", "fix grammar", "summarize", etc. Currently they have to type these commands every time.

Users want to:
- Define reusable "skills" (pre-configured prompts/actions)
- Trigger them with a single click instead of typing
- Use the same skills in Obsidian AND Claude CLI (when run from vault)

## Decision
Store skills in the vault's `.claude/skills/` folder following the Claude CLI convention. This allows skills to work with both the Obsidian plugin and Claude CLI when run from the vault directory.

### Core Behavior

1. **Skill Storage Location**
   - Skills stored in `<vault>/.claude/skills/<skill-name>/SKILL.md`
   - **Important**: Folder name must contain `claude-in-obsidian` to be loaded
   - This prevents mixing with other Claude CLI skills in the same folder
   - Follows Claude CLI convention for compatibility
   - Future: add global skills from `~/.claude/skills/` as optional feature

2. **Skill Folder Structure**
   ```
   <vault>/.claude/skills/
   ├── claude-in-obsidian-improve/
   │   └── SKILL.md
   ├── claude-in-obsidian-fix-grammar/
   │   └── SKILL.md
   └── claude-in-obsidian-summarize/
       └── SKILL.md
   ```

3. **SKILL.md Format**
   ```markdown
   ---
   name: Improve Writing
   description: Improve clarity and flow of selected text
   ---

   Please improve the following text. Make it clearer, more concise,
   and improve the flow while keeping the original meaning:

   {{selection}}
   ```

4. **Variables Available**
   - `{{selection}}` - Currently selected text (only variable for now)

5. **UI Integration** (with feature 004 inline prompt)
   ```
   ┌─────────────────────────────────┐
   │ Ask Claude: [type here___] ⏎   │
   │ [Improve] [Fix] [Summarize]    │  ← Skill buttons
   └─────────────────────────────────┘
   ```
   - Buttons appear below the inline input
   - Click a skill → **auto-submit immediately** (no editing)
   - Template substituted with `{{selection}}` before sending

6. **Behavior**
   - Skills are loaded on plugin startup
   - First 3 skills shown (ordered alphabetically by name)
   - No keyboard shortcuts for skills
   - No auto-creation of folders (don't pollute user's vault without consent)
   - Missing folder = no skill buttons shown

### Example Skills
```
<vault>/.claude/skills/
├── claude-in-obsidian-improve/
│   └── SKILL.md
├── claude-in-obsidian-fix-grammar/
│   └── SKILL.md
└── claude-in-obsidian-summarize/
    └── SKILL.md
```

## Implementation Plan

**Prerequisite:** Feature 004 (Simplified Inline Editing) - ✅ Implemented

### Phase 1: Skill Loader
- Create SkillManager to read from `<vault>/.claude/skills/*/SKILL.md`
- Parse YAML frontmatter (name, description) and template content
- Load skills on plugin init, cache in memory
- Handle missing folder gracefully (no skills = no buttons)

### Phase 2: UI Integration
- Add skill buttons to InlinePrompt component (from feature 004)
- Show max 3 skills, alphabetically ordered
- On click: substitute `{{selection}}` and auto-submit

### Phase 3: Error Handling
- Handle missing skills folder gracefully
- Handle malformed skill files
- Log warnings for invalid skills

## Consequences

### Pros
- Much faster for common operations
- Skills compatible with Claude CLI (same folder structure)
- Easy to share skills (just copy folders)
- Simple - one variable, max 3 buttons
- No auto-creation = respects user's vault

### Cons
- User must manually create `.claude/skills/` folder
- Skills folder may be hidden in some file explorers

## Future Enhancements
- Add global skills from `~/.claude/skills/` (opt-in setting)
- More variables (`{{filename}}`, `{{filepath}}`, etc.)
- Configurable max buttons

## Open Questions
None - all questions resolved. Ready for implementation.
