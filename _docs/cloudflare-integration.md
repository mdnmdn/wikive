# Cloudflare Integration: Real-time Notifications & Presence

## Overview

The wiki optionally connects to a Cloudflare Worker to enable real-time features for users sharing the same Google Drive wiki root folder:

- **Notifications** — when someone saves, creates, or deletes a document, all other connected users get a toast and a bell notification.
- **Presence** — avatars of other users viewing the same page appear next to the breadcrumb. A green dot counter shows how many other users are connected to the wiki.

These features are fully opt-in. `realtime.js` is **not loaded at all** unless `CONFIG.WORKER_URL` is set — so a standard deployment (GitHub Pages, Netlify, your own server, etc.) has zero CF-related code running. Set `WORKER_URL` to a deployed Worker URL to enable the features.

---

## Architecture

```
Browser A ──WebSocket──┐
                       ├── Cloudflare Worker ── WikiRoom Durable Object
Browser B ──WebSocket──┘         (one per ROOT_FOLDER_NAME)
```

The Cloudflare Worker is a thin WebSocket relay. It holds no persistent state — all sessions are in-memory inside the Durable Object. Connections are keyed by `CONFIG.ROOT_FOLDER_NAME`, so users sharing the same wiki root (even across different app instances) end up in the same room.

---

## File Layout

```
worker/
  wrangler.toml             — Cloudflare Worker configuration
  package.json              — dev dependency: wrangler
  src/
    index.js                — Worker fetch handler, routes /ws to Durable Object
    wiki-room.js            — WikiRoom Durable Object (WebSocket sessions + broadcast)

src/
  config.sample.js          — WORKER_URL added
  js/services/realtime.js   — Client-side WebSocket service
  js/components/AppHeader.js — Notification bell + presence avatars
  css/app.css               — .notif-badge styles
  js/app.js                 — RealtimeService wired into save/create/delete/navigate
```

---

## WebSocket Protocol

All messages are JSON.

### Client → Server

| `type`     | Payload fields                          | When sent |
|------------|-----------------------------------------|-----------|
| `join`     | `user: {email, name, picture}`          | On WebSocket open |
| `navigate` | `path: string`                          | On every route change |
| `update`   | `action: "save"\|"create"\|"delete"`, `path`, `docType` | After a successful write operation |
| `ping`     | _(none)_                                | Every 30 s (keepalive) |

### Server → Client

| `type`         | Payload fields                                              | When sent |
|----------------|-------------------------------------------------------------|-----------|
| `notification` | `action`, `path`, `docType`, `user: {name, email, picture}`, `ts` | Another user sent an `update` |
| `presence`     | `users: [{email, name, picture, path}]`                     | On join / navigate / disconnect |
| `pong`         | _(none)_                                                    | Reply to `ping` |

---

## Worker Details

### `worker/src/index.js`

Entry point. Handles:
- `OPTIONS` — CORS preflight (allows `*` origin).
- `GET /health` — Returns `{ok: true}`.
- `GET /ws?room=<name>` — Upgrades to WebSocket and delegates to the `WikiRoom` Durable Object identified by `room`.

### `worker/src/wiki-room.js` — `WikiRoom` Durable Object

One instance exists per unique `ROOT_FOLDER_NAME` value. State is purely in-memory (a `Map<WebSocket, {user, path}>`).

**On message:**
- `join` — stores user info in the session, broadcasts updated presence to all connected users.
- `navigate` — updates the user's current path, broadcasts presence.
- `update` — broadcasts a `notification` message to every session *except* the sender.
- `ping` — replies with `pong`.

**On close/error** — removes the session and broadcasts presence so other users' presence lists update immediately.

---

## Client Service: `RealtimeService`

`src/js/services/realtime.js` — IIFE singleton, available globally as `RealtimeService`.

### API

```js
RealtimeService.connect(workerUrl, roomName, user)
// Opens WebSocket. No-op if workerUrl is falsy.

RealtimeService.navigate(path)
// Sends a navigate message. Called on every route change.

RealtimeService.notifyUpdate(action, path, docType)
// Sends an update message. Called after save/create/delete.

RealtimeService.onNotification(callback)
// callback(msg) — called when another user changes something.

RealtimeService.onPresence(callback)
// callback(users[]) — called when the presence list changes.

RealtimeService.disconnect()
// Closes the WebSocket cleanly. Called on logout.
```

### Reconnection

On unexpected close, the service reconnects with exponential backoff: 3 s → 6 s → 12 s → … → 30 s (max). Backoff resets to 3 s on a successful reconnect. A 30-second heartbeat ping keeps the connection alive through idle timeouts.

---

## App Integration (`app.js`)

