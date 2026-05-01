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
| `src/js/services/ai-chat.js` | `createAiChat()` — wraps `fryHashbrown`, attaches auth + optional provider middlewares, exposes `updateModel` |
| `src/js/services/ai-tools.js` | `getWikiTools()` — four tools the LLM can call: `readPage`, `writePage`, `listPages`, `deletePage` |
| `src/js/services/ai-prompt.js` | `WIKI_ASSISTANT_SYSTEM` — system prompt constant, injects the wiki root folder name |
| `src/js/components/AiChatPanel.js` | Vue component — fixed slide-in panel, model selector, gear toggle to open settings, message list, tool-call badges, input bar |
| `src/js/components/AiSettingsPanel.js` | Vue component — embedded settings view for managing AI provider configurations (add / edit / delete) |
| `src/js/app.js` | Mounts `AiChatPanel`, owns `aiChat`/`aiPanelOpen`/`aiModel`/`aiProviders` state, lazy-initialises the chat instance, persists providers to Drive |
| `src/js/components/AppHeader.js` | Renders the AI toggle button when `aiEnabled` is true, emits `toggle-ai-chat` |
| `src/js/providers/GoogleDriveProvider.js` | Persists `wiki_definitions.json` in `{ wikis, aiProviders }` format; back-compat with old plain-array format |
| `src/config.js` | `AI_URL` (required to enable AI), `AI_MODEL` (default model when no providers configured) |
| `worker/src/index.js` | `handleChat()`, `routeToProvider()`, `verifyGoogleToken()`, `isEmailAuthorized()` |
| `worker/package.json` | Adds `@hashbrownai/anthropic`, `@hashbrownai/google`, `@hashbrownai/openai` as Worker dependencies |

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
    { "wikiName": "default", "rootFolder": "_wiki" }
  ],
  "aiProviders": [
    { "id": "…", "name": "…", "type": "anthropic", "apiKey": "…", "url": "", "models": ["…"] }
  ]
}
```

`GoogleDriveProvider.getWikiDefinitions()` returns `{ id, wikis, aiProviders }`.
`GoogleDriveProvider.saveWikiDefinitions({ wikis, aiProviders })` saves the object form.

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

---

## Tools — `ai-tools.js`

`getWikiTools()` returns an array of tool objects:

```
{ name, description, handler(args, signal) }
```

All handlers delegate to `StorageService`.

| Tool | Description | Key behaviour |
|------|-------------|---------------|
| `readPage` | Read markdown content of a page | Resolves path, fetches via `StorageService.getFileContent` |
| `writePage` | Create or overwrite a page | Resolves path: updates if exists, creates otherwise (appends `.md`) |
| `listPages` | List all wiki pages, optional prefix filter | Lists root folder, filters to `.md` files, strips extension |
| `deletePage` | Delete a page | Resolves path, calls `StorageService.deleteFile` |

Hashbrown wraps each handler result as `PromiseSettledResult<T>`:
- `{ status: 'fulfilled', value: … }` on success
- `{ status: 'rejected', reason: … }` on exception

---

## System Prompt — `ai-prompt.js`

`WIKI_ASSISTANT_SYSTEM` is injected at chat creation time. It describes:
- The wiki context (Google Drive backed personal wiki).
- Available tools and their intent.
- Editorial rules: preserve structure, clean Markdown, no invented content.
- Requirement to confirm before `writePage` or `deletePage`.
- The current wiki root folder name (from `CONFIG.ROOT_FOLDER_NAME`).

---

## UI — `AiChatPanel.js`

A fixed-position panel that slides in from the right edge of the viewport.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `chat` | Object | The object returned by `createAiChat`: `{ chat, destroy, updateModel }` |
| `model` | String | Currently selected model value (may be `provideId::modelName`) |
| `pageContext` | String | Current wiki path — reserved for context injection |
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

### State signals subscribed in `mounted`

| Signal | Vue data | Use |
|--------|----------|-----|
| `chat.messages` | `messages` | Full message history; triggers auto-scroll |
| `chat.isGenerating` | `isGenerating` | Disables input, shows typing indicator |
| `chat.isRunningToolCalls` | `isRunningToolCalls` | Differentiates "thinking" from "tool running" |
| `chat.error` | `error` | Shows error bar with retry button |

### Computed properties

**`effectiveModels`** — when providers are configured, builds model options from them; otherwise returns `window.AI_MODELS` from the backend.

**`visibleMessages`** — filters to `user` and `assistant` roles only.

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

### Input behaviour

- `Enter` sends; `Shift+Enter` inserts a newline.
- Textarea and send button disabled while `isGenerating`.
- Retry button calls `chat.chat.resendMessages()`.

---

## UI — `AiSettingsPanel.js`

Embedded inside `AiChatPanel` (replaces the message area when the gear is toggled).

### Props

| Prop | Type | Description |
|------|------|-------------|
| `providers` | Array | Current provider list from `app.js` |
| `saving` | Boolean | True while the parent is persisting to Drive |

### Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `save` | providers array | A provider was added, edited, or deleted; parent should persist |
| `back` | — | User clicked the back arrow; parent hides the settings panel |

### Internal state

`editing: null` — list view. `editing: { id, name, type, apiKey, url, models }` — edit/add form.
`isNew` computed distinguishes add (id not yet in list) from edit.

### Form fields

| Field | Input type | Notes |
|-------|-----------|-------|
| Name | text | Required |
| Type | select | `openai` / `anthropic` / `gemini` |
| API Key | password | `autocomplete="off"` |
| Base URL | text | Optional; empty string means use provider default |
| Models | textarea | One model name per line; split on `\n`, trimmed, empty lines removed |

On **Save**, the component splices the provider into its local copy of the list and emits `save`
with the full updated array. The parent (`app.js`) then persists to Drive and rebuilds
`window.AI_MODELS`.

On **Delete**, confirmation is requested via `confirm()` before the provider is removed and `save` is emitted.

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

### Lifecycle

- **`mounted`** — restores `aiModel` from `localStorage`.
- **`initApp`** — destructures `{ wikis, aiProviders }` from `StorageService.getWikiDefinitions()` and assigns both.
- **`beforeUnmount`** — calls `this.aiChat?.destroy()`.

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

### `saveWikiDefinitions` call sites

All three wiki mutation methods (`createWikiAndConnect`, `createWikiFromHeader`, `deleteWiki`) pass
`{ wikis: updated, aiProviders: this.aiProviders }` to preserve provider settings across wiki operations.

---

## Cloudflare Worker — `worker/src/index.js`

### Request flow

1. **Auth** — validates `Authorization: Bearer <token>` via `verifyGoogleToken()` (Google tokeninfo). Checks `aud` matches `GOOGLE_CLIENT_ID` and scope includes `drive`.
2. **Email fallback** — fetches `/oauth2/v2/userinfo` if `tokeninfo` lacks an `email` claim.
3. **Allowlist** — `isEmailAuthorized(email, env.AUTHORIZED_EMAILS)`. Denies all if secret unset.
4. **Parse body** — reads `Chat.Api.CompletionCreateParams` JSON.
5. **Route** — `routeToProvider(body, env)` detects provider from model string (or from `X-Provider-*` headers when present).
6. **Stream** — wraps provider async iterator in a `ReadableStream`, responds `Content-Type: application/octet-stream`.

### Model routing — `routeToProvider`

| Pattern | Provider | Secret |
|---------|----------|--------|
| `gemini:*` or `gemini-*` | `HashbrownGoogle.stream.text()` | `GEMINI_API_KEY` |
| `claude:*` or `claude-*` | `HashbrownAnthropic.stream.text()` | `ANTHROPIC_API_KEY` |
| `gpt:*`, `o1:*`, `o3:*`, `o4:*`, `chatgpt:*` or bare | `HashbrownOpenAI.stream.text()` | `OPENAI_API_KEY` |

When `X-Provider-Type` / `X-Provider-Key` headers are present the worker can use them to override
the provider and key instead of its own secrets.

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
| Tool call in progress | Badge shows `⏳ <label>` |
| Tool call succeeds | Badge updates to `✓ <label>` |
| Tool call throws | Badge updates to `✗ <label> <error>` |
| LLM error | Error bar with Retry (`resendMessages()`) |
| User closes panel | `aiPanelOpen = false`; Hashbrown instance stays alive, history preserved |
| App unmounts | `aiChat.destroy()` stops the effect loop |
