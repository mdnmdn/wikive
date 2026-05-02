# JupyterLite — Google Drive Persistence

## Problem statement

The wiki creates `.ipynb` files in Google Drive (under `_notebooks/`), but the JupyterLite iframe has no
access to them. The two systems have completely separate file systems:

- **Wiki side** — `StorageService` reads/writes files through `GoogleDriveProvider` using the Drive REST API.
- **JupyterLite side** — its `ContentsManager` reads/writes files in the browser's IndexedDB, isolated per
  origin and scoped to the `baseUrl` of the JupyterLite deployment.

This document describes all practical strategies for bridging these two file systems, ordered from easiest to
hardest.

---

## Approach A — postMessage bridge (recommended first step)

No build toolchain required. Works entirely at the JavaScript level by exchanging messages between the parent
wikive app and the JupyterLite iframe.

### How it works

```
┌─────────────────────────────────────────────────────────┐
│  wikive (parent window)                                  │
│                                                         │
│  1. Fetch .ipynb JSON from Drive via StorageService     │
│  2. postMessage({ type: 'LOAD_NOTEBOOK', … }) to iframe │
│                                        │                │
│          ┌─────────────────────────────▼──────────────┐ │
│          │  JupyterLite iframe                        │ │
│          │                                            │ │
│          │  bridge.js (injected script):              │ │
│          │  3. Receives LOAD_NOTEBOOK message         │ │
│          │  4. Writes .ipynb to ContentsManager       │ │
│          │  5. Opens notebook in Lab                  │ │
│          │                                            │ │
│          │  6. On ContentsManager save event:         │ │
│          │     postMessage({ type: 'SAVE_NOTEBOOK' }) │ │
│          └────────────────────────────────────────────┘ │
│                                        │                │
│  7. Receive SAVE_NOTEBOOK              │                │
│  8. StorageService.updateFile(…) ◀─────┘                │
└─────────────────────────────────────────────────────────┘
```

### Step 1 — inject `bridge.js` into the JupyterLite HTML

Add a `<script src="../../bridge.js">` (or inline it) inside `public/jupyterlite/lab/index.html` just
before the closing `</body>` tag. The script runs in the JupyterLite origin context.

`public/jupyterlite/bridge.js`:

```js
(function () {
  'use strict';

  // Wait for JupyterLab application to be fully ready
  async function waitForApp() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        // JupyterLab exposes itself on window._JUPYTERLAB after bootstrap
        if (window._JUPYTERLAB && window._JUPYTERLAB['@jupyterlab/application:ILabShell']) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });
  }

  async function getContentsManager() {
    // The ServiceManager singleton is available after app init
    const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
    return app?.serviceManager?.contents;
  }

  window.addEventListener('message', async (event) => {
    // Always verify origin — replace with your actual wiki origin
    const allowedOrigin = window.location.origin; // same-origin case
    if (event.origin !== allowedOrigin && allowedOrigin !== '*') return;

    const { type, payload } = event.data || {};

    if (type === 'LOAD_NOTEBOOK') {
      await waitForApp();
      const contents = await getContentsManager();
      if (!contents) return;

      const { name, content } = payload;
      // Write the notebook into JupyterLite's virtual FS
      await contents.save(name, {
        type: 'notebook',
        format: 'json',
        content: content, // parsed nbformat JSON object
      });

      // Open it in the Lab shell
      const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
      await app?.commands.execute('docmanager:open', { path: name });

      // Notify parent that load succeeded
      event.source.postMessage({ type: 'NOTEBOOK_LOADED', payload: { name } }, event.origin);
    }

    if (type === 'GET_NOTEBOOK') {
      await waitForApp();
      const contents = await getContentsManager();
      if (!contents) return;
      const { name } = payload;
      try {
        const model = await contents.get(name, { content: true });
        event.source.postMessage({
          type: 'NOTEBOOK_CONTENT',
          payload: { name, content: model.content },
        }, event.origin);
      } catch (e) {
        event.source.postMessage({ type: 'NOTEBOOK_ERROR', payload: { error: e.message } }, event.origin);
      }
    }
  });

  // Forward auto-save events to the parent
  async function setupSaveListener() {
    await waitForApp();
    const contents = await getContentsManager();
    if (!contents) return;

    contents.fileChanged.connect((_, change) => {
      if (change.type === 'save' && change.newValue?.type === 'notebook') {
        window.parent.postMessage({
          type: 'NOTEBOOK_SAVED',
          payload: {
            name: change.newValue.name,
            content: change.newValue.content,
          },
        }, window.location.origin);
      }
    });
  }

  setupSaveListener();
})();
```

