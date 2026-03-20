export { WikiRoom } from './wiki-room.js';

// Google's tokeninfo endpoint — validates an access token and returns its claims.
const TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