| Hook | What happens |
|------|-------------|
| `initApp()` | Registers notification/presence callbacks, calls `RealtimeService.connect()` |
| `onRouteChange()` | Calls `RealtimeService.navigate(path)` |
| `save()` | Calls `notifyUpdate('save', path, docType)` after Drive write |
| `createPage()` | Calls `notifyUpdate('create', path, 'markdown')` after Drive write |
| `deleteDocument()` | Calls `notifyUpdate('delete', path, docType)` before navigation |
| `onRendererSave()` | Calls `notifyUpdate('save', …)` for snippet/drawing auto-saves |
| Notification callback | Pushes to `notifications[]`, shows toast, auto-refreshes if on same page |
| Presence callback | Updates `presenceUsers[]` (self filtered out by email) |

Notifications are capped at 50 entries in memory. The bell dropdown shows the last 20.

---

## UI: AppHeader

### Notification bell
- Appears in the header toolbar.
- Shows a red badge with the unread count.
- Clicking opens a dropdown listing recent notifications (avatar, name, action, path, time-ago).
- Clicking a notification navigates to that path and closes the dropdown.
- "Clear all" button empties the list.

### Presence avatars
- Shown next to the breadcrumb when other users are on **the same page**.
- Up to 5 avatars displayed; "+N" label for overflow.
- Each avatar has a tooltip with the user's name.

### Online counter
- A small green-dot pill showing the count of *all* other users connected to the wiki.
- Hovering shows the list of names.

---

## Setup

### 1. Deploy the Worker

```bash
cd worker
npm install
npx wrangler login                       # authenticate with Cloudflare
npx wrangler secret put GOOGLE_CLIENT_ID # paste your OAuth client ID
npx wrangler deploy
```

Wrangler prints the deployed URL, e.g.:
```
https://wiki-realtime.<your-account>.workers.dev
```

### 2. Configure the app

In `config.js` (copied from `config.sample.js`), set:

```js
WORKER_URL: 'https://wiki-realtime.<your-account>.workers.dev',
```

Leave it empty or omit it entirely to disable real-time features. `realtime.js` will not be loaded and no WebSocket connection will be attempted:

```js
// WORKER_URL: '',  // omit or leave empty — realtime.js is never loaded
```

### 3. Local development

Run the Worker locally alongside the app:

```bash
cd worker && npx wrangler dev
# Listens on http://localhost:8787
```

Then set in `config.js`:
```js
WORKER_URL: 'http://localhost:8787',
```

---

## Cloudflare Free Tier

Durable Objects require at least the **Workers Paid plan** ($5/month). The free tier does not include DOs.

| Resource | Usage |
|----------|-------|
| Durable Object instances | One per unique `ROOT_FOLDER_NAME` |
| WebSocket connections | One per browser tab |
| Storage | None (all in-memory, no SQLite) |
| Requests | 1 per WebSocket upgrade (then zero billing per message on the WS) |

---

## Security

### How it works

Every WebSocket connection is authenticated before it reaches the Durable Object:

1. The client calls `AuthService.getToken()` to get the current Google OAuth2 access token.
2. The token is sent as a query parameter: `/ws?room=<name>&token=<access_token>`.
3. The Worker validates the token against Google's tokeninfo endpoint:
   - Token must be active (not expired/revoked).
   - `aud` claim must match `GOOGLE_CLIENT_ID` — tokens issued by other OAuth apps are rejected.
   - `scope` must include `drive` — ensures only users who have authorised the wiki can connect.
4. The token is stripped from the URL before the request is forwarded to the Durable Object.
5. Unauthenticated or invalid requests receive `401` and the WebSocket is never opened.

### Worker secret

`GOOGLE_CLIENT_ID` is stored as a Cloudflare Worker secret (not in `wrangler.toml`):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# paste your OAuth client ID when prompted
```

This must match the value in your app's `config.js`.

### What this prevents

| Threat | Mitigated? |
|--------|-----------|
| Unknown third party connects to your room | Yes — no valid token for your client ID |
| Token from a different OAuth app | Yes — `aud` check rejects it |
| Expired / revoked token | Yes — Google tokeninfo returns non-200 |
| Token reuse after user logs out | Partially — Google tokens expire in ~1 h; `AuthService.logout()` revokes the token immediately |

### What this does NOT prevent

- A **legitimate wiki user** connecting to your room. If you need per-room isolation beyond the `ROOT_FOLDER_NAME` key, you would need to verify Drive folder access server-side (requires a service account or additional API call).
- Token interception in transit — mitigated by HTTPS (Cloudflare Workers always serve over TLS).

### Notification payload

No file contents are ever sent through the Worker. Payloads contain only: action type, document path, docType, user's public profile (name, email, picture), and a timestamp.
