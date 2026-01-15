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

### Testing Guidelines
Write tests for: utility functions, business logic, algorithms, critical bug fixes.
Skip tests for: simple getters, UI/modals, IPC integration, trivial code.

### Other Rules
- Add logging for easier debugging
- Split multi-feature requests into separate PRs
- Read ISSUETRACKING.md for BEADS task framework

## Feature Planning
Use ADR-style docs in `features/` folder. See `features/README.md` for template and workflow.

## Bug Tracking
Check `features/bugs.md` for known issues. Prioritize bugs over new features when they affect core functionality.
