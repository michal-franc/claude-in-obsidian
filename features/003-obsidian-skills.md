# 003: Shared Skills - Quick Action Buttons

## Status
Draft (depends on feature 004)

## Context
Users often repeat the same commands to Claude - things like "improve this text", "fix grammar", "summarize", etc. Currently they have to type these commands every time.

Users want to:
- Define reusable "skills" (pre-configured prompts/actions)
- Trigger them with a single click instead of typing
- Use the same skills in Obsidian AND Claude shell

## Decision
Store skills in a shared location (alongside Claude config) so they work in both Obsidian plugin and Claude shell. Show up to 3 skill buttons in the inline prompt UI (feature 004).

### Core Behavior

1. **Skill Storage Location**
   - Skills stored in `~/.claude/skills/` (shared with Claude shell)
   - Each skill is a markdown file with frontmatter

2. **Skill File Format**
   ```markdown
   ---
   name: Improve Writing
   description: Improve clarity and flow of selected text
   ---

   Please improve the following text. Make it clearer, more concise,
   and improve the flow while keeping the original meaning:

   {{selection}}
   ```

3. **Variables Available**
   - `{{selection}}` - Currently selected text (only variable for now)

4. **UI Integration** (with feature 004 inline prompt)
   ```
   ┌─────────────────────────────────┐
   │ Ask Claude: [type here___] ⏎   │
   │ [Improve] [Fix] [Summarize]    │  ← Skill buttons
   └─────────────────────────────────┘
   ```
   - Buttons appear below the inline input
   - Click a skill → **auto-submit immediately** (no editing)
   - Template substituted with `{{selection}}` before sending

5. **Behavior**
   - Skills are loaded on plugin startup
   - First 3 skills shown (ordered alphabetically by name)
   - No keyboard shortcuts for skills
   - Auto-create `~/.claude/skills/` folder with one example skill on first run

### Example Skills
```
~/.claude/skills/
  improve-writing.md
  fix-grammar.md
  summarize.md
```

## Implementation Plan

**Prerequisite:** Feature 004 (Simplified Inline Editing) must be implemented first.

### Phase 1: Skill Loader
- Create SkillManager to read from `~/.claude/skills/`
- Parse frontmatter (name, description) and template content
- Load skills on plugin init, cache in memory
- Auto-create folder with example skill if missing

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
- Skills work in both Obsidian and Claude shell
- Easy to share skills (just copy files)
- Simple - one variable, max 3 buttons

### Cons
- Requires file system access outside vault
- Skills folder must be created manually (or auto-create)

## Open Questions
None - all questions resolved. Ready for approval.
