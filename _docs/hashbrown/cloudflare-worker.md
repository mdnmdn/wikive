# Cloudflare Worker — AI Chat Handler

The AI chat route is added to the **existing** `worker/src/index.js` alongside
the WebSocket and share-proxy routes. The worker already has `verifyGoogleToken()`
and `GOOGLE_CLIENT_ID`; we extend it with multi-provider routing and an email
allowlist.

## How the request flows

```
Browser                          Worker (worker/src/index.js)
──────────────────────────────   ─────────────────────────────────────────────
fryHashbrown()                   POST /api/chat
  HttpTransport                    Authorization: Bearer <google_access_token>
    └─ POST /api/chat  ─────────►  1. verifyGoogleToken(token, GOOGLE_CLIENT_ID)
       body: CompletionCreateParams    → tokeninfo endpoint (email + aud check)
                                    2. isEmailAuthorized(email, AUTHORIZED_EMAILS)
                                    3. routeToProvider(request.model)
                                         gemini-*  → HashbrownGoogle.stream.text()
                                         claude-*  → HashbrownAnthropic.stream.text()
                                         gpt-*     → HashbrownOpenAI.stream.text()
  ◄────── ReadableStream<frames> ──── encodeFrame() × N (streaming)
```

## package.json additions

```json
{
  "name": "wiki-realtime",
  "dependencies": {
    "@hashbrownai/anthropic": "^0.5.0-beta.4",
    "@hashbrownai/google":    "^0.5.0-beta.4",
    "@hashbrownai/openai":    "^0.5.0-beta.4"
  }
}
```

Run `npm install` inside `worker/` after adding these.

> All three provider packages are installed even if only one is used at a time.
> They are server-only and don't affect the browser bundle.

## Secrets to configure

```sh
# Already set:
npx wrangler secret put GOOGLE_CLIENT_ID   # OAuth client ID (reused from /ws auth)

# New secrets:
npx wrangler secret put AUTHORIZED_EMAILS  # Comma-separated, e.g. "alice@gmail.com,bob@gmail.com"
npx wrangler secret put GOOGLE_AI_API_KEY  # Google AI Studio key (for Gemini)
npx wrangler secret put ANTHROPIC_API_KEY  # Anthropic key (for Claude)
npx wrangler secret put OPENAI_API_KEY     # OpenAI key (for GPT / o-series)
```

## Updated worker/src/index.js

Add the import block and the `/api/chat` route to the existing file.

```js
// worker/src/index.js
import { HashbrownAnthropic } from '@hashbrownai/anthropic';
import { HashbrownGoogle }    from '@hashbrownai/google';
import { HashbrownOpenAI }    from '@hashbrownai/openai';

export { WikiRoom } from './wiki-room.js';

const TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true });
    }

    // ── AI chat ────────────────────────────────────────────────────────────
    if (url.pathname === '/api/chat') {
      return handleChat(request, env);
    }

    // ── Share proxy (unchanged) ────────────────────────────────────────────
    if (url.pathname === '/share-file') {
      // ... existing code unchanged ...
    }

    // ── WebSocket (unchanged) ─────────────────────────────────────────────
    if (url.pathname === '/ws') {
      // ... existing code unchanged ...
    }

    return json({ error: 'not found' }, 404);
  },
};

// ── Chat handler ───────────────────────────────────────────────────────────

async function handleChat(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  // 1. Validate Google access token from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json({ error: 'Authorization header required' }, 401);
  }

  const claims = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
  if (!claims) {
    return json({ error: 'Invalid or expired Google token' }, 401);
  }

  // 2. Check email against the authorized list
  if (!isEmailAuthorized(claims.email, env.AUTHORIZED_EMAILS)) {
    return json({ error: 'Access denied' }, 403);
  }

  // 3. Parse request body (Chat.Api.CompletionCreateParams)
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // 4. Route to the correct provider by model name
  let stream;
  try {
    stream = routeToProvider(body, env);
  } catch (err) {
    return json({ error: err.message }, 400);
  }

  // 5. Stream encoded frames back to the client
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

// ── Provider routing ───────────────────────────────────────────────────────

/**
 * Detect provider from the model name prefix and call the matching adapter.
 * The model string is sent by the client and is the only routing key.
 */
function routeToProvider(body, env) {
  const model = body.model ?? '';

  if (model.startsWith('gemini-')) {
    if (!env.GOOGLE_AI_API_KEY) throw new Error('Google AI not configured');
    return HashbrownGoogle.stream.text({ apiKey: env.GOOGLE_AI_API_KEY, request: body });
  }

  if (model.startsWith('claude-')) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('Anthropic not configured');
    return HashbrownAnthropic.stream.text({ apiKey: env.ANTHROPIC_API_KEY, request: body });
  }

  if (
    model.startsWith('gpt-')      ||
    model.startsWith('o1-')       ||
    model.startsWith('o3-')       ||
    model.startsWith('o4-')       ||
    model.startsWith('chatgpt-')
  ) {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI not configured');
    return HashbrownOpenAI.stream.text({ apiKey: env.OPENAI_API_KEY, request: body });
  }

  throw new Error(`Unknown model prefix: "${model}". ` +
    'Use gemini-*, claude-*, or gpt-* / o1-* / o3-* / o4-*.');
}

// ── Auth helpers ───────────────────────────────────────────────────────────

/**
 * Validates a Google OAuth2 access token via the tokeninfo endpoint.
 * Returns token claims on success, null on failure.
 * Reused unchanged from the existing /ws auth logic.
 */
async function verifyGoogleToken(token, expectedClientId) {
  try {
    const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const claims = await res.json();
    if (expectedClientId && claims.aud !== expectedClientId) return null;
    const scope = claims.scope ?? '';
    if (!scope.includes('drive')) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Checks whether the token's email is in the AUTHORIZED_EMAILS list.
 * AUTHORIZED_EMAILS is a Worker secret: comma-separated email addresses.
 * Example: "alice@gmail.com,bob@example.com"
 */
function isEmailAuthorized(email, authorizedEmailsEnv) {
  if (!email) return false;
  if (!authorizedEmailsEnv) return false; // deny all if secret not set
  const allowed = authorizedEmailsEnv
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(request) {
  // In production, replace '*' with the actual wiki origin
  const origin = request?.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
```

