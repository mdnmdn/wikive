# Vanilla JS Client

This wiki is a no-build static app. Hashbrown must be consumed via an ESM CDN
(e.g. esm.sh or jsDelivr that serves npm packages as ES modules) — there is no
build step to bundle npm packages.

## Importing

```html
<!-- index.html: load before app.js -->
<script type="importmap">
{
  "imports": {
    "@hashbrownai/core": "https://esm.sh/@hashbrownai/core@0.5.0-beta.4"
  }
}
</script>
```

Then in any module script:

```js
import { fryHashbrown, createHttpTransport, s } from '@hashbrownai/core';
```

## Creating a chat instance

`fryHashbrown()` is the core vanilla JS API. It returns a `Hashbrown` instance
that holds the full chat state as reactive `StateSignal` values.

```js
import { fryHashbrown, createHttpTransport, s } from '@hashbrownai/core';

const chat = fryHashbrown({
  // Which model to request (passed to the server as-is)
  model: 'claude-3-5-sonnet-20241022',

  // System prompt
  system: 'You are a helpful assistant for a personal wiki.',

  // Where to POST chat requests (Cloudflare Worker URL or relative path)
  transport: createHttpTransport({
    baseUrl: 'https://my-worker.workers.dev/api/chat',
    // Optional: attach auth headers
    middleware: [
      async (requestInit) => ({
        ...requestInit,
        headers: { ...requestInit.headers, Authorization: `Bearer ${token}` },
      }),
    ],
  }),

  // Optional: typed response schema (structured output)
  // responseSchema: s.object(...),

  // Optional: pre-registered tools (see tools.md)
  // tools: [readPageTool, writePageTool],

  // Optional: initial messages
  // messages: [{ role: 'user', content: 'Hello' }],
});

// Start the internal effect loop — must be called once.
// Returns a cleanup function; call it when the component unmounts.
const cleanup = chat.sizzle();
```

## StateSignal

Every property on a `Hashbrown` instance is a `StateSignal<T>`:

```ts
interface StateSignal<T> {
  (): T;                                          // read current value synchronously
  subscribe(onChange: (value: T) => void): () => void; // reactive subscription, returns unsubscribe
}
```

Available signals:

| Signal | Type | Description |
|--------|------|-------------|
| `messages` | `Chat.Message[]` | Full message history |
| `isGenerating` | `boolean` | LLM is generating a response |
| `isSending` | `boolean` | Request is in-flight |
| `isReceiving` | `boolean` | Streaming data is arriving |
| `isRunningToolCalls` | `boolean` | Tool calls are executing |
| `isLoading` | `boolean` | Any loading activity |
| `error` | `Error \| undefined` | Latest unified error |
| `sendingError` | `Error \| undefined` | Error during send |
| `generatingError` | `Error \| undefined` | Error from LLM |
| `exhaustedRetries` | `boolean` | All retries failed |
| `lastAssistantMessage` | `AssistantMessage \| undefined` | Most recent assistant turn |
| `threadId` | `string \| undefined` | Thread ID if using persistence |

## Subscribing to state changes (Vue integration)

In a Vue component, drive reactive data from signals:

```js
// In a Vue component's setup() or created()
const messages = Vue.ref([]);
const isGenerating = Vue.ref(false);

const unsub1 = chat.messages.subscribe(v => messages.value = v);
const unsub2 = chat.isGenerating.subscribe(v => isGenerating.value = v);

// Cleanup in beforeUnmount
onBeforeUnmount(() => { unsub1(); unsub2(); cleanup(); });
```

## Sending messages

```js
// User turn
chat.sendMessage({ role: 'user', content: 'Summarize the Home page.' });

// Replace the whole history
chat.setMessages([]);

// Retry after an error
chat.resendMessages();

// Abort a running generation
chat.stop();               // keep partial streaming message
chat.stop(true);           // also clear the partial message
```

## Updating options at runtime

```js
// Change model, system prompt, or tools without recreating the instance
chat.updateOptions({
  system: 'You are now in drawing mode.',
  tools: [newToolSet],
});
```

## Minimal chat UI example

```js
// js/services/ai-chat.js
import { fryHashbrown, createHttpTransport, s } from '@hashbrownai/core';
import { WORKER_URL } from '../config.js';

export function createAiChat({ system, tools = [] }) {
  const chat = fryHashbrown({
    model: 'claude-3-5-sonnet-20241022',
    system,
    tools,
    transport: createHttpTransport({ baseUrl: `${WORKER_URL}/api/chat` }),
  });
  const cleanup = chat.sizzle();

  return {
    sendMessage: (text) => chat.sendMessage({ role: 'user', content: text }),
    messages: chat.messages,
    isGenerating: chat.isGenerating,
    error: chat.error,
    destroy: cleanup,
  };
}
```

## References

| Resource | URL |
|----------|-----|
| `fryHashbrown` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/hashbrown.ts |
| `HttpTransport` / `createHttpTransport` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/transport/http-transport.ts |
| `Transport` interface source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/transport/transport.ts |
| `StateSignal` source (micro-ngrx) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/utils/micro-ngrx.ts |
| `Hashbrown` interface (full API surface) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/hashbrown.ts |
| `@hashbrownai/core` public API index | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/public_api.ts |
| Concepts: runtime / chat loop | https://hashbrown.dev/docs/react/concept/runtime |
| Concepts: system instructions | https://hashbrown.dev/docs/react/concept/system-instructions |
| Concepts: streaming | https://hashbrown.dev/docs/react/concept/streaming |
| `transformRequestOptions` middleware concept | https://hashbrown.dev/docs/react/concept/transform-request-options |
| esm.sh (ESM CDN for npm packages) | https://esm.sh |
