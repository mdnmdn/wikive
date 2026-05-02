# AI Chat — Technical Implementation

The wiki embeds an AI assistant powered by [Hashbrown](https://hashbrown.dev) (`@hashbrownai/core`).
The assistant can read and write wiki pages on the user's behalf through a set of browser-side tools.
All LLM inference happens server-side via a Cloudflare Worker that routes to the chosen provider.

---

## Goals

- Let the user ask questions about their wiki content and have pages summarised, created, or updated through natural language.
- Keep inference off the browser: no CORS issues with LLM APIs.
- Reuse the existing Google OAuth token for access control — no separate login.
- Support multiple LLM providers (Gemini, Claude, OpenAI) behind a single endpoint, selectable by model name.
- Allow users to configure their own provider API keys, stored in their wiki settings file in Google Drive.
- Surface tool-call progress in real time so the user can see what the AI is doing.

---

## Architecture

```
Browser                                  Cloudflare Worker (worker/src/index.js)
────────────────────────────────         ──────────────────────────────────────────
fryHashbrown({ model: 'gemini:…' })      POST /api/chat
  HttpTransport + middleware               Authorization: Bearer <google_access_token>
    └─ POST /api/chat  ─────────────────► verifyGoogleToken() → Google tokeninfo API
       body: CompletionCreateParams        isEmailAuthorized() → AUTHORIZED_EMAILS secret
       headers:                            X-Provider-Type / X-Provider-Key / X-Provider-URL
         X-Provider-Type: anthropic          → override provider if headers present
         X-Provider-Key: sk-ant-…           routeToProvider(body.model):
         X-Provider-URL: (optional)           gemini:* → HashbrownGoogle.stream.text()
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
| `src/js/services/ai-chat.js` | `createAiChat()`, `testAiProvider()`, `discoverProviderModels()`, `getAiAuthToken()` |
| `src/js/services/ai-tools.js` | `getWikiTools()` — seven tools: `getCurrentDocument`, `getCurrentContent`, `updateCurrentDocument`, `readPage`, `writePage`, `listPages`, `deletePage` |
| `src/js/services/ai-prompt.js` | `WIKI_ASSISTANT_SYSTEM` — base system prompt; custom per-wiki instructions are appended in `app.js` |
| `src/js/components/AiChatPanel.js` | Vue component — fixed slide-in panel, document context chip, model selector, gear toggle to open settings, message list with context notes, tool-call badges, input bar |
| `src/js/components/AiSettingsPanel.js` | Vue component — wiki custom prompt editor, provider list with add/edit/delete, test-connection and discover-models buttons per provider |
| `src/js/app.js` | Mounts `AiChatPanel`; owns `aiChat`/`aiPanelOpen`/`aiModel`/`aiProviders`/`documentContext`/`currentWikiCustomPrompt` state; handles custom prompt persistence and chat recreation |
| `src/js/components/AppHeader.js` | Renders the AI toggle button when `aiEnabled` is true, emits `toggle-ai-chat` |
| `src/js/providers/GoogleDriveProvider.js` | Persists `wiki_definitions.json` in `{ wikis, aiProviders }` format; each wiki object may carry `aiCustomPrompt` |
| `src/config.js` | `AI_URL` (required to enable AI), `AI_MODEL` (default model when no providers configured) |
| `src/index.js` | `handleChat()`, `handleProviderTest()`, `handleProviderModels()`, `routeToProvider()`, `resolveProviderFromRequest()` |

---

## AI Provider Configuration

Users can configure their own AI providers instead of relying on the backend's built-in API keys.
Provider settings are stored in `wiki_definitions.json` in the user's Google Drive root alongside wiki definitions.

### Provider data model

```json
{
  "id": "1716000000000",
  "name": "My Anthropic",
  "type": "anthropic",
  "apiKey": "sk-ant-...",
  "url": "",
  "models": ["claude-opus-4-5", "claude-haiku-4-5"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | `String(Date.now())` at creation time; used as stable key |
| `name` | yes | Display name shown in model selector and settings list |
| `type` | yes | `"openai"` \| `"anthropic"` \| `"gemini"` |
| `apiKey` | yes | Provider API key, stored encrypted only by Drive's access control |
| `url` | no | Custom base URL (e.g. a local Ollama endpoint); omitted means use provider default |
| `models` | yes | Array of model name strings; one entry per line in the edit form |

### `wiki_definitions.json` format

The file was extended from a plain array to an object. Back-compat parsing handles both:

```json
{
  "wikis": [
    { "wikiName": "default", "rootFolder": "_wiki", "aiCustomPrompt": "Always reply in Italian." }
  ],
  "aiProviders": [
    { "id": "…", "name": "…", "type": "anthropic", "apiKey": "…", "url": "", "models": ["…"] }
  ]
}
```

The optional `aiCustomPrompt` field on each wiki item stores per-wiki AI instructions. It is appended to the base system prompt at chat creation time under a `## Custom Instructions` heading.

`GoogleDriveProvider.getWikiDefinitions()` returns `{ id, wikis, aiProviders }`.
`GoogleDriveProvider.saveWikiDefinitions({ wikis, aiProviders })` saves the object form — any extra fields (like `aiCustomPrompt`) on wiki items are preserved transparently.

Old files (plain array) are read as `{ wikis: array, aiProviders: [] }` and migrated on next save.

### How provider config reaches the backend

When a provider is active `createAiChat` attaches a second transport middleware that injects three
request headers on every POST to `/api/chat`:

| Header | Value |
|--------|-------|
| `X-Provider-Type` | `openai` \| `anthropic` \| `gemini` |
| `X-Provider-Key` | The API key from the provider config |
| `X-Provider-URL` | Custom base URL, if set; header omitted otherwise |

The model value passed to `fryHashbrown` is the bare model name (e.g. `claude-opus-4-5`) stripped of
the `provideId::` prefix that the selector uses internally.

### Model selector behaviour

When at least one provider is configured, `window.AI_MODELS` is built from providers instead of being
fetched from the backend. Model option values use the format `provideId::modelName`
(double-colon separator chosen to avoid conflict with the `provider:model` prefix convention).

```
effectiveModels = providers.flatMap(p =>
  p.models.map(m => ({ label: `${p.name} › ${m}`, value: `${p.id}::${m}` }))
)
```

When no providers are configured the selector falls back to the list fetched from
`${AI_URL}/api/models`.

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

`createAiChat({ system, tools, model, provider })` is the single entry point.

1. Dynamically imports `@hashbrownai/core` via the importmap in `index.html` (ESM CDN — no build step).
2. Reads `CONFIG.AI_URL` for the worker base URL. Throws if not set.
3. Builds a middleware array:
   - **Auth middleware** — attaches the Google OAuth token from `AuthService.getToken()` (falls back to `sessionStorage`).
   - **Provider middleware** (added only when `provider` is non-null) — attaches `X-Provider-*` headers.
4. Calls `fryHashbrown({ model, system, tools, transport })` and immediately calls `chat.sizzle()`.
5. Returns `{ chat, destroy, updateModel }`. The caller must call `destroy()` on unmount.

`isAiConfigured()` returns `true` when `CONFIG.AI_URL` is set. Drives `aiEnabled` in `app.js`.

`getDefaultModel()` reads `CONFIG.AI_MODEL`, defaulting to `gemini:gemini-flash-lite-latest`.

### `getAiAuthToken()`

Returns the current Google OAuth token from `AuthService` or `sessionStorage`. Used internally by `testAiProvider` and `discoverProviderModels` to authenticate requests without going through Hashbrown.

### `testAiProvider(provider, encryptionKey)`

Sends `POST /api/provider-test` with the provider's `X-Provider-*` headers and `{ model }` body (using the first model from the config). Returns `{ ok: true }` or `{ ok: false, error: "…" }`. Throws if `AI_URL` is not configured or the user is not authenticated.

### `discoverProviderModels(provider, encryptionKey)`

Sends `POST /api/provider-models` with the provider's `X-Provider-*` headers. Returns `{ models: string[] }` or `{ error: "…" }`. The returned model IDs are bare names (no provider prefix) suitable for the models textarea.

---

## Tools — `ai-tools.js`

`getWikiTools()` returns an array of tool objects:

```
{ name, description, label(args), schema, handler(args, signal) }
```

All handlers delegate to `StorageService` or `window._currentDocContext`.

### Context-aware tools (currently open document)

These tools operate on whatever page or snippet is currently visible in the app, without requiring the user to specify a path. They read from `window._currentDocContext` which `app.js` keeps in sync.

| Tool | Description | Key behaviour |
|------|-------------|---------------|
| `getCurrentDocument` | Get metadata of the open document | Returns `{ name, path, docType }` or `{ document: null }` |
| `getCurrentContent` | Read content of the open document | Reads `window._currentDocContext.content`; fails if type is not `markdown` or `snippet` |
| `updateCurrentDocument` | Save new content to the open document | Calls `StorageService.updateFile`, updates `window._currentDocContext.content`, invokes `window._refreshCurrentDoc()` |

### Path-based tools

| Tool | Description | Key behaviour |
|------|-------------|---------------|
| `readPage` | Read markdown content of a page by path | Resolves path, fetches via `StorageService.getFileContent` |
| `writePage` | Create or overwrite a page by path | Resolves path: updates if exists, creates otherwise (appends `.md`) |
| `listPages` | List all wiki pages, optional prefix filter | Lists root folder, filters to `.md` files, strips extension |
| `deletePage` | Delete a page by path | Resolves path, calls `StorageService.deleteFile` |

Hashbrown wraps each handler result as `PromiseSettledResult<T>`:
- `{ status: 'fulfilled', value: … }` on success
- `{ status: 'rejected', reason: … }` on exception

---

## System Prompt — `ai-prompt.js`

`WIKI_ASSISTANT_SYSTEM` is injected at chat creation time. It describes:
- The wiki context (Google Drive backed personal wiki).
- All available tools and their intent, including the three context-aware tools.
- Editorial rules: preserve structure, clean Markdown, no invented content.
- Requirement to confirm before `writePage`, `deletePage`, or `updateCurrentDocument`.
- The current wiki root folder name (from `CONFIG.ROOT_FOLDER_NAME`).

---

## UI — `AiChatPanel.js`

A fixed-position panel that slides in from the right edge of the viewport.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `chat` | Object | The object returned by `createAiChat`: `{ chat, destroy, updateModel }` |
| `model` | String | Currently selected model value (may be `provideId::modelName`) |
| `pageContext` | String | Current wiki path (legacy, kept for compatibility) |
| `documentContext` | Object\|null | `{ name, path, docType }` for the currently open document; `null` if no supported document is open |
| `aiProviders` | Array | Configured provider objects passed down from `app.js` |
| `providersSaving` | Boolean | True while the parent is persisting provider changes to Drive |

### Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `close` | — | User dismissed the panel |
| `page-refresh` | — | Reserved for refresh after a write |
| `model-change` | model value string | User changed the model selector |
| `providers-change` | providers array | User saved a change in `AiSettingsPanel` |

### Settings toggle

A gear icon button in the panel header switches between the chat view and the embedded
`<ai-settings-panel>` component. The panel header remains visible in both views; the model
selector is hidden while settings are open.

### Document context chip

When `documentContext` is non-null a compact chip is rendered between the panel header and the message list showing the document type badge and name:

```
[Page] home
[Snippet] snip-250502-14-30.js
```

This updates reactively whenever the user navigates to a different page while the panel is open.

### Context note injection

On panel `mounted` (if `documentContext` is set) and whenever `documentContext` changes to a different `docType:path` combination, the component appends a `{ role: 'doc-context', … }` message to the chat history via `chat.chat.setMessages([...messages, note])`. This message is rendered as a styled note in the message list:

> 📄 Now viewing: **home** (markdown) — Use `getCurrentContent` to read it or `updateCurrentDocument` to modify it.

Context notes are only re-injected when the path or type actually differs from the last injected context (tracked via `_lastContextKey`). Re-opening the panel on the same document does not add a duplicate note.

### State signals subscribed in `mounted`

| Signal | Vue data | Use |
|--------|----------|-----|
| `chat.messages` | `messages` | Full message history; triggers auto-scroll |
| `chat.isGenerating` | `isGenerating` | Disables input, shows typing indicator |
| `chat.isRunningToolCalls` | `isRunningToolCalls` | Differentiates "thinking" from "tool running" |
| `chat.error` | `error` | Shows error bar with retry button |

### Watchers

**`documentContext`** — fires when the prop changes; computes a `docType:path` key and calls `_injectContextNote` only if the key differs from `_lastContextKey`.

### Computed properties

**`effectiveModels`** — when providers are configured, builds model options from them; otherwise returns `window.AI_MODELS` from the backend.

**`visibleMessages`** — filters to `user`, `assistant`, and `doc-context` roles.

**`toolCallStatuses`** — pairs `toolCalls` entries from the last assistant message with their `tool` result messages to produce per-call `running` / `done` / `error` status.

**`showTypingIndicator`** — true when generating but no text content has arrived yet.

### Tool call lifecycle

```
messages = [
  { role: 'user',      content: 'Summarise the home page' },
  { role: 'assistant', content: null,
    toolCalls: [{ id: 'tc_1', function: { name: 'readPage', arguments: '{"path":"home"}' } }] },
  //  ↑ badge shows "⏳ Reading home"
  { role: 'tool', toolCallId: 'tc_1', content: { status: 'fulfilled', value: '# Home\n…' } },
  //  ↑ badge updates to "✓ Reading home"
  { role: 'assistant', content: 'The home page introduces…' },
]
```

### Methods

| Method | Description |
|--------|-------------|
| `send` | Trims input, calls `chat.chat.sendMessage`, clears input |
| `clear` | Calls `chat.chat.setMessages([])` |
| `scrollToBottom` | Scrolls the message list after Vue re-renders |
| `formatToolLabel` | Maps tool name + args to a human-readable badge label |
| `onModelChange` | Emits `model-change` (parent destroys and recreates chat) |
| `onProvidersSave` | Forwards `AiSettingsPanel`'s `save` event as `providers-change` |
| `renderContent` | Renders via `marked.parse()` if available |
| `_contextKey(ctx)` | Returns `"docType:path"` string from a context object, used for change detection |
| `_injectContextNote(ctx)` | Appends a `doc-context` message to the message history via `setMessages` |
| `docTypeLabel(docType)` | Maps `markdown` → `Page`, `snippet` → `Snippet`, etc. for the context chip |

### Input behaviour

- `Enter` sends; `Shift+Enter` inserts a newline.
- Textarea and send button disabled while `isGenerating`.
- Retry button calls `chat.chat.resendMessages()`.

---

## UI — `AiSettingsPanel.js`

Embedded inside `AiChatPanel` (replaces the message area when the gear is toggled).

### Props

### Props

| Prop | Type | Description |
|------|------|-------------|
| `providers` | Array | Current provider list from `app.js` |
| `saving` | Boolean | True while the parent is persisting to Drive |
| `encryptionKey` | String\|null | Per-user client encryption key |
| `customPrompt` | String | The current wiki's `aiCustomPrompt` field |

### Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `save` | providers array | A provider was added, edited, or deleted; parent should persist |
| `save-prompt` | prompt string | User saved the wiki custom prompt |
| `back` | — | User clicked the back arrow; parent hides the settings panel |

### List view layout

1. **Wiki Prompt** section — `<textarea>` bound to `promptDraft` (local copy of `customPrompt`). **Save prompt** button is enabled only when `promptDraft !== customPrompt`. Emits `save-prompt` on click.
2. **AI Providers** section — provider cards with edit/delete buttons, same as before.

### Provider edit/add form

| Field | Input type | Notes |
|-------|-----------|-------|
| Name | text | Required |
| Type | select | `openai` / `anthropic` / `gemini` |
| API Key | password | `autocomplete="off"`; leave empty to keep existing encrypted key |
| Base URL | text | Optional; empty string means use provider default |
| **Discover models** button | — | Calls `discoverProviderModels`, populates the models textarea; disabled if no API key available or `AI_URL` not set |
| Models | textarea | One model name per line; split on `\n`, trimmed, empty lines removed |
| **Test connection** button | — | Calls `testAiProvider` with the first model; shows ✓ Connected or ✗ error |

On **Save**, the component splices the provider into its local copy of the list and emits `save`
with the full updated array. The parent (`app.js`) then persists to Drive and rebuilds
`window.AI_MODELS`.

On **Delete**, confirmation is requested via `confirm()` before the provider is removed and `save` is emitted.

### `canTestOrDiscover` computed

Returns `true` when `CONFIG.AI_URL` is set, a provider type is selected, and an API key is available (either freshly entered in the form or from an existing encrypted provider).

---

## App integration — `app.js`

### State

| Property | Initial value | Description |
|----------|--------------|-------------|
| `aiChat` | `null` | Object from `createAiChat`; null until first panel open |
| `aiPanelOpen` | `false` | Controls `v-if` on `<ai-chat-panel>` |
| `aiModel` | from `localStorage` or `getDefaultModel()` | Selected model value; persisted under `wiki:ai-model` |
| `aiProviders` | `[]` | Loaded from `wiki_definitions.json` on init |
| `providersSaving` | `false` | True while Drive write is in flight |

### Computed

`aiEnabled` — `true` when `isAiConfigured()` is truthy (`CONFIG.AI_URL` is set).

`documentContext` — returns `{ name, path, docType }` when the currently loaded document is a `markdown` or `snippet` type; `null` otherwise. Passed as `:document-context` to `<ai-chat-panel>`.

`currentWikiCustomPrompt` — reads `aiCustomPrompt` from the current wiki item in `wikiList` (matched by `currentWikiName`). Returns `''` when no wiki is selected (static-config mode). Passed as `:custom-prompt` to `<ai-chat-panel>`.

### Lifecycle

- **`mounted`** — restores `aiModel` from `localStorage`.
- **`initApp`** — destructures `{ wikis, aiProviders }` from `StorageService.getWikiDefinitions()` and assigns both.
- **`beforeUnmount`** — calls `this.aiChat?.destroy()`.

### `_setupDocContext()`

Called at the end of every `onRouteChange()` and keeps two globals in sync:

- **`window._currentDocContext`** — `{ name, path, docType, documentId, content }` for the open document if it is `markdown` or `snippet`; `null` otherwise. Tool handlers read from this object.
- **`window._refreshCurrentDoc`** — a callback that clears the content cache entry and calls `onRouteChange()`. Invoked by `updateCurrentDocument` after a successful write so the rendered page reflects the new content.

`fileContent` is also patched into `window._currentDocContext.content` inside the `save()` method so the context stays accurate after a manual save without a full route reload.

### `openAiPanel`

Lazy-initialises the Hashbrown instance on first open:

1. If providers are configured: builds `window.AI_MODELS` from them and validates the current `aiModel`.
2. Otherwise: calls `fetchAiModels()` to populate from the backend.
3. Parses the model value: if it contains `::`, splits into `providerId` and `modelName`, looks up the provider object.
4. Calls `createAiChat({ model: modelName, provider, system, tools })`.
5. On failure: shows a toast, leaves `aiPanelOpen = false`.

### `onAiModelChange(newModel)`

Saves model to `localStorage`. If the chat is already open, destroys the current instance and calls `openAiPanel()` to recreate it with the new provider/model. This ensures the correct `X-Provider-*` headers are applied immediately.

### `onProvidersChange(providers)`

1. Updates `this.aiProviders`.
2. Rebuilds `window.AI_MODELS` from the new list (if non-empty).
3. Sets `providersSaving = true`, calls `StorageService.saveWikiDefinitions({ wikis, aiProviders })`, clears flag.

### `onCustomPromptChange(prompt)`

1. Finds the current wiki by `currentWikiName` in `wikiList`.
2. Sets (or clears, if empty) `aiCustomPrompt` on the wiki item.
3. Calls `StorageService.saveWikiDefinitions` to persist.
4. If the AI chat is currently open, destroys the instance and calls `openAiPanel()` to recreate it with the updated system prompt — so changes take effect immediately without requiring a manual chat restart.

### `openAiPanel` — system prompt construction

```javascript
const baseSystem = window.WIKI_ASSISTANT_SYSTEM;
const customPrompt = this.currentWikiCustomPrompt;
const system = customPrompt
  ? `${baseSystem}\n\n## Custom Instructions\n\n${customPrompt}`
  : baseSystem;
```

### `saveWikiDefinitions` call sites

All wiki mutation methods (`createWikiAndConnect`, `createWikiFromHeader`, `deleteWiki`, `onCustomPromptChange`) pass `{ wikis: updated, aiProviders: this.aiProviders }` to preserve all settings across wiki operations.

---

## Cloudflare Worker — `src/index.js`

### Endpoints

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| `GET` | `/api/models` | `handleModels` | None |
| `POST` | `/api/chat` | `handleChat` | Google token + email allowlist |
| `POST` | `/api/encrypt` | `handleEncrypt` | Google token + email allowlist |
| `POST` | `/api/provider-test` | `handleProviderTest` | Google token + email allowlist |
| `POST` | `/api/provider-models` | `handleProviderModels` | Google token + email allowlist |

### `/api/provider-test`

Validates that a provider config can complete a real request. Calls the provider's native completion API directly (not through Hashbrown) with `max_tokens: 5`. Provider credentials come from the `X-Provider-*` headers, resolved via `resolveProviderFromRequest()`. Returns `{ ok: true }` or `{ ok: false, error: "…" }`.

The client passes the first model from the editing form as `{ model }` in the POST body. Supported providers: OpenAI-compatible, Anthropic, Gemini.

### `/api/provider-models`

Fetches the live model list from the provider's catalogue API:

| Provider type | Upstream API | Filter |
|---------------|-------------|--------|
| `openai` | `GET /v1/models` | IDs starting with `gpt-`, `o1`, `o3`, `o4`, `chatgpt-` |
| `anthropic` | `GET /v1/models?limit=100` | All returned model IDs |
| `gemini` | `GET /v1beta/models?pageSize=100` | Models that support `generateContent` and start with `gemini` |

Returns `{ models: ["id1", "id2", …] }` (bare model IDs, no provider prefix) or `{ error: "…" }`.

### `resolveProviderFromRequest(request, env)`

Shared helper used by `/api/chat`, `/api/provider-test`, and `/api/provider-models`. Reads `X-Provider-Type`, `X-Provider-Key`, `X-Provider-URL`, `X-Provider-Encrypted`, `X-Provider-Enc-Key` from request headers. Decrypts the key if encrypted. Returns `{ providerOverride: { type, apiKey, url } }` or `{ error: Response }`.

### Chat request flow

1. **Auth** — validates `Authorization: Bearer <token>` via `verifyGoogleToken()` (Google tokeninfo). Checks `aud` matches `GOOGLE_CLIENT_ID` and scope includes `drive`.
2. **Email fallback** — fetches `/oauth2/v2/userinfo` if `tokeninfo` lacks an `email` claim.
3. **Allowlist** — `isEmailAuthorized(email, env.AUTHORIZED_EMAILS)`. Denies all if secret unset.
4. **Resolve provider** — calls `resolveProviderFromRequest` if `X-Provider-Type` + `X-Provider-Key` are present.
5. **Parse body** — reads `Chat.Api.CompletionCreateParams` JSON.
6. **Route** — `routeToProvider(body, env, providerOverride)` detects provider from model string or override.
7. **Stream** — wraps provider async iterator in a `ReadableStream`, responds `Content-Type: application/octet-stream`.

### Model routing — `routeToProvider`

| Pattern | Provider | Secret |
|---------|----------|--------|
| `gemini:*` or `gemini-*` | `HashbrownGoogle.stream.text()` | `GEMINI_API_KEY` |
| `claude:*` or `claude-*` | `HashbrownAnthropic.stream.text()` | `ANTHROPIC_API_KEY` |
| `gpt:*`, `o1:*`, `o3:*`, `o4:*`, `chatgpt:*` or bare | `HashbrownOpenAI.stream.text()` | `OPENAI_API_KEY` |

When `providerOverride` is set (from `resolveProviderFromRequest`) it takes precedence over model-string routing.

### Worker secrets

| Secret | Description |
|--------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `AUTHORIZED_EMAILS` | Comma-separated allowed emails |
| `GEMINI_API_KEY` | Google AI Studio key |
| `ANTHROPIC_API_KEY` | Anthropic key |
| `OPENAI_API_KEY` | OpenAI key |

---

## Configuration — `config.js`

| Key | Required | Description |
|-----|----------|-------------|
| `AI_URL` | Yes (to enable AI) | Base URL of the Cloudflare Worker |
| `AI_MODEL` | No | Default model when no providers are configured, e.g. `gemini:gemini-flash-lite-latest` |

When `AI_URL` is absent `isAiConfigured()` returns `false` and the AI button is hidden.

---

## CSS

Classes in `css/app.css`:

**Chat panel** (`/* ── AI Chat Panel */`)
- `.ai-panel` — `position: fixed; right: 0; top/bottom: 0; width: 360px; z-index: 200`.
- `.ai-message--user` — user bubble with primary-colour tint.
- `.ai-tool-badge--running/done/error` — amber / green / red status badges.
- `.ai-typing` — three-dot bounce animation.

**Document context** (`/* ── AI Document Context */`)
- `.ai-doc-context-chip` — narrow strip between the header and message list; shows the type badge and document name.
- `.ai-doc-context-type` — uppercase pill badge (e.g. `PAGE`, `SNIPPET`) in primary-colour tint.
- `.ai-doc-context-name` — truncated document name with `text-overflow: ellipsis`.
- `.ai-context-note` — in-message context note; left-border accent, muted background, small font. Rendered for `role: 'doc-context'` messages.

**Settings panel** (`/* ── AI Settings Panel */`)
- `.ai-settings-panel` — `flex: 1; overflow: hidden` inside `.ai-panel`.
- `.ai-settings-item` — bordered card row for each provider in the list.
- `.ai-settings-form` — scrollable form area with label + input pairs.
- `.ai-settings-btn-primary / secondary` — Save / Cancel buttons.

All colours use `hsl(var(--*))` tokens; dark mode is handled automatically.

---

## Behaviours

| Scenario | Behaviour |
|----------|-----------|
| `AI_URL` not set | `aiEnabled = false`, button hidden, no errors |
| No providers configured | Model list fetched from backend `/api/models`; `CONFIG.AI_MODEL` used as default |
| Providers configured | `window.AI_MODELS` built from providers; no backend model fetch |
| Panel opened first time | `createAiChat` called lazily with resolved provider |
| `createAiChat` fails | Toast shown, panel stays closed, `aiChat` remains null |
| Model changed | Old chat instance destroyed, new one created with correct provider headers |
| Provider added / edited | `onProvidersChange` → Drive save → `window.AI_MODELS` rebuilt |
| Provider deleted | Same as above; if active model belonged to deleted provider, next open picks first available |
| Panel opened on a markdown/snippet page | Context chip shows document name; a context note is injected into the message list |
| User navigates to a different page while panel is open | `documentContext` computed updates; panel injects a new context note only if path or type changed |
| Panel opened on a folder, drawing, asset, or notebook | `documentContext` is `null`; no chip or context note shown |
| AI calls `getCurrentContent` / `updateCurrentDocument` | Reads from / writes to `window._currentDocContext`; update triggers `_refreshCurrentDoc()` |
| Manual save (Cmd+S / Save button) | `fileContent` and `window._currentDocContext.content` both updated |
| Tool call in progress | Badge shows `⏳ <label>` |
| Tool call succeeds | Badge updates to `✓ <label>` |
| Tool call throws | Badge updates to `✗ <label> <error>` |
| LLM error | Error bar with Retry (`resendMessages()`) |
| User closes panel | `aiPanelOpen = false`; Hashbrown instance stays alive, history preserved |
| App unmounts | `aiChat.destroy()` stops the effect loop |
| Custom prompt saved | `onCustomPromptChange` updates the wiki item, persists to Drive, then recreates the chat so the new instructions are active immediately |
| Wiki with no `currentWikiName` (static config) | `currentWikiCustomPrompt` returns `''`; prompt cannot be saved (no wiki item to write to) |
| "Test connection" clicked in provider form | `testAiProvider` → `POST /api/provider-test` → badge shows ✓ Connected or ✗ error with message |
| "Discover models" clicked in provider form | `discoverProviderModels` → `POST /api/provider-models` → models textarea populated; badge shows ✓ Updated or ✗ error |
| Provider has no API key and no encrypted key | "Test connection" and "Discover models" buttons are disabled (`canTestOrDiscover = false`) |
