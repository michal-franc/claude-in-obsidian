# Project Name
This is a projejt of a obsidian plugin to enable communcation with claude shell from obsidian.

# Project Purpose
To make it easier to send commands from obsidian to shell and responses from shell to obsidian directly.

# Issue Tracking - IMPORTANT

**ALWAYS use beads for tracking work. Read ISSUETRACKING.md for commands.**

Before starting any work:
1. `bd ready` - Check for existing issues to work on
2. `bd create "title" -t bug|feature|task` - Create issue for new work
3. `bd update <id> --status in_progress` - Mark as in progress

After completing work:
1. `bd close <id> --reason "Done"` - Close the issue
2. `bd export -o .beads/issues.jsonl` - Export before committing

This applies to ALL work: features, bugs, refactoring, etc.

# Git & GitHub Workflow

**All changes must go through Pull Requests for review.**

## Branch Naming
Use descriptive branch names:
- Features: `feature/short-description` (e.g., `feature/skills-buttons`)
- Bugs: `fix/short-description` (e.g., `fix/callout-styling`)
- Docs: `docs/short-description` (e.g., `docs/readme-update`)

## Workflow

### 1. Start Work - Create Branch
```bash
git checkout master
git pull origin master
git checkout -b feature/your-feature-name
```

### 2. During Work - Commit Regularly
```bash
git add -A
git commit -m "Description of change"
```

### 3. Complete Work - Push & Create PR
```bash
# Push branch to GitHub
git push -u origin feature/your-feature-name

# Create Pull Request using GitHub CLI
gh pr create --title "Feature: Short description" --body "## Summary
- What was done

## Test plan
- How to test"
```

### 4. After PR Merged - Cleanup
```bash
git checkout master
git pull origin master
git branch -d feature/your-feature-name
```

## Important
- Never push directly to master
- Wait for PR approval before merging
- Keep PRs focused on single features/fixes

# Development Rules

## CRITICAL: Always Present Plan Before Implementation

**STOP AND PRESENT A PLAN FIRST - DO NOT START CODING WITHOUT USER APPROVAL**

**ALSO: Always use feature branches and PRs - see "Git & GitHub Workflow" section above!**

When the user asks you to implement something, you MUST:
1. **STOP** - Do not start writing code immediately
2. **CREATE BRANCH** - `git checkout -b feature/name` (NEVER work on master)
3. **ANALYZE** - Understand the full scope of the request
4. **PLAN** - Create a detailed plan with approach options if applicable
5. **PRESENT** - Show the plan to the user and ask for approval
6. **WAIT** - Wait for explicit user approval before proceeding
7. **IMPLEMENT** - Only after approval, proceed with implementation
8. **CREATE PR** - Push branch and create PR for review

This rule applies to:
- Bug fixes
- New features
- Refactoring
- Any code changes

Exception: You may skip planning for trivial tasks like typo fixes or single-line changes.

## Unit Testing Guidelines

**Write tests when they add value**

Unit tests are important but not always necessary. Use your judgment:

**DO write tests for:**
- Pure utility functions (easy to test, high value)
- Complex business logic
- Data transformations
- Algorithms and calculations
- Critical bug fixes

**DON'T write tests for:**
- Simple getters/setters
- UI/modal code (hard to test, low value)
- IPC/system integration (needs real environment)
- Prototype/exploratory code
- Trivial pass-through functions

**When you do write tests:**
1. Run `npm test` before committing
2. Include tests with your code commit
3. Fix failing tests before proceeding

We'll expand test coverage incrementally as the codebase matures.

## Other Development Rules

Always add logging to make it more easy for operator to test and run the plugin.

Read ISSUETRACCKING.md before implementineg anything to familiarise youreslv with the BEADS framework to manage tasks.

During planning prefer splitting work into features. So given asks for lets say adding logging and also new feature. Split this work into two features.

After each phase:
1. Run `npm test` to verify all tests pass
2. Run `npm run build` to verify compilation
3. Only then commit your changes

## Feature Planning with ADR-style Documents

**Use the `features/` folder to document and plan features before implementation.**

### Structure
Features are documented using ADR (Architecture Decision Record) style files:
```
features/
  001-feature-name.md
  002-another-feature.md
  ...
```

### Feature Document Template
Each feature file should include:
1. **Title** - Clear feature name
2. **Status** - Draft / Under Review / Approved / Implemented / Rejected
3. **Context** - Why is this feature needed?
4. **Decision** - What will be implemented?
5. **Implementation Plan** - High-level approach
6. **Consequences** - Trade-offs and implications

### Workflow
1. **Create** - Add a new numbered feature file in `features/`
2. **Iterate** - Discuss and refine the feature document
3. **Approve** - User marks status as "Approved"
4. **Implement** - Only then proceed with implementation following the plan
5. **Complete** - When feature is implemented:
   - Update status to "Implemented (vX.X.X)"
   - Move file to `features/implemented/`
   - Update `features/README.md` index

## Bug Tracking

**Check `features/bugs.md` for known bugs and issues.**

This file contains user-reported bugs with descriptions and proposed fixes. When starting work:
1. Review `features/bugs.md` for any bugs that need attention
2. Prioritize bugs over new features when they affect core functionality
3. After fixing a bug, remove it from `bugs.md` or mark it as fixed
