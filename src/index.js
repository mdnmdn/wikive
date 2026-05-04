export { WikiRoom } from './wiki-room.js';

import { HashbrownAnthropic } from '@hashbrownai/anthropic';
import { HashbrownGoogle } from '@hashbrownai/google';
import { HashbrownOpenAI } from '@hashbrownai/openai';

// Google's tokeninfo endpoint — validates an access token and returns its claims.
const TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

const MODEL_REGISTRY = [
  { value: 'gemini:gemini-flash-lite-latest', label: 'Gemini Flash Lite', provider: 'gemini' },
  { value: 'gemini:gemini-2.0-flash',         label: 'Gemini 2.0 Flash',  provider: 'gemini' },
  { value: 'claude:claude-3-5-haiku-20241022',label: 'Claude Haiku 3.5',  provider: 'claude' },
  { value: 'claude:claude-sonnet-4-5',        label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'gpt:gpt-4o-mini',                 label: 'GPT-4o mini',       provider: 'gpt'    },
  { value: 'gpt:gpt-4o',                      label: 'GPT-4o',            provider: 'gpt'    },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === '/health') {
      return json({ ok: true });
    }

    // Available models endpoint
    if (url.pathname === '/api/models' && request.method === 'GET') {
      return handleModels(request, env);
    }

    // AI chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    // Encrypt API keys endpoint
    if (url.pathname === '/api/encrypt' && request.method === 'POST') {
      return handleEncrypt(request, env);
    }

    // Provider connectivity test
    if (url.pathname === '/api/provider-test' && request.method === 'POST') {
      return handleProviderTest(request, env);
    }

    // Provider model discovery
    if (url.pathname === '/api/provider-models' && request.method === 'POST') {
      return handleProviderModels(request, env);
    }

    // Public share proxy for anonymously shared Drive files.
    // Avoids browser-side CORS/XHR restrictions on drive.usercontent.google.com.
    if (url.pathname === '/share-file') {
      const fileId = url.searchParams.get('file');
      const resourceKey = url.searchParams.get('resourceKey') || '';
      if (!fileId) {
        return json({ error: 'file parameter required' }, 400);
      }

      const upstreamUrl = new URL('https://drive.usercontent.google.com/download');
      upstreamUrl.searchParams.set('id', fileId);
      upstreamUrl.searchParams.set('export', 'download');

      const headers = {};
      if (resourceKey) {
        headers['X-Goog-Drive-Resource-Keys'] = `${fileId}/${resourceKey}`;
      }

      const upstream = await fetch(upstreamUrl.toString(), { headers });
      if (!upstream.ok) {
        return json({ error: 'upstream fetch failed', status: upstream.status }, upstream.status);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders(),
        },
      });
    }

    // WebSocket endpoint: /ws?room=<rootFolderName>&token=<google_access_token>
    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room');
      if (!room) {
        return json({ error: 'room parameter required' }, 400);
      }

      // --- Auth gate ---
      const token = url.searchParams.get('token');
      if (!token) {
        return json({ error: 'token required' }, 401);
      }

      const claims = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
      if (!claims) {
        return json({ error: 'invalid or expired token' }, 401);
      }

      // Strip the token from the URL before forwarding to the DO
      // (avoids the token being accessible inside the DO via request.url)
      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete('token');
      const cleanRequest = new Request(cleanUrl.toString(), request);

      // Route to the Durable Object for this wiki room
      const id = env.WIKI_ROOM.idFromName(room);
      const stub = env.WIKI_ROOM.get(id);
      return stub.fetch(cleanRequest);
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  },
};

/**
 * Validates a Google OAuth2 access token.
 * Returns the token claims on success, null on failure.
 *
 * Checks:
 *  - Token is active (Google's tokeninfo returns 200)
 *  - `aud` matches the configured GOOGLE_CLIENT_ID (prevents tokens from
 *    other apps being used to connect to your wiki room)
 *  - `scope` includes drive.file
 */
async function verifyGoogleToken(token, expectedClientId) {
  try {
    const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null; // expired or revoked

    const claims = await res.json();

    // `aud` is the OAuth client ID the token was issued to
    if (expectedClientId && claims.aud !== expectedClientId) return null;

    // Must have drive.file scope (or any drive scope)
    const scope = claims.scope || '';
    if (!scope.includes('drive')) return null;

    return claims;
  } catch {
    return null;
  }
}

// Verifies the Google token and resolves email; does NOT check AUTHORIZED_EMAILS.
async function verifyRequestToken(request, env) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: json({ error: 'Authorization header required' }, 401) };

  const claims = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
  if (!claims) return { error: json({ error: 'Invalid or expired Google token' }, 401) };

  let email = claims.email;
  if (!email) {
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userInfo.ok) email = (await userInfo.json()).email;
  }

  return { claims, email, token };
}

