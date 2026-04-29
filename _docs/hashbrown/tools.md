# Tools — Letting the AI Act on Documents

Tools give the LLM the ability to call JavaScript functions in the browser.
In this wiki, tools bridge the AI chat to `StorageService` / `AuthManager` so
the assistant can read and write documents on behalf of the user.

## Tool shape (vanilla JS)

In vanilla JS there is no `useTool()` hook. A tool is a plain object:

```js
{
  name: string,           // identifier the LLM uses to call this tool
  description: string,    // natural-language description for the LLM
  parameters: object,     // JSON Schema object describing the arguments
  handler: async (args, abortSignal) => any,  // executed when the LLM calls it
}
```

`parameters` is a standard JSON Schema object. Use `s.toJsonSchema(s.object(...))` from
Skillet to generate it, or write raw JSON Schema by hand.

## Registering tools with fryHashbrown

```js
const chat = fryHashbrown({
  model: 'claude-3-5-sonnet-20241022',
  system: SYSTEM_PROMPT,
  tools: [readPageTool, writePageTool, listPagesTool, deletePageTool],
  transport: createHttpTransport({ baseUrl: WORKER_URL }),
});
```

Tools can also be updated at runtime without recreating the chat instance:

```js
chat.updateOptions({ tools: updatedTools });
```

## Document tools for the wiki

These tools let the AI assistant read and modify wiki content via the existing
`StorageService` facade (which delegates to `GoogleDriveProvider`).

### `readPage`

```js
// js/services/ai-tools.js
import { s } from '@hashbrownai/core';
import StorageService from './storage.js';
import DocumentService from './document.js';

export const readPageTool = {
  name: 'readPage',
  description:
    'Read the markdown content of a wiki page. Returns the raw markdown string.',
  parameters: s.toJsonSchema(
    s.object('readPage input', {
      path: s.string(
        'Page path relative to the wiki root, without the .md extension. ' +
        'Examples: "home", "notes/meeting-2026-04"'
      ),
    })
  ),
  async handler({ path }, _signal) {
    const file = await StorageService.getFileByPath(path + '.md');
    if (!file) throw new Error(`Page not found: ${path}`);
    const content = await StorageService.getFileContent(file.id);
    return content;
  },
};
```

### `writePage`

```js
export const writePageTool = {
  name: 'writePage',
  description:
    'Create a new wiki page or overwrite an existing page with markdown content. ' +
    'Use this to update documents, fix content, or create new pages.',
  parameters: s.toJsonSchema(
    s.object('writePage input', {
      path: s.string(
        'Page path relative to wiki root, without .md extension. ' +
        'Use "/" for subfolders, e.g. "projects/alpha/overview".'
      ),
      content: s.string('Full markdown content to write to the page.'),
    })
  ),
  async handler({ path, content }, _signal) {
    const existing = await StorageService.getFileByPath(path + '.md');
    if (existing) {
      await StorageService.updateFileContent(existing.id, content);
      return { status: 'updated', path };
    } else {
      const file = await StorageService.createFile(path + '.md', content);
      return { status: 'created', path, id: file.id };
    }
  },
};
```

### `listPages`

```js
export const listPagesTool = {
  name: 'listPages',
  description:
    'List all wiki pages under an optional folder prefix. ' +
    'Returns an array of page paths (without .md extension).',
  parameters: s.toJsonSchema(
    s.object('listPages input', {
      prefix: s.string(
        'Optional folder prefix to filter results, e.g. "notes". ' +
        'Leave empty to list all pages.'
      ),
    })
  ),
  async handler({ prefix }, _signal) {
    const files = await StorageService.listFiles({ prefix });
    return files
      .filter(f => f.name.endsWith('.md'))
      .map(f => f.path.replace(/\.md$/, ''));
  },
};
```

### `deletePage`

```js
export const deletePageTool = {
  name: 'deletePage',
  description: 'Permanently delete a wiki page.',
  parameters: s.toJsonSchema(
    s.object('deletePage input', {
      path: s.string('Page path without .md extension.'),
    })
  ),
  async handler({ path }, _signal) {
    const file = await StorageService.getFileByPath(path + '.md');
    if (!file) throw new Error(`Page not found: ${path}`);
    await StorageService.deleteFile(file.id);
    return { status: 'deleted', path };
  },
};
```

## System prompt for the document assistant

The system prompt should give the LLM context about the wiki and the available tools:

```js
export const WIKI_ASSISTANT_SYSTEM = `
You are an AI assistant embedded in a personal wiki.
The wiki stores Markdown pages organized in folders on Google Drive.

You can help the user by:
- Reading page content with readPage()
- Listing pages in a folder with listPages()
- Creating or updating pages with writePage()
- Deleting pages with deletePage()

When writing or updating content:
- Preserve existing headings and structure unless asked to change them
- Write clean, readable Markdown
- Never invent content — if you are unsure, ask the user first

Current wiki root: ${CONFIG.ROOT_FOLDER_NAME}
`.trim();
```

## Tool result shape

Hashbrown wraps tool handler return values as `PromiseSettledResult<T>`:

```js
// Successful tool call
{ status: 'fulfilled', value: <handler return value> }

// Failed tool call (exception thrown from handler)
{ status: 'rejected', reason: <error> }
```

Both outcomes are sent back to the LLM as context for the next generation turn.

## Confirming destructive actions

Before calling `writePage` or `deletePage`, show a confirmation dialog so the
user stays in control. One pattern:

```js
export const writePageTool = {
  name: 'writePage',
  // ...
  async handler({ path, content }, _signal) {
    const confirmed = await showConfirmDialog(
      `Allow the AI to overwrite "${path}"?`,
      { preview: content }
    );
    if (!confirmed) throw new Error('User cancelled the write operation.');
    // ... proceed with write
  },
};
```

## Wiring tools into the Vue app

```js
// js/app.js  (inside the Vue app, after auth)
import { createAiChat } from './services/ai-chat.js';
import { readPageTool, writePageTool, listPagesTool } from './services/ai-tools.js';
import { WIKI_ASSISTANT_SYSTEM } from './services/ai-prompt.js';

// In data() or setup():
aiChat: null,

// In mounted() or after login:
this.aiChat = createAiChat({
  system: WIKI_ASSISTANT_SYSTEM,
  tools: [readPageTool, writePageTool, listPagesTool],
});

this.aiChat.messages.subscribe(msgs => { this.aiMessages = msgs; });
this.aiChat.isGenerating.subscribe(v => { this.aiGenerating = v; });
```

## References

| Resource | URL |
|----------|-----|
| `Chat.Api.Tool` interface source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/models/api.models.ts |
| `Chat.Api.ToolCall` interface source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/models/api.models.ts |
| `Chat.Api.ToolMessage` interface source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/models/api.models.ts |
| Concepts: tool calling | https://hashbrown.dev/docs/react/concept/functions |
| Concepts: structured output | https://hashbrown.dev/docs/react/concept/structured-output |
| Recipe: predictive actions | https://hashbrown.dev/docs/react/recipes/predictive-actions |
| Recipe: natural language → structured data | https://hashbrown.dev/docs/react/recipes/natural-language-to-structured-data |
| Tool effects source (how calls are dispatched internally) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/effects/tools.effects.ts |
