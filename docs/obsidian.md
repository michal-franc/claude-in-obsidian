# Obsidian Plugin Development Notes

## DOM Access

Obsidian uses a separate document context for editor content. The global `document` only covers the app chrome (status bar, ribbons, settings), **not** the editor panes.

- **Use `activeDocument`** instead of `document` for any DOM queries targeting editor content (callouts, preview sections, CM6 elements).
- `activeDocument !== document` — they are different objects.
- `document.querySelector('.callout')` will return `null` even when a callout is visible on screen.

```ts
// WRONG — searches app chrome only
const el = document.querySelector('.callout[data-callout="my-callout"]');

// CORRECT — searches the active editor document
const el = activeDocument.querySelector('.callout[data-callout="my-callout"]');

// CORRECT — createElement must also use activeDocument
const div = activeDocument.createElement('div');
```

In tests, mock `activeDocument` on globalThis:
```ts
(globalThis as any).activeDocument = mockDocument;
// cleanup:
delete (globalThis as any).activeDocument;
```

## Debugging

### Use Obsidian Notice (toast) for debugging

`console.log` is **stripped** by esbuild's production minification. Never rely on it for debugging deployed builds.

```ts
import { Notice } from 'obsidian';

// Visible toast — works regardless of minification
new Notice(`Debug: value=${someVar}`, 5000);
```

### Console methods

| Method | Survives minification? | Visible where? |
|---|---|---|
| `console.log` | No | — |
| `console.warn` | Yes | Dev tools (Ctrl+Shift+I) > Console (Warnings filter) |
| `console.error` | Yes | Dev tools (Ctrl+Shift+I) > Console (Errors filter) |
| `new Notice()` | Yes | Obsidian UI (toast popup) |

### Opening dev tools

Press **Ctrl+Shift+I** (or Cmd+Option+I on Mac) in Obsidian to open Chromium DevTools.

## Callout DOM Structure

When Obsidian renders a callout from markdown like `> [!my-type]`, the live preview DOM looks like:

```html
<div class="callout" data-callout="my-type">
  <div class="callout-title">
    <div class="callout-icon">...</div>
    <div class="callout-title-inner">My type</div>
  </div>
  <div class="callout-content">
    <p>...</p>
  </div>
</div>
```

- `.callout-title` uses `display: flex` — appended children become flex items.
- Use `margin-left: auto` on injected elements to push them to the right of the title.
- CSS `::before` pseudo-elements on `.callout` are unreliable — Obsidian's own styles override them. Inject real DOM elements instead.

## Build & Deploy

- `npm run build` — esbuild with production flag (minification + tree-shaking)
- `make publish` — builds and copies `main.js`, `manifest.json`, `styles.css` to the vault plugin dir
- After publishing, **reload the plugin** in Obsidian: Settings > Community plugins > toggle off/on (or restart Obsidian)