// Full auth: token verification + AUTHORIZED_EMAILS check (used for /encrypt and backend-provider chat).
async function authenticateRequest(request, env) {
  const auth = await verifyRequestToken(request, env);
  if (auth.error) return auth;

  if (!isEmailAuthorized(auth.email, env.AUTHORIZED_EMAILS)) {
    return { error: json({ error: 'Access denied' }, 403) };
  }

  return auth;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(request) {
  const origin = request?.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Provider-Type, X-Provider-Key, X-Provider-URL, X-Provider-Encrypted, X-Provider-Enc-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// ── Crypto helpers (AES-256-GCM, key derived via HMAC-SHA-256) ───────────────

// Derives a 256-bit AES-GCM key from a worker secret and a per-user client key.
// Both parts must be present to decrypt — neither alone is sufficient.
async function deriveKey(secret, clientKey) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(clientKey));
  return crypto.subtle.importKey('raw', signature, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decryptText(key, encoded) {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    key,
    bytes.slice(12)
  );
  return new TextDecoder().decode(plaintext);
}

// ── Models endpoint ───────────────────────────────────────────────────────────

function handleModels(request, env) {
  const configured = new Set();
  if (env.GEMINI_API_KEY)    configured.add('gemini');
  if (env.ANTHROPIC_API_KEY) configured.add('claude');
  if (env.OPENAI_API_KEY)    configured.add('gpt');
  const models = MODEL_REGISTRY.filter(m => configured.has(m.provider));
  return json(models);
}

// ── Encrypt endpoint ──────────────────────────────────────────────────────────

async function handleEncrypt(request, env) {
  if (!env.ENCRYPTION_SECRET) {
    return json({ error: 'Encryption not configured on this server' }, 503);
  }

  const auth = await authenticateRequest(request, env);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { key, texts } = body;
  if (!key || !Array.isArray(texts) || texts.length === 0) {
    return json({ error: 'key (string) and texts (non-empty array) are required' }, 400);
  }

  try {
    const aesKey = await deriveKey(env.ENCRYPTION_SECRET, key);
    const encrypted = await Promise.all(texts.map(t => encryptText(aesKey, t)));
    return json({ encrypted });
  } catch (e) {
    return json({ error: 'Encryption failed: ' + e.message }, 500);
  }
}

// ── AI Chat handler ───────────────────────────────────────────────────────────

async function handleChat(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }

  // Verify token for all requests
  const auth = await verifyRequestToken(request, env);
  if (auth.error) return auth.error;

  // Check if user is authorized for backend default providers
  const isAuthorized = isEmailAuthorized(auth.email, env.AUTHORIZED_EMAILS);

  // Resolve provider from X-Provider-* headers (null if no override)
  const providerType = request.headers.get('X-Provider-Type') || '';
  const providerKey  = request.headers.get('X-Provider-Key')  || '';

  let providerOverride = null;
  if (providerType && providerKey) {
    const resolved = await resolveProviderFromRequest(request, env);
    if (resolved.error) return resolved.error;
    providerOverride = resolved.providerOverride;
  }

  // Parse request body (Chat.Api.CompletionCreateParams)
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Route to the correct provider by model name or override
  let stream;
  try {
    stream = routeToProvider(body, env, providerOverride, isAuthorized);
  } catch (err) {
    return json({ error: err.message }, 400);
  }

  // Stream encoded frames back to the client
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

// ── Provider routing ─────────────────────────────────────────────────────────

function routeToProvider(body, env, override = null, isAuthorized = false) {
  if (override) {
    const { type, apiKey, url } = override;
    const opts = { apiKey, request: { ...body } };
    if (url) opts.baseURL = url;
    if (type === 'openai')    return HashbrownOpenAI.stream.text(opts);
    if (type === 'anthropic') return HashbrownAnthropic.stream.text(opts);
    if (type === 'gemini')    return HashbrownGoogle.stream.text(opts);
    throw new Error(`Unknown provider type: "${type}"`);
  }

  // Only allow backend default providers for authorized users
  if (!isAuthorized) {
    throw new Error('No provider configured. Please add a provider in AI Settings.');
  }

  const fullModel = body.model ?? '';
  const [providerPrefix, modelName] = fullModel.includes(':')
    ? fullModel.split(':')
    : ['', fullModel];

  // Strip provider prefix from model name before passing to provider
  const model = modelName || fullModel;

  if (providerPrefix === 'gemini' || fullModel.startsWith('gemini-')) {
    if (!env.GEMINI_API_KEY) throw new Error('Google AI not configured');
    return HashbrownGoogle.stream.text({ apiKey: env.GEMINI_API_KEY, request: { ...body, model } });
  }

  if (providerPrefix === 'claude' || fullModel.startsWith('claude-')) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('Anthropic not configured');
    return HashbrownAnthropic.stream.text({ apiKey: env.ANTHROPIC_API_KEY, request: { ...body, model } });
  }

  if (
    providerPrefix === 'gpt' ||
    providerPrefix === 'o1' ||
    providerPrefix === 'o3' ||
    providerPrefix === 'o4' ||
    providerPrefix === 'chatgpt' ||
    fullModel.startsWith('gpt-') ||
    fullModel.startsWith('o1-') ||
    fullModel.startsWith('o3-') ||
    fullModel.startsWith('o4-') ||
    fullModel.startsWith('chatgpt-')
  ) {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI not configured');
    return HashbrownOpenAI.stream.text({ apiKey: env.OPENAI_API_KEY, request: { ...body, model } });
  }

  throw new Error(`Unknown model prefix: "${fullModel}". Use gemini:*, claude:*, or gpt:* / o1:* / o3:* / o4:*`);
}

