# AI Chat — Technical Implementation

The wiki embeds an AI assistant powered by [Hashbrown](https://hashbrown.dev) (`@hashbrownai/core`).
The assistant can read and write wiki pages on the user's behalf through a set of browser-side tools.
All LLM inference happens server-side via a Cloudflare Worker that routes to the chosen provider.

---

## Goals

- Let the user ask questions about their wiki content and have pages summarised, created, or updated through natural language.
- Keep inference off the browser: no API keys shipped to the client, no CORS issues with LLM APIs.
- Reuse the existing Google OAuth token for access control — no separate login.
- Support multiple LLM providers (Gemini, Claude, OpenAI) behind a single endpoint, selectable by model name.
- Surface tool-call progress in real time so the user can see what the AI is doing.

---

## Architecture

```
Browser                                  Cloudflare Worker (worker/src/index.js)
────────────────────────────────         ──────────────────────────────────────────
fryHashbrown({ model: 'gemini:…' })      POST /api/chat
  HttpTransport + auth middleware          Authorization: Bearer <google_access_token>
    └─ POST /api/chat  ─────────────────► verifyGoogleToken() → Google tokeninfo API
       body: CompletionCreateParams        isEmailAuthorized() → AUTHORIZED_EMAILS secret
                                           routeToProvider(body.model):
                                             gemini:* → HashbrownGoogle.stream.text()
                                             claude:* → HashbrownAnthropic.stream.text()
                                             gpt:*    → HashbrownOpenAI.stream.text()
  ◄──── ReadableStream<Uint8Array> ────── encodeFrame() × N  (binary frame stream)
  └─ decodeFrames() → Frame events
      └─ state machine → messages signal
              → tool handlers executed in browser
              → tool messages sent back → next generation turn
```

---

## Files

| File | Role |
|------|------|
| `src/js/services/ai-chat.js` | `createAiChat()` — wraps `fryHashbrown`, attaches Google auth middleware, exposes `updateModel` |
| `src/js/services/ai-tools.js` | `getWikiTools()` — four tools the LLM can call: `readPage`, `writePage`, `listPages`, `deletePage` |
| `src/js/services/ai-prompt.js` | `WIKI_ASSISTANT_SYSTEM` — system prompt constant, injects the wiki root folder name |
| `src/js/components/AiChatPanel.js` | Vue component — fixed slide-in panel, message list, tool-call badges, input bar |
| `src/js/app.js` | Mounts `AiChatPanel`, owns `aiChat`/`aiPanelOpen`/`aiModel` state, lazy-initialises the chat instance |
| `src/js/components/AppHeader.js` | Renders the AI toggle button when `aiEnabled` is true, emits `toggle-ai-chat` |
| `src/config.js` | `AI_URL` (required to enable AI), `AI_MODEL` (default model) |
| `worker/src/index.js` | `handleChat()`, `routeToProvider()`, `verifyGoogleToken()`, `isEmailAuthorized()` |
| `worker/package.json` | Adds `@hashbrownai/anthropic`, `@hashbrownai/google`, `@hashbrownai/openai` as Worker dependencies |

---

## Wire Protocol

Hashbrown uses **length-prefixed binary frames** over a single HTTP POST.
Each frame is `[4-byte big-endian uint32: payload length][UTF-8 JSON payload]`.

The client sends `Chat.Api.CompletionCreateParams` as the JSON body.
The server responds with `Content-Type: application/octet-stream` and streams frames:

| Frame type | Meaning |
|------------|---------|
| `generation-start` | LLM began generating |
| `generation-chunk` | Streaming content or tool-call delta |
| `generation-finish` | LLM finished the turn |
| `generation-error` | LLM or provider error |

The client's `fryHashbrown` instance decodes frames and updates its reactive signals automatically.

---

## Client — `ai-chat.js`

`createAiChat({ system, tools, model })` is the single entry point.

1. Dynamically imports `@hashbrownai/core` via the importmap in `index.html` (ESM CDN — no build step).
2. Reads `CONFIG.AI_URL` for the worker base URL. Throws if not set.
3. Creates an `HttpTransport` with a middleware that attaches the Google OAuth access token from `AuthService.getToken()` (falls back to `sessionStorage` if the service hasn't cached it yet).
4. Calls `fryHashbrown({ model, system, tools, transport })` and immediately calls `chat.sizzle()` to start the internal effect loop.
5. Returns `{ chat, destroy, updateModel }`. The caller must call `destroy()` on unmount to stop the effect loop.

`isAiConfigured()` returns `true` when `CONFIG.AI_URL` is set. This drives the `aiEnabled` computed property in `app.js`.

`getDefaultModel()` reads `CONFIG.AI_MODEL`, defaulting to `gemini:gemini-flash-lite-latest`.

---

## Tools — `ai-tools.js`

`getWikiTools()` returns an array of tool objects. Each tool is a plain object:

```
{ name, description, handler(args, signal) }
```

All handlers delegate to `StorageService` (the same facade used by the rest of the app).

| Tool | Description | Key behaviour |
|------|-------------|---------------|
| `readPage` | Read markdown content of a page | Resolves path, fetches file content via `StorageService.getFileContent` |
| `writePage` | Create or overwrite a page | Resolves path: if file exists calls `updateFile`, otherwise `createFile` (appends `.md`) |
| `listPages` | List all wiki pages, optional prefix filter | Lists root folder, filters to `.md` files, strips extension from paths |
| `deletePage` | Delete a page | Resolves path, calls `StorageService.deleteFile` |

Tool parameters are passed as a plain object — the current implementation avoids Skillet schema (`s.*`) to side-step schema validation issues in the beta version of the library.

Hashbrown wraps each handler's return value as a `PromiseSettledResult<T>`:
- `{ status: 'fulfilled', value: <return value> }` on success
- `{ status: 'rejected', reason: <error> }` on exception

Both outcomes are sent back to the LLM as context for the next generation turn.

---

## System Prompt — `ai-prompt.js`

`WIKI_ASSISTANT_SYSTEM` is a multiline string injected at chat creation time.
It tells the model:
- It is embedded in a personal wiki backed by Google Drive.
- Which tools it can call and what they do.
- Editorial rules: preserve structure, write clean Markdown, do not invent content.
- To confirm with the user before calling `writePage` or `deletePage`.
- The current wiki root folder name (read from `CONFIG.ROOT_FOLDER_NAME` at module load).

---

## UI — `AiChatPanel.js`

A fixed-position panel that slides in from the right edge of the viewport.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `chat` | Object | The object returned by `createAiChat`: `{ chat, destroy, updateModel }` |
| `model` | String | Currently selected model string (display + change propagation) |
| `pageContext` | String | Current wiki path — reserved for context injection (not yet used) |

### Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `close` | — | User dismissed the panel |
| `page-refresh` | — | Reserved for refresh after a write (not yet wired) |
| `model-change` | model string | User changed the model selector |

### State signals subscribed in `mounted`

The component subscribes to four Hashbrown `StateSignal` values and maps them to Vue reactive data:

| Signal | Vue data | Use |
|--------|----------|-----|
| `chat.messages` | `messages` | Full message history; triggers auto-scroll |
| `chat.isGenerating` | `isGenerating` | Disables input, shows typing indicator |
| `chat.isRunningToolCalls` | `isRunningToolCalls` | Differentiates "thinking" from "calling tools" |
| `chat.error` | `error` | Shows error bar with retry button |

Subscriptions are cleaned up in `beforeUnmount`.

### Computed properties

**`visibleMessages`** — filters the raw message list to only `user` and `assistant` roles.
Tool messages (`role: 'tool'`) stay in the array for LLM context but are not rendered.

**`toolCallStatuses`** — derives per-call status badges from the last assistant message.
It pairs each `toolCalls` entry (from the last assistant message) with its corresponding
`tool` message (matched by `toolCallId`) to produce `running` / `done` / `error` per tool call.

**`showTypingIndicator`** — true when the LLM is generating but has not yet emitted any text content
(i.e., still "thinking" or waiting for a first streaming chunk).

### Tool call lifecycle in the message array

```
messages = [
  { role: 'user',      content: 'Summarise the home page' },
  { role: 'assistant', content: null,
    toolCalls: [{ id: 'tc_1', function: { name: 'readPage', arguments: '{"path":"home"}' } }] },
  //  ↑ badge shows "⏳ Reading home" while handler is running
  { role: 'tool', toolCallId: 'tc_1', toolName: 'readPage',
    content: { status: 'fulfilled', value: '# Home\n…' } },
  //  ↑ badge updates to "✓ Reading home"
  { role: 'assistant', content: 'The home page introduces…' },
]
```

### Methods

| Method | Description |
|--------|-------------|
| `send` | Trims input, calls `chat.chat.sendMessage({ role: 'user', content })`, clears input |
| `clear` | Calls `chat.chat.setMessages([])` to reset the conversation |
| `scrollToBottom` | Scrolls the message list to the bottom after Vue re-renders |
| `formatToolLabel` | Maps tool name + args to a human-readable badge label |
| `onModelChange` | Updates the model via `chat.updateModel()` and emits `model-change` |
| `renderContent` | Renders message content as HTML via `marked.parse()` if available |

### Input behaviour

- `Enter` sends the message; `Shift+Enter` inserts a newline.
- The textarea and send button are disabled while `isGenerating` is true.
- The retry button in the error bar calls `chat.chat.resendMessages()`.

---

## App integration — `app.js`

### State

| Property | Initial value | Description |
|----------|--------------|-------------|
| `aiChat` | `null` | Object returned by `createAiChat`; `null` until first panel open |
| `aiPanelOpen` | `false` | Controls `v-if` on `<ai-chat-panel>` |
| `aiModel` | from `localStorage` or `getDefaultModel()` | Currently selected model; persisted in `localStorage` under `wiki:ai-model` |

### Computed

`aiEnabled` — returns `true` when `isAiConfigured()` is truthy (i.e. `CONFIG.AI_URL` is set).
Used by `AppHeader` to show or hide the AI toggle button.

### Lifecycle

- On `mounted`: restores `aiModel` from `localStorage` if present.
- On `beforeUnmount`: calls `this.aiChat?.destroy()` to stop the effect loop.

### Lazy initialisation — `openAiPanel`

The Hashbrown instance is created only the first time the panel is opened, not at boot:

1. Sets `aiPanelOpen = true`.
2. If `aiChat` is null, calls `createAiChat({ model, system, tools })` with `WIKI_ASSISTANT_SYSTEM` and the tools from `getWikiTools()`.
3. Subscribes to `chat.messages` and `chat.isGenerating` on the root for any future root-level reactivity.
4. On failure, shows a toast and sets `aiPanelOpen = false`.

### Toggle — `toggleAiChat`

Called by the `toggle-ai-chat` event from `AppHeader`.
If the panel is open, closes it. Otherwise, calls `openAiPanel()`.

### AppHeader integration

`AppHeader` receives `aiEnabled` as a prop.
When truthy it renders an AI toggle button that emits `toggle-ai-chat`.
The button is declared alongside the other header action buttons.

---

## Cloudflare Worker — `worker/src/index.js`

The worker handles `POST /api/chat` inside `handleChat()`.

### Request flow

1. **Auth** — extracts the `Authorization: Bearer <token>` header and validates it via `verifyGoogleToken()` (Google tokeninfo endpoint). Checks that `aud` matches `GOOGLE_CLIENT_ID` and that the scope includes `drive`.
2. **Email fallback** — `tokeninfo` does not always include an `email` claim; if absent the worker fetches `/oauth2/v2/userinfo` with the same token to retrieve it.
3. **Allowlist** — calls `isEmailAuthorized(email, env.AUTHORIZED_EMAILS)`. `AUTHORIZED_EMAILS` is a Worker secret: a comma-separated list of allowed addresses. Denies all if the secret is not set.
4. **Parse body** — reads `Chat.Api.CompletionCreateParams` JSON.
5. **Route** — `routeToProvider(body, env)` detects the provider from the model string.
6. **Stream** — wraps the provider's async iterator in a `ReadableStream` and responds with `Content-Type: application/octet-stream`.

### Model routing — `routeToProvider`

The model string can use either a `provider:model` prefix format or a bare model name:

| Pattern | Provider | Secret required |
|---------|----------|----------------|
| `gemini:*` or `gemini-*` | `HashbrownGoogle.stream.text()` | `GEMINI_API_KEY` |
| `claude:*` or `claude-*` | `HashbrownAnthropic.stream.text()` | `ANTHROPIC_API_KEY` |
| `gpt:*`, `o1:*`, `o3:*`, `o4:*`, `chatgpt:*` or bare prefixes | `HashbrownOpenAI.stream.text()` | `OPENAI_API_KEY` |

The provider prefix is stripped from the model name before it is forwarded to the provider library.

### Worker secrets

| Secret | Description |
|--------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID (shared with the WebSocket route) |
| `AUTHORIZED_EMAILS` | Comma-separated list of emails allowed to use AI |
| `GEMINI_API_KEY` | Google AI Studio key |
| `ANTHROPIC_API_KEY` | Anthropic key |
| `OPENAI_API_KEY` | OpenAI key |

---

## Configuration — `config.js`

| Key | Required | Description |
|-----|----------|-------------|
| `AI_URL` | Yes (to enable AI) | Base URL of the Cloudflare Worker, e.g. `https://wiki-realtime.mdn.workers.dev` |
| `AI_MODEL` | No | Default model string, e.g. `gemini:gemini-flash-lite-latest` |

When `AI_URL` is absent `isAiConfigured()` returns `false` and the AI button is hidden — the feature degrades gracefully without any errors.

---

## CSS

The panel is styled with classes in `css/app.css` under the `/* ── AI panel */` section.
Key layout rules:
- `.ai-panel` — `position: fixed; right: 0; top: 0; bottom: 0; width: 360px; z-index: 200` — sits on top of the main content.
- `.ai-message--user` — user bubble with a subtle primary-colour tint.
- `.ai-tool-badge--running/done/error` — amber/green/red status badges for tool calls.
- `.ai-typing` — three-dot bouncing animation shown while the LLM is thinking.
All colours use `hsl(var(--*))` tokens from the theme, so dark mode is handled automatically.

---

## Behaviours

| Scenario | Behaviour |
|----------|-----------|
| `AI_URL` not set in config | `aiEnabled = false`, button not shown, no errors |
| Panel opened for the first time | `createAiChat` called lazily; spinner shown on the button during init |
| `createAiChat` fails | Toast shown, panel stays closed, `aiChat` remains null |
| Tool call in progress | Badge shows `⏳ <label>` while handler is running |
| Tool call succeeds | Badge updates to `✓ <label>` |
| Tool call throws | Badge updates to `✗ <label> <error message>` |
| LLM error | Error bar appears with a Retry button that calls `resendMessages()` |
| User closes panel | `aiPanelOpen = false`; the Hashbrown instance stays alive so history is preserved on reopen |
| App unmounts | `aiChat.destroy()` stops the effect loop |
| Model changed | `chat.updateModel()` updates options on the live instance; new model persisted to `localStorage` |
