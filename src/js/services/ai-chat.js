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

window.createAiChat = async function({ system, tools = [], model }) {
  const { fryHashbrown, createHttpTransport } = await getHashbrown();

  if (chatInstance) {
    chatInstance.destroy();
  }

  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  const aiUrl = config?.AI_URL;
  if (!aiUrl) {
    throw new Error('AI_URL not configured in config.js');
  }

  const transport = createHttpTransport({
    baseUrl: `${aiUrl}/api/chat`,
    middleware: [
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
    ],
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
  return !!(config?.AI_URL);
};

window.getDefaultModel = function() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  return config?.AI_MODEL || 'gemini:gemini-flash-lite-latest ';
};

window.AI_MODELS = [
  { label: 'Gemini Flash Lite', value: 'gemini:gemini-flash-lite-latest' }
];

window.fetchAiModels = async function() {
  const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
  const aiUrl = config?.AI_URL;

  if (!aiUrl) {
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
