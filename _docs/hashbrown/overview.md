# Hashbrown Integration Overview

Hashbrown (`@hashbrownai/core`) is a framework-agnostic frontend AI chat library.
It handles streaming LLM communication, state management, tool calling, and structured output.
This wiki uses it to power the in-app AI assistant that can read and modify documents.

## Packages

| Package | Role | npm | Source |
|---------|------|-----|--------|
| `@hashbrownai/core` | Framework-agnostic core: `fryHashbrown`, transport, schema (`s.*`), frame codec | [npm](https://www.npmjs.com/package/@hashbrownai/core) | [packages/core](https://github.com/liveloveapp/hashbrown/tree/main/packages/core) |
| `@hashbrownai/anthropic` | Server-side Anthropic streaming adapter | [npm](https://www.npmjs.com/package/@hashbrownai/anthropic) | [packages/anthropic](https://github.com/liveloveapp/hashbrown/tree/main/packages/anthropic) |
| `@hashbrownai/openai` | Server-side OpenAI streaming adapter | [npm](https://www.npmjs.com/package/@hashbrownai/openai) | [packages/openai](https://github.com/liveloveapp/hashbrown/tree/main/packages/openai) |
| `@hashbrownai/google` | Server-side Google Gemini streaming adapter | [npm](https://www.npmjs.com/package/@hashbrownai/google) | [packages/google](https://github.com/liveloveapp/hashbrown/tree/main/packages/google) |

The React/Angular packages are not used — this app is vanilla JS + Vue 3.

## Architecture

```
Browser                                  Cloudflare Worker (worker/src/index.js)
────────────────────────────────         ──────────────────────────────────────────
fryHashbrown({ model: 'gemini-*' })      POST /api/chat
  HttpTransport + auth middleware          Authorization: Bearer <google_access_token>
    └─ POST /api/chat  ─────────────────► verifyGoogleToken() → Google tokeninfo API
       body: CompletionCreateParams        isEmailAuthorized() → AUTHORIZED_EMAILS secret
                                           routeToProvider(body.model):
                                             gemini-* → HashbrownGoogle.stream.text()
                                             claude-* → HashbrownAnthropic.stream.text()
                                             gpt-*    → HashbrownOpenAI.stream.text()
  ◄──── ReadableStream<Uint8Array> ────── encodeFrame() × N  (binary frame stream)
  └─ decodeFrames() → Frame events
      └─ state machine → messages signal
              → tool calls executed in browser → tool messages → next generation turn
```

## Wire Protocol

All communication uses **length-prefixed binary frames** over a single HTTP POST.

```
[4-byte big-endian uint32: payload length][UTF-8 JSON payload]
```

Frame types emitted by the server and consumed by the client:

| Frame type | Direction | Meaning |
|------------|-----------|---------|
| `generation-start` | server→client | LLM began generating |
| `generation-chunk` | server→client | Streaming content/tool-call delta |
| `generation-finish` | server→client | LLM finished |
| `generation-error` | server→client | LLM error |
| `thread-load-start/success/failure` | server→client | Thread persistence events |
| `thread-save-start/success/failure` | server→client | Thread persistence events |

The client POSTs `Chat.Api.CompletionCreateParams` as JSON body.
The server responds with `Content-Type: application/octet-stream`.

## Files in this section

| File | Contents |
|------|----------|
| [`overview.md`](overview.md) | This file — architecture and protocol |
| [`vanilla-js-client.md`](vanilla-js-client.md) | `fryHashbrown()` in vanilla JS, auth middleware, model selection |
| [`cloudflare-worker.md`](cloudflare-worker.md) | Multi-provider routing, Google auth validation, email allowlist |
| [`tools.md`](tools.md) | Defining tools the AI can call (document read/write/list/delete) |
| [`schema.md`](schema.md) | Skillet schema language (`s.*`) for typed tool arguments |
| [`in-app-chat-ui.md`](in-app-chat-ui.md) | AiChatPanel component, tool call badges, CSS, model selector |

## External references

| Resource | URL |
|----------|-----|
| Official site | https://hashbrown.dev |
| GitHub repository | https://github.com/liveloveapp/hashbrown |
| GitHub issues | https://github.com/liveloveapp/hashbrown/issues |
| Changelog | https://github.com/liveloveapp/hashbrown/blob/main/CHANGELOG.md |
| AI basics (concepts) | https://hashbrown.dev/docs/react/concept/ai-basics |
| Quick start (React — closest analog for concepts) | https://hashbrown.dev/docs/react/start/quick |
| Wire protocol — `encodeFrame` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/frames/encode-frame.ts |
| Wire protocol — `decodeFrames` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/frames/decode-frames.ts |
| Frame types source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/frames/frame-types.ts |
| `Chat.Api` models source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/models/api.models.ts |