// ── Provider test ────────────────────────────────────────────────────────────

async function handleProviderTest(request, env) {
  // Use verifyRequestToken instead of authenticateRequest to allow all authenticated users
  // (non-authorized users can still test their frontend-configured providers)
  const auth = await verifyRequestToken(request, env);
  if (auth.error) return auth.error;

  const { providerOverride, error: resolveError } = await resolveProviderFromRequest(request, env);
  if (resolveError) return resolveError;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const model = (body.model || '').trim();
  if (!model) return json({ error: 'model is required' }, 400);

  try {
    const { type, apiKey, url: baseUrl } = providerOverride;
    let res;

    if (type === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with just "OK".' }],
          max_tokens: 5,
        }),
      });
    } else if (type === 'gemini') {
      const modelId = model.replace(/^gemini[:/]/, '');
      const endpoint = (baseUrl || 'https://generativelanguage.googleapis.com') +
        `/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with just "OK".' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
    } else {
      // openai-compatible
      const base = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
      res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with just "OK".' }],
          max_tokens: 5,
        }),
      });
    }

    if (res.ok) return json({ ok: true });
    const errBody = await res.text().catch(() => '');
    let errMsg;
    try { errMsg = JSON.parse(errBody)?.error?.message || errBody; } catch { errMsg = errBody; }
    return json({ ok: false, error: `Provider returned ${res.status}: ${errMsg}` });
  } catch (e) {
    return json({ ok: false, error: e.message });
  }
}

// ── Provider model discovery ──────────────────────────────────────────────────

async function handleProviderModels(request, env) {
  // Use verifyRequestToken instead of authenticateRequest to allow all authenticated users
  // (non-authorized users can still discover models from their frontend-configured providers)
  const auth = await verifyRequestToken(request, env);
  if (auth.error) return auth.error;

  const { providerOverride, error: resolveError } = await resolveProviderFromRequest(request, env);
  if (resolveError) return resolveError;

  const { type, apiKey, url: baseUrl } = providerOverride;

  try {
    if (type === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      if (!res.ok) return json({ error: `Anthropic returned ${res.status}` });
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).sort();
      return json({ models });
    }

    if (type === 'gemini') {
      const endpoint = (baseUrl || 'https://generativelanguage.googleapis.com') +
        `/v1beta/models?key=${apiKey}&pageSize=100`;
      const res = await fetch(endpoint);
      if (!res.ok) return json({ error: `Gemini returned ${res.status}` });
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(m => m.startsWith('gemini'))
        .sort();
      return json({ models });
    }

    // openai-compatible
    const base = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const res = await fetch(`${base}/v1/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) return json({ error: `Provider returned ${res.status}` });
    const data = await res.json();
    const CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'];
    const models = (data.data || [])
      .map(m => m.id)
      .filter(id => CHAT_PREFIXES.some(p => id.startsWith(p)))
      .sort();
    return json({ models: models.length ? models : (data.data || []).map(m => m.id).sort() });
  } catch (e) {
    return json({ error: e.message });
  }
}

// ── Shared provider resolution ────────────────────────────────────────────────

async function resolveProviderFromRequest(request, env) {
  const providerType = request.headers.get('X-Provider-Type') || '';
  const providerKey  = request.headers.get('X-Provider-Key')  || '';
  const providerUrl  = request.headers.get('X-Provider-URL')  || '';
  const isEncrypted  = request.headers.get('X-Provider-Encrypted') === 'true';
  const encClientKey = request.headers.get('X-Provider-Enc-Key') || '';

  if (!providerType || !providerKey) {
    return { error: json({ error: 'X-Provider-Type and X-Provider-Key headers are required' }, 400) };
  }

  let resolvedApiKey = providerKey;
  if (isEncrypted && providerKey && encClientKey) {
    if (!env.ENCRYPTION_SECRET) {
      return { error: json({ error: 'Server-side encryption not configured' }, 503) };
    }
    try {
      const aesKey = await deriveKey(env.ENCRYPTION_SECRET, encClientKey);
      resolvedApiKey = await decryptText(aesKey, providerKey);
    } catch {
      return { error: json({ error: 'Failed to decrypt API key' }, 400) };
    }
  }

  return { providerOverride: { type: providerType, apiKey: resolvedApiKey, url: providerUrl } };
}

// ── Email authorization ─────────────────────────────────────────────────────

function isEmailAuthorized(email, authorizedEmailsEnv) {
  if (!email) return false;
  if (!authorizedEmailsEnv) return false; // deny all if secret not set
  const allowed = authorizedEmailsEnv
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
