# Bugs

1. In the modal when creating session the working directory should default to the `pwd` of process so for instance if i open obsidian vault as ~/Work/notes the working directory should be the same - so that the context is shared

## Fixed

### Bug 1: Tag format breaks markdown rendering (FIXED)
- **Issue:** The `<CLAUDE>` tag was rendering the markdown incorrectly
- **Fix:** Changed to `=== CLAUDE PROCESSING ===` / `=== END CLAUDE ===` format
- **Commit:** Bug fix commit below

### Bug 2: Response separator not visible enough (FIXED)
- **Issue:** The `<!-- Claude -->` separator wasn't visible to users
- **Fix:** Changed to admonition format:
  ```
  ```ad-claude
  response here
  ```
  ```
- **Commit:** Bug fix commit below
