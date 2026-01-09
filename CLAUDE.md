# Project Name
This is a projejt of a obsidian plugin to enable communcation with claude shell from obsidian.

# Project Purpose
To make it easier to send commands from obsidian to shell and responses from shell to obsidian directly.

# Issue tracking
This project will be using beads for issue tracking and progress tracking - check ISSUETRACKING.md for details on how to use it.

# Git
On each phase remember to commit the changes with comment etc

# Development Rules

## CRITICAL: Always Present Plan Before Implementation

**STOP AND PRESENT A PLAN FIRST - DO NOT START CODING WITHOUT USER APPROVAL**

When the user asks you to implement something, you MUST:
1. **STOP** - Do not start writing code immediately
2. **ANALYZE** - Understand the full scope of the request
3. **PLAN** - Create a detailed plan with approach options if applicable
4. **PRESENT** - Show the plan to the user and ask for approval
5. **WAIT** - Wait for explicit user approval before proceeding
6. **IMPLEMENT** - Only after approval, proceed with implementation

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

# Features:

## Obsidian to claude shell communication
As a user inside obsidian I can use shortcut to open up a modal that will enable me to write a command that will be sent to locally running claude shell on my machine. This command is then executed and results are send back to obsidian.

Use Cases:
- When writing text, or blog posts, I can select text and ask claude to improve / change it

## Running in paraller
- when i select a text claude will add <Claude> and </Claude> tags to mark which text is being worked on by claude - then this text will also `be dimmed` to indicate visually that claude is working on it or this section behind the scenes

## User doesnt need to select session all the time
- a default session can be setup and in the bottom bar there is a status indiciating that session is opened up - and what is the status

##  User create shells should also be able to be used
As a user i can start `claude .` myself and then connect to this shell from obsidian.
