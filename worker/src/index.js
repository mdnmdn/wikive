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

    return json({ error: 'not found' }, 404);
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
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

// ── AI Chat handler ───────────────────────────────────────────────────────────

async function handleChat(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }

  // 1. Validate Google access token from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json({ error: 'Authorization header required' }, 401);
  }

  // 1. Validate Google access token and get user info
  const claims = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
  console.log('DEBUG claims:', claims);
  if (!claims) {
    return json({ error: 'Invalid or expired Google token' }, 401);
  }

  // Get email from userinfo endpoint (tokeninfo doesn't always include email)
  let email = claims.email;
  if (!email) {
    console.log('DEBUG: tokeninfo has no email, trying userinfo endpoint');
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('DEBUG userinfo status:', userInfo.status);
    if (userInfo.ok) {
      const userData = await userInfo.json();
      console.log('DEBUG userinfo data:', userData);
      email = userData.email;
    } else {
      const errorText = await userInfo.text();
      console.log('DEBUG userinfo error:', errorText);
    }
  }

  // 2. Check email against the authorized list
  const authorizedEmails = env.AUTHORIZED_EMAILS || '';
  console.log('DEBUG: email:', email, 'authorizedEmails:', authorizedEmails);
  if (!isEmailAuthorized(email, authorizedEmails)) {
    return json({ error: 'Access denied', debug: { email: claims.email, allowed: authorizedEmails } }, 403);
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

// ── Provider routing ─────────────────────────────────────────────────────────

function routeToProvider(body, env) {
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

  throw new Error(`Unknown model prefix: "${fullModel}". Use gemini:*, claude:*, or gpt:* / o1:* / o3:* / o4:*.`);
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