## Selecting providers from the client

The client picks the provider by setting the `model` string. No other change needed:

```js
// Gemini (Google)
const chat = fryHashbrown({ model: 'gemini-2.0-flash', ... });

// Claude (Anthropic)
const chat = fryHashbrown({ model: 'claude-3-5-sonnet-20241022', ... });

// GPT (OpenAI)
const chat = fryHashbrown({ model: 'gpt-4o', ... });
```

The server detects the provider from the prefix and routes accordingly.
Only the API key for that provider needs to be set as a Worker secret.

## Sending the auth token from the client

Use Hashbrown's `middleware` option on `createHttpTransport` to attach the
Google access token on every request:

```js
// js/services/ai-chat.js
import { fryHashbrown, createHttpTransport } from '@hashbrownai/core';
import AuthManager from './auth-manager.js';  // existing service
import CONFIG from '../config.js';

export function createAiChat({ system, tools = [], model }) {
  const transport = createHttpTransport({
    baseUrl: `${CONFIG.WORKER_URL}/api/chat`,
    middleware: [
      async (requestInit) => {
        const token = AuthManager.getAccessToken(); // existing token getter
        return {
          ...requestInit,
          headers: {
            ...requestInit.headers,
            'Authorization': `Bearer ${token}`,
          },
        };
      },
    ],
  });

  const chat = fryHashbrown({ model, system, tools, transport });
  const cleanup = chat.sizzle();
  return { chat, destroy: cleanup };
}
```

## Caching the tokeninfo response (optional optimization)

The tokeninfo call adds ~100 ms per request. Cache the result in a Worker KV
namespace with a short TTL to avoid the round-trip on every chat turn:

```js
async function verifyGoogleToken(token, expectedClientId, cache) {
  const cacheKey = `tokeninfo:${token.slice(-16)}`; // use last 16 chars as key
  const cached = cache ? await cache.get(cacheKey, 'json') : null;
  if (cached) return cached;

  const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  const claims = await res.json();
  if (expectedClientId && claims.aud !== expectedClientId) return null;
  if (!(claims.scope ?? '').includes('drive')) return null;

  const ttl = Math.min(claims.expires_in ?? 60, 300); // cache up to 5 min
  if (cache) await cache.put(cacheKey, JSON.stringify(claims), { expirationTtl: ttl });
  return claims;
}

// In wrangler.toml, add:
// [[kv_namespaces]]
// binding = "TOKEN_CACHE"
// id = "<your-kv-namespace-id>"

// Then call: verifyGoogleToken(token, env.GOOGLE_CLIENT_ID, env.TOKEN_CACHE)
```

## References

| Resource | URL |
|----------|-----|
| `@hashbrownai/anthropic` source — `stream.text()` | https://github.com/liveloveapp/hashbrown/blob/main/packages/anthropic/src/stream/text.fn.ts |
| `@hashbrownai/openai` source — `stream.text()` | https://github.com/liveloveapp/hashbrown/blob/main/packages/openai/src/stream/text.fn.ts |
| `@hashbrownai/google` source — `stream.text()` | https://github.com/liveloveapp/hashbrown/blob/main/packages/google/src/stream/text.fn.ts |
| Platform docs: Anthropic adapter | https://hashbrown.dev/docs/react/platform/anthropic |
| Platform docs: Google Gemini adapter | https://hashbrown.dev/docs/react/platform/google |
| Platform docs: OpenAI adapter | https://hashbrown.dev/docs/react/platform/openai |
| Platform docs: Azure adapter | https://hashbrown.dev/docs/react/platform/azure |
| Platform docs: Ollama (local) | https://hashbrown.dev/docs/react/platform/ollama |
| Platform docs: custom adapter | https://hashbrown.dev/docs/react/platform/custom |
| Thread persistence recipe | https://hashbrown.dev/docs/react/recipes/threads |
| Google tokeninfo endpoint | https://www.googleapis.com/oauth2/v3/tokeninfo |
| Cloudflare Workers secrets docs | https://developers.cloudflare.com/workers/configuration/secrets/ |
| Cloudflare KV docs | https://developers.cloudflare.com/kv/ |
