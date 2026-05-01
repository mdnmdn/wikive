# Agentic Integration — Evolution Points

Improvement areas for the AI chat / agentic layer, based on the current implementation
in `src/js/services/ai-*.js`, `src/js/components/AiChatPanel.js`, and `worker/src/index.js`.

---

## Missing tools

The current four tools (`readPage`, `writePage`, `listPages`, `deletePage`) only cover
basic CRUD on markdown pages. The AI cannot act on any other document type or perform
structural operations.

| Missing tool | Description |
|---|---|
| `getCurrentPage()` | Return the path and content of the page currently open in the UI. The `pageContext` prop already exists on `AiChatPanel` but is never surfaced to the AI. |
| `searchPages(query)` | Name or content search across the wiki. Currently no search capability is exposed to the AI. |
| `renameFile(path, newPath)` / `moveFile` | Reorganise content without a writePage+deletePage two-step. Maps to `StorageService.renameFile` / `StorageService.moveFile`. |
| `createFolder(path)` | Explicitly create a subfolder. The AI can write a page inside a non-existent path, but `StorageService.createFolderPath` is not exposed directly. |
| `listSnippets()` / `writeSnippet(path, content, type)` | Snippets are first-class documents but invisible to the AI. |
| `listDrawings()` | Drawings exist in `_drawings` but the AI has no awareness of them. |
| `listAssets()` | Asset files are documents but unreachable from the agent. |

---

## Tool name replication

`formatToolLabel` in `AiChatPanel.js` hardcodes a string map of tool names to display labels:

```js
const labels = {
  readPage:   `Reading "${tc.args?.path ?? ''}"`,
  writePage:  `Writing "${tc.args?.path ?? ''}"`,
  listPages:  'Listing pages',
  deletePage: `Deleting "${tc.args?.path ?? ''}"`,
};
```

This duplicates the name strings from `ai-tools.js`. Adding, removing, or renaming a tool
requires updating both files independently — a silent maintenance hazard.

**Fix:** add a `label(args)` function directly to each tool definition in `ai-tools.js`,
then have `AiChatPanel.formatToolLabel` call `tool.label(tc.args)` via a lookup by name.
The panel becomes generic and requires no changes when the tool list grows.

---

## No browser-side confirmation for destructive actions

The system prompt instructs the AI to confirm before calling `writePage` or `deletePage`,
but there is no actual UI gate in the tool handlers. The AI can write or delete without
any dialog — the confirmation depends entirely on the LLM honouring the instruction.

**Fix:** the `writePage` and `deletePage` handlers in `ai-tools.js` should call a
`showConfirmDialog()` before proceeding (the app already has a `showConfirm` modal pattern
in `app.js`). If the user cancels, the handler throws so the LLM receives a
`{ status: 'rejected', reason: 'User cancelled' }` result.

---

## `pageContext` prop declared but never used

`AiChatPanel` receives the current page path via the `pageContext` prop but never injects
it into the conversation. The AI must ask "what page are you on?" instead of knowing.

**Fix:** inject `pageContext` into the system prompt at chat-creation time, or send it
as a prefixed user message when the panel opens, so the AI always has the current context.

---

## `page-refresh` emit declared but never fired

After `writePage` completes successfully, the currently open document should reload if
the written path matches `currentPath`. The `@page-refresh` event is declared in
`AiChatPanel`'s emits and wired in `app.js`'s template, but the component never emits it.

**Fix:** in the `writePage` tool handler (or in `AiChatPanel` after detecting a completed
write in `toolCallStatuses`), emit `page-refresh` with the written path so the root can
call `refreshPage()` if it matches.

---

## Model selector ignores `AI_MODELS`

`ai-chat.js` exports `window.AI_MODELS` as the canonical list of available models,
but `AiChatPanel` hard-codes a single `<option>` in its template. Adding a new model
requires editing two files.

**Fix:** drive the `<select>` from `window.AI_MODELS` (or pass it as a prop from `app.js`).

---

## No abort button

`fryHashbrown` exposes `chat.stop()` but there is no "Stop" button in the panel UI.
Long or runaway generations cannot be interrupted by the user.

**Fix:** show a Stop button (replacing or alongside the Send button) while `isGenerating`
is true. Call `this.chat.chat.stop()` on click.

---

## Unused root-level signal subscriptions

In `app.js`, `openAiPanel` subscribes to `chat.messages` and `chat.isGenerating` at the
root component level, but the resulting `aiMessages` and `aiGenerating` values are never
consumed by any template or method. This is dead code that adds noise.

**Fix:** remove the root subscriptions. The signals are already consumed inside
`AiChatPanel` where they are actually needed.
