# Claude from Obsidian
Obsidian plugin to communicate with Claude shell - send commands from Obsidian to shell and receive responses directly.

## Git Workflow
- **Branches**: `feature/`, `fix/`, `docs/` prefixes (never commit to master)
- **Always**: Create branch → Work → Push → Create PR → Wait for approval
- Keep PRs focused on single features/fixes

## Development Rules

### CRITICAL: Plan Before Implementation
1. **STOP** - Don't code immediately
2. **CREATE BRANCH** - `git checkout -b feature/name`
3. **PLAN** - Create detailed plan, present to user
4. **WAIT** - Get explicit approval before proceeding
5. **IMPLEMENT** - Follow the plan
6. **CREATE PR** - Push and create PR for review

Exception: Skip for trivial changes (typos, single-line fixes).

### Before Committing
1. `npm test` - verify tests pass
2. `npm run build` - verify compilation
3. If CLAUDE.md was changed: `context-doctor CLAUDE.md` - verify instructions quality

### Testing Guidelines
Write tests for: utility functions, business logic, algorithms, critical bug fixes.
Skip tests for: simple getters, UI/modals, IPC integration, trivial code.

### Debugging in Obsidian
- **Use `new Notice(msg, timeout)` (toast notifications) for debugging** — they're visible directly in the UI without dev tools
- `console.log` is stripped by esbuild production minification — do NOT rely on it for debugging
- `console.warn`/`console.error` survive minification but require the dev console (Ctrl+Shift+I)
- **Use `activeDocument` instead of `document`** for DOM queries — Obsidian uses a separate document context for editor content (`activeDocument !== document`)
- In test mocks, set `(globalThis as any).activeDocument` not `document`

### Other Rules
- Add logging for easier debugging
- Split multi-feature requests into separate PRs

## Feature Planning
Use GitHub issues with `enhancement` label. See `features/` folder for ADR-style specs of larger features.

## Bug Tracking
Use GitHub issues with `bug` label.