> **Note on `window._JUPYTERLAB`**: This is an internal implementation detail of JupyterLite's webpack
> module federation. The exact API surface may change between versions. Verify against the installed version's
> `bootstrap.js` and source before relying on it. A more stable alternative is to use the
> `@jupyterlab/application` `ready` promise exposed through the module federation container.

### Step 2 — update `NotebookEditor.js` to use the bridge

```js
// js/renderers/NotebookEditor.js — additions

methods: {
  // Called by DocumentRenderer when the doc/content prop changes
  async loadNotebookContent() {
    if (!this.content || !this.document?.name) return;
    const frame = this.$refs.notebookFrame;
    if (!frame?.contentWindow) return;

    let parsedContent;
    try {
      parsedContent = typeof this.content === 'string'
        ? JSON.parse(this.content)
        : this.content;
    } catch {
      this.$emit('toast', { message: 'Invalid notebook JSON', type: 'error' });
      return;
    }

    // Wait for iframe to load before posting
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise(r => frame.addEventListener('load', r, { once: true }));
    }

    frame.contentWindow.postMessage({
      type: 'LOAD_NOTEBOOK',
      payload: {
        name: this.document.name.endsWith('.ipynb')
          ? this.document.name
          : this.document.name + '.ipynb',
        content: parsedContent,
      },
    }, window.location.origin);
  },

  async triggerSave() {
    const frame = this.$refs.notebookFrame;
    if (!frame?.contentWindow) return;

    // Ask the bridge for the current notebook state
    const notebookName = this.document.name.endsWith('.ipynb')
      ? this.document.name
      : this.document.name + '.ipynb';

    frame.contentWindow.postMessage({
      type: 'GET_NOTEBOOK',
      payload: { name: notebookName },
    }, window.location.origin);

    // Response handled by the message listener set up in mounted()
  },

  setupMessageListener() {
    this._messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      const { type, payload } = event.data || {};

      if (type === 'NOTEBOOK_CONTENT') {
        // User manually triggered save — write back to Drive
        this.$emit('save', {
          name: this.document.name,
          content: JSON.stringify(payload.content, null, 2),
        });
      }

      if (type === 'NOTEBOOK_SAVED') {
        // JupyterLite auto-saved — sync to Drive silently
        this.$emit('save', {
          name: this.document.name,
          content: JSON.stringify(payload.content, null, 2),
          silent: true,
        });
      }

      if (type === 'NOTEBOOK_LOADED') {
        this.$emit('toast', { message: 'Notebook loaded from Drive', type: 'success' });
      }
    };
    window.addEventListener('message', this._messageHandler);
  },
},

mounted() {
  this.setupMessageListener();
},

beforeUnmount() {
  window.removeEventListener('message', this._messageHandler);
},

watch: {
  content: {
    handler() { this.loadNotebookContent(); },
    immediate: true,
  },
},
```

### Step 3 — wire up `app.js` to pass `.ipynb` content to the renderer

The wiki's `app.js` already fetches `fileContent` for other document types. Make sure the notebook path also
reads the file body from Drive (not just metadata):

```js
// In onRouteChange / resolveSpecialRoute, when docType === 'notebook':
// Existing code creates a doc with id and name but doesn't fetch content.
// Add:
if (doc.docType === 'notebook' && doc.id) {
  try {
    const rawContent = await StorageService.getFileContent(doc.id);
    this.fileContent = rawContent;
  } catch (e) {
    this.fileContent = JSON.stringify({
      nbformat: 4, nbformat_minor: 5,
      metadata: { kernelspec: { name: 'python', display_name: 'Python' } },
      cells: []
    });
  }
}
```

### Step 4 — handle Save in `StorageService` / `app.js`

The `@save` event from `NotebookEditor` already flows up through `DocumentRenderer` to `app.js`. The existing
`saveDocument()` handler calls `StorageService.updateFile()` which writes to Drive. This should work without
changes once the renderer emits the correct `content` payload.

