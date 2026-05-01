// WikiRoom Durable Object — one instance per wiki root folder.
// Manages WebSocket connections for real-time notifications and presence.
// No persistent storage — everything is in-memory and transient.

export class WikiRoom {
  constructor(state, env) {
    // Map<WebSocket, {user: {email, name, picture}, path: string}>
    this.sessions = new Map();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // Initialize session with empty user (filled on 'join' message)
    this.sessions.set(server, { user: null, path: '' });

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(server, msg);
      } catch (e) {
        // Ignore malformed messages
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      this.broadcastPresence();
    });

    server.addEventListener('error', () => {
      this.sessions.delete(server);
      this.broadcastPresence();
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(sender, msg) {
    switch (msg.type) {
      case 'join': {
        const session = this.sessions.get(sender);
        if (session && msg.user) {
          session.user = {
            email: msg.user.email,
            name: msg.user.name,
            picture: msg.user.picture,
          };
        }
        this.broadcastPresence();
        break;
      }

      case 'navigate': {
        const session = this.sessions.get(sender);
        if (session) {
          session.path = msg.path || '';
        }
        this.broadcastPresence();
        break;
      }

      case 'update': {
        // Broadcast notification to everyone except the sender
        const session = this.sessions.get(sender);
        if (!session || !session.user) break;

        const notification = JSON.stringify({
          type: 'notification',
          action: msg.action, // save, create, delete
          path: msg.path,
          docType: msg.docType,
          user: session.user,
          ts: Date.now(),
        });

        for (const [ws, s] of this.sessions) {
          if (ws !== sender && s.user) {
            try { ws.send(notification); } catch (e) { /* connection dead */ }
          }
        }
        break;
      }

      case 'ping': {
        try { sender.send(JSON.stringify({ type: 'pong' })); } catch (e) { /* */ }
        break;
      }
    }
  }

  broadcastPresence() {
    const users = [];
    for (const [, session] of this.sessions) {
      if (session.user) {
        users.push({
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture,
          path: session.path,
        });
      }
    }

    const msg = JSON.stringify({ type: 'presence', users });

    for (const [ws, session] of this.sessions) {
      if (session.user) {
        try { ws.send(msg); } catch (e) { /* connection dead */ }
      }
    }
  }
}
