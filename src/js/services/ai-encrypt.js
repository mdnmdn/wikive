// AI encryption helpers — client-side key generation and server-side encryption
// The worker derives the actual AES key as HMAC(ENCRYPTION_SECRET, clientKey),
// so both the server secret and the client key are required to decrypt.

window.generateEncryptionKey = function() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
};

// Calls the worker /api/encrypt endpoint to encrypt a list of plain-text values.
// Returns the encrypted strings in the same order.
window.encryptProviderKeys = async function(clientKey, plainTexts) {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  const aiUrl = config?.AI_URL;
  if (!aiUrl) throw new Error('AI_URL not configured');

  let token = null;
  if (typeof AuthService !== 'undefined' && AuthService.getToken) {
    token = AuthService.getToken();
  }
  if (!token) {
    const saved = sessionStorage.getItem('wiki_auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expiry > Date.now()) token = parsed.token;
      } catch {}
    }
  }
  if (!token) throw new Error('Not authenticated — cannot encrypt keys');

  const res = await fetch(`${aiUrl}/api/encrypt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ key: clientKey, texts: plainTexts }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Encryption request failed (${res.status})`);
  }

  const data = await res.json();
  return data.encrypted;
};
