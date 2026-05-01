// RealtimeService — WebSocket client for notifications and presence.
// Connects to the Cloudflare Worker Durable Object relay.
// Gracefully degrades: if WORKER_URL is not set, all methods are no-ops.

const RealtimeService = (() => {
  let ws = null;
  let user = null;
  let room = null;
  let workerUrl = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let backoff = 3000;
  const MAX_BACKOFF = 30000;

  let notificationCb = null;
  let presenceCb = null;

  function isConfigured() {
    return !!(workerUrl && room);
  }

  function connect(url, roomName, userInfo) {
    workerUrl = url;
    room = roomName;
    user = userInfo;

    if (!workerUrl) return; // No worker configured — silent no-op

    openSocket();
  }

  async function openSocket() {
    if (!isConfigured()) return;

    // Fetch a fresh Google access token to authenticate with the Worker
    let token = '';
    try {
      token = await AuthService.getToken();
    } catch (e) {
      scheduleReconnect();
      return;
    }

    // Build WebSocket URL — token is validated server-side then stripped
    const base = workerUrl.replace(/^http/, 'ws');
    const wsUrl = `${base}/ws?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      backoff = 3000; // Reset backoff on success
      // Send join
      send({ type: 'join', user: { email: user.email, name: user.name, picture: user.picture } });
      // Start heartbeat
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => send({ type: 'ping' }), 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'notification' && notificationCb) {
          notificationCb(msg);
        } else if (msg.type === 'presence' && presenceCb) {
          presenceCb(msg.users);
        }
        // pong is ignored
      } catch (e) { /* ignore malformed */ }
    };

    ws.onclose = () => {
      clearInterval(heartbeatTimer);
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  function scheduleReconnect() {
    if (!isConfigured()) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      openSocket();
    }, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function navigate(path) {
    send({ type: 'navigate', path });
  }

  function notifyUpdate(action, path, docType) {
    send({ type: 'update', action, path, docType });
  }

  function onNotification(cb) {
    notificationCb = cb;
  }

  function onPresence(cb) {
    presenceCb = cb;
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
    workerUrl = null;
    room = null;
    if (ws) {
      ws.onclose = null; // prevent reconnect
      ws.close();
      ws = null;
    }
  }

  return { connect, navigate, notifyUpdate, onNotification, onPresence, disconnect };
})();