The `silent: true` flag on auto-save events should suppress the success toast. Add handling in `app.js`:

```js
// In saveDocument() or the @save handler:
async saveDocument({ name, content, silent }) {
  if (content) this.fileContent = content;
  await StorageService.updateFile(this.document.id, this.fileContent);
  if (!silent) this.showToast('Notebook saved', 'success');
}
```

---

## Approach B — custom JupyterLite labextension (long-term)

This approach replaces JupyterLite's built-in `ContentsManager` with a custom implementation backed by the
wiki's Google Drive. It requires a Python/npm build step but gives the most native integration: the Drive
files appear directly in JupyterLab's file browser sidebar, drag-and-drop works, etc.

### Architecture

```
JupyterLite (in browser)
  ├── @jupyterlab/services (ContentsManager)
  │     └── custom IDrive implementation
  │           └── calls window.parent.postMessage("DRIVE_REQUEST", …)
  │
parent wikive app
  └── window.addEventListener("message") → StorageService → Google Drive API
```

The custom `IDrive` implementation intercepts every file operation
(`get`, `save`, `rename`, `delete`, `copy`) and delegates to the parent wikive app via postMessage. The
parent app fulfills the request using its existing `StorageService` and posts the response back.

### Minimal `IDrive` interface

```typescript
interface IDrive {
  name: string;
  serverSettings: ServerConnection.ISettings;
  get(localPath: string, options?: Contents.IFetchOptions): Promise<Contents.IModel>;
  getDownloadUrl(localPath: string): Promise<string>;
  newUntitled(options?: Contents.ICreateOptions): Promise<Contents.IModel>;
  delete(localPath: string): Promise<void>;
  rename(oldLocalPath: string, newLocalPath: string): Promise<Contents.IModel>;
  save(localPath: string, options?: Partial<Contents.IModel>): Promise<Contents.IModel>;
  copy(localPath: string, toLocalDir: string): Promise<Contents.IModel>;
  createCheckpoint(localPath: string): Promise<Contents.ICheckpointModel>;
  listCheckpoints(localPath: string): Promise<Contents.ICheckpointModel[]>;
  restoreCheckpoint(localPath: string, checkpointID: string): Promise<void>;
  deleteCheckpoint(localPath: string, checkpointID: string): Promise<void>;
  fileChanged: ISignal<IDrive, Contents.IChangedArgs>;
}
```

### Implementation skeleton

```typescript
// packages/wikive-drive/src/index.ts

import { Signal } from '@lumino/signaling';
import { Contents, ServerConnection } from '@jupyterlab/services';

export class WikiveDrive implements Contents.IDrive {
  readonly name = 'WikiveDrive';
  readonly serverSettings = ServerConnection.makeSettings();
  readonly fileChanged = new Signal<this, Contents.IChangedArgs>(this);

  private _pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private _requestId = 0;

  constructor() {
    window.addEventListener('message', this._onMessage.bind(this));
  }

  private _request<T>(method: string, params: object): Promise<T> {
    const id = String(++this._requestId);
    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage(
        { type: 'DRIVE_REQUEST', payload: { id, method, params } },
        window.location.origin
      );
      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject(new Error(`Drive request timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  private _onMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const { type, payload } = event.data || {};
    if (type !== 'DRIVE_RESPONSE') return;
    const pending = this._pendingRequests.get(payload.id);
    if (!pending) return;
    this._pendingRequests.delete(payload.id);
    if (payload.error) pending.reject(new Error(payload.error));
    else pending.resolve(payload.result);
  }

  async get(localPath: string, options?: Contents.IFetchOptions): Promise<Contents.IModel> {
    return this._request('get', { path: localPath, ...options });
  }

  async save(localPath: string, options: Partial<Contents.IModel> = {}): Promise<Contents.IModel> {
    const result = await this._request<Contents.IModel>('save', { path: localPath, model: options });
    this.fileChanged.emit({ type: 'save', oldValue: null, newValue: result });
    return result;
  }

  // … implement remaining methods similarly
}
```

On the **parent (wikive) side**, add a message listener in `app.js` or a dedicated service:

```js
// js/services/jupyter-drive-bridge.js

