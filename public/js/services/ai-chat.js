// AI Chat service — creates and manages a hashbrown chat instance
// Uses dynamic import to load hashbrown since it's an ESM-only package

let hashbrown = null;
let chatInstance = null;

async function getHashbrown() {
  if (!hashbrown) {
    hashbrown = await import('@hashbrownai/core');
  }
  return hashbrown;
}

// provider: optional { type, apiKey, apiKeyEncrypted, url } — forwarded as X-Provider-* headers to the backend
// encryptionKey: the per-user client key used to decrypt the stored API key on the worker
window.createAiChat = async function({ system, tools = [], model, provider = null, encryptionKey = null }) {
  const { fryHashbrown, createHttpTransport } = await getHashbrown();

  if (chatInstance) {
    chatInstance.cleanup();
  }

  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  const aiUrl = config?.AI_URL;
  if (aiUrl === undefined) {
    throw new Error('AI_URL not configured in config.js');
  }

  const middleware = [
    async (requestInit) => {
      // Try to get token from AuthService
      let token = AuthService.getToken();

      // If no token, check sessionStorage directly
      if (!token) {
        const saved = sessionStorage.getItem('wiki_auth');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.expiry > Date.now()) {
            token = parsed.token;
          }
        }
      }

      if (!token) {
        throw new Error('Google authentication not available');
      }
      return {
        ...requestInit,
        headers: {
          ...requestInit.headers,
          'Authorization': `Bearer ${token}`,
        },
      };
    },
  ];

  if (provider) {
    middleware.push(async (requestInit) => ({
      ...requestInit,
      headers: {
        ...requestInit.headers,
        'X-Provider-Type': provider.type || '',
        'X-Provider-Key': provider.apiKey || '',
        ...(provider.url ? { 'X-Provider-URL': provider.url } : {}),
        ...(provider.apiKeyEncrypted && encryptionKey ? {
          'X-Provider-Encrypted': 'true',
          'X-Provider-Enc-Key': encryptionKey,
        } : {}),
      },
    }));
  }

  const transport = createHttpTransport({
    baseUrl: `${aiUrl}/api/chat`,
    middleware,
  });

  const chat = fryHashbrown({
    model,
    system,
    tools,
    transport,
  });

  const cleanup = chat.sizzle();

  chatInstance = { chat, cleanup };

  return {
    chat,
    destroy: cleanup,
    updateModel: (newModel) => {
      chat.updateOptions({ model: newModel });
    },
  };
};

window.isAiConfigured = function() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  return (config?.AI_URL !== undefined);
};

window.getDefaultModel = function() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  return config?.AI_MODEL || 'gemini:gemini-flash-lite-latest';
};

window.AI_MODELS = [
  { label: 'Gemini Flash Lite', value: 'gemini:gemini-flash-lite-latest' }
];

window.fetchAiModels = async function() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  const aiUrl = config?.AI_URL;

  if (aiUrl === undefined) {
    return window.AI_MODELS;
  }

  try {
    const response = await fetch(`${aiUrl}/api/models`);
    if (!response.ok) {
      return window.AI_MODELS;
    }
    const models = await response.json();
    window.AI_MODELS = models;
    return models;
  } catch {
    return window.AI_MODELS;
  }
};