class JupyterDriveBridge {
  constructor(storageService) {
    this._storage = storageService;
    window.addEventListener('message', this._onMessage.bind(this));
  }

  async _onMessage(event) {
    if (event.origin !== window.location.origin) return;
    const { type, payload } = event.data || {};
    if (type !== 'DRIVE_REQUEST') return;

    const { id, method, params } = payload;
    let result, error;

    try {
      switch (method) {
        case 'get':
          result = await this._handleGet(params);
          break;
        case 'save':
          result = await this._handleSave(params);
          break;
        case 'list':
          result = await this._handleList(params);
          break;
        // … etc.
      }
    } catch (e) {
      error = e.message;
    }

    event.source.postMessage(
      { type: 'DRIVE_RESPONSE', payload: { id, result, error } },
      window.location.origin
    );
  }

  async _handleGet(params) {
    const file = await this._storage.getFileContent(params.path);
    return {
      type: 'notebook',
      format: 'json',
      content: JSON.parse(file),
      name: params.path.split('/').pop(),
      path: params.path,
    };
  }

  async _handleSave(params) {
    const content = JSON.stringify(params.model.content, null, 2);
    await this._storage.updateFile(params.path, content);
    return params.model;
  }
}
```

### Build and register the extension

```bash
# Requires Node 18+ and Python 3.10+
pip install jupyterlite-core

# Scaffold a new labextension
pip install cookiecutter
cookiecutter https://github.com/jupyterlab/extension-template
# answer: name=wikive-drive-extension, kind=frontend

cd wikive-drive-extension
pip install -e .
jupyter lite build --output-dir ../public/jupyterlite
```

After building, `jupyter lite build` produces a `remoteEntry.HASH.js` in `extensions/`. Add the extension to
`jupyter-lite.json`:

```json
{
  "jupyter-config-data": {
    "federated_extensions": [
      {
        "extension": "./extension",
        "load": "static/remoteEntry.HASH.js",
        "name": "wikive-drive-extension",
        "style": "./style"
      }
    ]
  }
}
```

> **Deep dive references**:
> - JupyterLite contents package: https://github.com/jupyterlite/jupyterlite/tree/main/packages/contents
> - `@jupyterlab/services` Contents API: https://jupyterlab.readthedocs.io/en/stable/api/index.html
> - Jupyter Server Contents API spec: https://jupyter-server.readthedocs.io/en/latest/developers/contents.html
> - JupyterLab extension tutorial: https://jupyterlab.readthedocs.io/en/stable/extension/extension_tutorial.html
> - Google Drive JupyterLab extension (reference impl): https://github.com/jupyterlab/jupyterlab-google-drive

---

## Approach C — URL-based notebook loading (read-only shortcut)

JupyterLite can fetch notebook files from arbitrary HTTP URLs using the `path` query parameter combined with
a served notebook URL. This is the fastest path for **read-only** sharing:

1. When a notebook in Drive has anonymous sharing enabled, it has a public URL
   (`StorageService.getAnonymousShareUrl(fileId)`).
2. Serve the URL to JupyterLite via the Cloudflare Worker proxy (avoids CORS issues).
3. Pass the worker-proxied URL as `?path=https://worker.example.com/share-file?id=FILE_ID` to JupyterLite.

JupyterLite's service worker intercepts the fetch and loads the notebook into its virtual FS as read-only.

This is suitable for `NotebookViewer` (view mode) but not for `NotebookEditor` because writes go back to
the local IndexedDB, not to Drive.

---

## Approach D — drive.js custom `fetch` handler (experimental)

JupyterLite v0.4+ exposes a `driveUrl` configuration option in `jupyter-lite.json` that points to a
Jupyter Server–compatible contents REST API. If you implement a lightweight Cloudflare Worker that exposes
the Jupyter Server Contents API (`/api/contents/…`) backed by Google Drive, JupyterLite can use it natively
without any custom extensions.

```json
{
  "jupyter-config-data": {
    "contentsStorageName": "WikiveDrive",
    "driveUrl": "https://wiki-realtime.mdn.workers.dev/jupyter-contents"
  }
}
```

The Worker would:
1. Receive OAuth token from the parent (via query param or cookie).
2. Translate Jupyter Contents API calls to Google Drive API calls.
3. Return Jupyter-compatible JSON responses.

> **Deep dive references**:
> - Jupyter Server Contents API: https://jupyter-server.readthedocs.io/en/latest/developers/contents.html
> - JupyterLite `driveUrl` config: https://jupyterlite.readthedocs.io/en/stable/reference/config.html
> - Cloudflare Workers D1 + Drive proxy pattern: https://developers.cloudflare.com/workers/

---

## Notebook file format

JupyterLite uses standard **nbformat v4** notebooks. The wiki stores them as `.ipynb` files in Drive with
`mimeType = 'application/x-ipynb+json'`. The JSON structure:

```json
{
  "nbformat": 4,
  "nbformat_minor": 5,
  "metadata": {
    "kernelspec": {
      "display_name": "Python (Pyodide)",
      "language": "python",
      "name": "python"
    },
    "language_info": {
      "name": "python",
      "version": "3.11.0"
    }
  },
  "cells": [
    {
      "cell_type": "code",
      "source": "print('hello')",
      "metadata": {},
      "outputs": [],
      "execution_count": null,
      "id": "abc123"
    }
  ]
}
```

When creating a new blank notebook in `doCreateNewNotebook()` (`app.js:968`), the wiki should write this
minimal JSON as the initial file content rather than an empty string.

> **Deep dive references**:
> - nbformat spec: https://nbformat.readthedocs.io/en/latest/format_description.html
> - nbformat v4 JSON Schema: https://github.com/jupyter/nbformat/blob/main/nbformat/v4/nbformat.v4.5.schema.json

---

## Drive-specific considerations

### Auth token passing

The JupyterLite iframe cannot access the parent's `sessionStorage` (cross-frame storage is isolated).
When using the postMessage bridge, the Google OAuth token must be **passed explicitly** with each `DRIVE_REQUEST`
message. Do not embed the raw token in a URL or query param of the iframe `src`.

```js
// In the bridge message handler on the JupyterLite side:
window.parent.postMessage({
  type: 'DRIVE_REQUEST',
  payload: { id, method, params },
  // token NOT included — the parent wiki already holds it in sessionStorage
}, window.location.origin);

// The parent resolves the request using its own StorageService (which has the token internally)
```

### File naming

Drive files are identified by opaque IDs (`doc.id`). JupyterLite uses human-readable paths. Map them as:

```
Drive file ID   →  JupyterLite path
doc.id (string)    doc.name + '.ipynb'  (e.g. "My Analysis.ipynb")
```

When JupyterLite refers to a file by name, the parent must reverse-lookup the Drive ID using
`StorageService.resolvePath('_notebooks/' + name)`.

### Conflict resolution

If the same notebook is opened in two browser tabs, Drive has the authoritative version. On each `LOAD_NOTEBOOK`
event, always fetch fresh content from Drive rather than using the cached `fileContent`. Use
`StorageService.getFileContent(doc.id)` bypassing `CacheService` (pass `{ noCache: true }` if the provider
supports it, or call `CacheService.clear(cacheKey)` first).

---

## References

| Resource | URL |
|----------|-----|
| JupyterLite Contents package | https://github.com/jupyterlite/jupyterlite/tree/main/packages/contents |
| Jupyter Server Contents API | https://jupyter-server.readthedocs.io/en/latest/developers/contents.html |
| `@jupyterlab/services` ContentsManager | https://jupyterlab.readthedocs.io/en/stable/api/modules/services.ContentsManager-1.html |
| JupyterLab Google Drive extension | https://github.com/jupyterlab/jupyterlab-google-drive |
| JupyterLite config reference | https://jupyterlite.readthedocs.io/en/stable/reference/config.html |
| nbformat spec | https://nbformat.readthedocs.io/en/latest/format_description.html |
| Lumino signaling | https://lumino.readthedocs.io/en/stable/api/modules/signaling.html |
| JupyterLab extension tutorial | https://jupyterlab.readthedocs.io/en/stable/extension/extension_tutorial.html |
| JupyterLite piplite (package installer) | https://jupyterlite.readthedocs.io/en/stable/howto/configure/piplite.html |
| Drive REST API: files.get | https://developers.google.com/drive/api/reference/rest/v3/files/get |
| Drive REST API: files.update | https://developers.google.com/drive/api/reference/rest/v3/files/update |
