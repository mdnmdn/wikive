# JupyterLite Integration

## Overview

wikive embeds [JupyterLite](https://jupyterlite.readthedocs.io/) — a fully in-browser Jupyter environment
built on WebAssembly — to support interactive notebooks stored as `.ipynb` files in the wiki's Google Drive
(or any future persistence provider).

JupyterLite v0.7.4 is already deployed as a static bundle at `public/jupyterlite/`. The wiki wraps it with
two Vue renderer components and exposes it through the standard document model. What is **not yet implemented**
is the round-trip between JupyterLite's internal file system and the wiki's `StorageService`. That work is
detailed in the companion docs listed below.

---

## Detailed documentation

| Doc | Contents |
|-----|----------|
| [`_docs/jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) | Syncing notebooks with the wiki's `StorageService` / Google Drive — postMessage bridge, contents injection, save-back, and the long-term custom extension approach |
| [`_docs/jupyterlite-kernels.md`](jupyterlite-kernels.md) | Available kernels, how to install and activate them, `jupyter-lite.json` configuration, and loading Python packages |
| [`_docs/jupyterlite-ai-chat.md`](jupyterlite-ai-chat.md) | Embedding AI chat inside notebooks — `jupyter-ai` extension, bridging the existing wiki Hashbrown AI chat, and in-cell completions |

---

## Current state

### What is already working

| Feature | File | Status |
|---------|------|--------|
| JupyterLite v0.7.4 static bundle | `public/jupyterlite/` | Deployed |
| REPL embed (view mode) | `js/renderers/NotebookViewer.js` | Working |
| Full Lab embed (edit mode) | `js/renderers/NotebookEditor.js` | Working |
| Theme sync (dark / light) | Both renderers, via `?theme=` query param | Working |
| Notebook document type in routing | `js/app.js` lines 676-977 | Working |
| `_notebooks` special folder | `StorageService.getNotebooksFolderId()` | Working |
| New notebook dialog + Drive file creation | `app.js` `doCreateNewNotebook()` | Working |
| Clone notebook | `app.js` line 1217-1223 | Working |
| Rename notebook | `app.js` line 1118-1127 | Working |
| Sidebar perspective filter | `Sidebar.js` | Working |

### What is missing (open work)

| Feature | Gap | See |
|---------|-----|-----|
| Load `.ipynb` content from Drive into JupyterLite | iframe has no access to the file's JSON | [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) |
| Save modified notebook back to Drive | `triggerSave()` shows an info toast only | [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) |
| Auto-sync on JupyterLite internal save | No save-change listener | [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) |
| Additional kernels (xeus-python, TypeScript, …) | Only Pyodide included | [`jupyterlite-kernels.md`](jupyterlite-kernels.md) |
| AI chat inside notebooks | `jupyter-ai` not installed | [`jupyterlite-ai-chat.md`](jupyterlite-ai-chat.md) |
| Cross-origin hosting of the JupyterLite bundle | Service worker scope constraints | [Cross-origin section](#cross-origin-and-multi-domain-embedding) |
| Anonymous share for notebooks | `.ipynb` not yet publicly readable through share.html | — |

---

## Architecture: how JupyterLite fits in the wiki

```
┌─────────────────────────────────────────────────────────────────┐
│  wikive (index.html / app.js)                                   │
│                                                                 │
│  DocumentRenderer  ──docType=notebook──▶  NotebookEditor.js     │
│                                            │                    │
│                          ┌─────────────────▼──────────────────┐ │
│                          │  <iframe src="/jupyterlite/lab/">   │ │
│                          │                                     │ │
│                          │   JupyterLite (Webpack federation)  │ │
│                          │   ┌────────────────────────────┐   │ │
│                          │   │  ContentsManager (IndexedDB)│   │ │
│                          │   │  KernelManager (Pyodide)    │   │ │
│                          │   │  LabExtensions              │   │ │
│                          │   └────────────────────────────┘   │ │
│                          └─────────────────────────────────────┘ │
│                                                                 │
│  StorageService  ──────────────────────────▶  Google Drive API  │
└─────────────────────────────────────────────────────────────────┘
```

The gap is the missing bidirectional link between the iframe and `StorageService`. The immediate solution
is a **postMessage bridge** injected via `bootstrap.js`; the long-term solution is a purpose-built
JupyterLite labextension.

---

## Deployment layout

```
public/jupyterlite/
  index.html            root JupyterLite shell with #jupyter-config-data
  bootstrap.js          webpack module federation loader (DO NOT EDIT lightly)
  jupyter-lite.json     main config — kernels, file types, federated_extensions
  config-utils.js       page-config helpers
  service-worker.js     PWA / offline support (must be served from correct scope)
  lab/                  full JupyterLab UI environment
  repl/                 minimal REPL (used by NotebookViewer)
  edit/                 single-file notebook editor
  tree/                 file browser
  consoles/             Python console
  notebooks/            notebook listing
  build/                pre-compiled webpack bundles (~500 JS files)
  extensions/           federated labextensions (currently: jupyterlab_pygments)
```

Every sub-environment (`lab/`, `repl/`, etc.) has its own `index.html` and a copy of `jupyter-lite.json`.
When adding a new federated extension, update **all** of them (or symlink to the root copy).

---

## Key configuration: `jupyter-lite.json`

`public/jupyterlite/jupyter-lite.json` is the single authoritative config read by `bootstrap.js`:

```jsonc
{
  "jupyter-config-data": {
    "appName": "JupyterLite",
    "appVersion": "0.7.4",
    "defaultKernelName": "python",        // change to "xpython" for xeus-python
    "federated_extensions": [             // add new extensions here
      {
        "extension": "./extension",
        "load": "static/remoteEntry.HASH.js",
        "name": "jupyterlab_pygments",
        "style": "./style"
      }
    ]
  }
}
```

See [`jupyterlite-kernels.md`](jupyterlite-kernels.md) for how to add kernels and
[`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) for adding a Drive contents extension.

---

## iframe embedding: renderer components

### NotebookViewer (`js/renderers/NotebookViewer.js`)

Used in **view mode**. Embeds the lightweight REPL at `/jupyterlite/repl/index.html`.

```
/jupyterlite/repl/index.html?kernel=python&toolbar=1&theme=JupyterLab+Dark
```

Relevant query parameters:

| Param | Values | Effect |
|-------|--------|--------|
| `kernel` | `python` | Pre-select kernel |
| `toolbar` | `1` / `0` | Show/hide toolbar |
| `theme` | `JupyterLab Dark` / `JupyterLab Light` | Initial theme |
| `code` | URL-encoded Python | Pre-fill REPL with code |

### NotebookEditor (`js/renderers/NotebookEditor.js`)

Used in **edit mode** (notebooks are always in edit mode per `app.js:676-677`). Embeds the full Lab at
`/jupyterlite/lab/index.html`.

```
/jupyterlite/lab/index.html?theme=JupyterLab+Dark
```

Relevant query parameters:

| Param | Values | Effect |
|-------|--------|--------|
| `theme` | `JupyterLab Dark` / `JupyterLab Light` | Initial theme |
| `path` | URL-encoded file path | Open a specific notebook from JupyterLite's internal FS |
| `reset` | `1` | Clear all state (useful in development) |

**`path` is the key parameter for Drive integration** — once a notebook is injected into JupyterLite's
IndexedDB (via postMessage), passing `?path=notebook.ipynb` will open it directly on load. See
[`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md).

---

## Service worker requirements

JupyterLite registers a service worker (`service-worker.js`) that bridges the gap between the
synchronous filesystem calls that WASM kernels make and the browser's async storage (IndexedDB).
The mechanism:

1. The WASM kernel posts a file request to `/api/drive` (HTTP).
2. The SW intercepts it and forwards the request to the main thread via `BroadcastChannel(/sw-api.v1)`.
3. The main thread resolves the file from the contents manager and replies on the channel.
4. The SW returns the response to the kernel.

**Alternative — SharedArrayBuffer**: If the JupyterLite server sends `Cross-Origin-Opener-Policy: same-origin`
and `Cross-Origin-Embedder-Policy: require-corp` headers, JupyterLite uses `SharedArrayBuffer` instead of
the SW for synchronization. This is faster but requires header control over the server. On GitHub Pages
you can use the `coi-serviceworker` trick to inject these headers via a small SW at build time.

**Practical implications:**

1. **Same-origin requirement**: The service worker must be registered from the same origin as the iframe.
   When the wikive app is served at `https://wiki.example.com`, the JupyterLite bundle must also be served
   from `https://wiki.example.com/jupyterlite/`.

2. **HTTPS required**: Service workers only work over HTTPS (or `localhost`). Plain HTTP falls back to no
   SW which breaks kernel file access.

3. **Firefox private windows**: Service workers are blocked. JupyterLite kernel file access will fail in
   Firefox private mode.

See the [cross-origin section](#cross-origin-and-multi-domain-embedding) for mitigations.

---

## Cross-origin and multi-domain embedding

### Scenario A — wikive and JupyterLite on the same origin (current setup)

Everything works. The iframe is same-origin, `postMessage` targeting `'*'` or the explicit origin is fine,
and the service worker serves the JupyterLite bundle from `https://your-wiki.pages.dev/jupyterlite/`.

### Scenario B — JupyterLite hosted on a separate domain

Example: wikive at `https://wiki.example.com`, JupyterLite at `https://jlite.example.com`.

Problems:
- Service worker on `jlite.example.com` cannot intercept requests from `wiki.example.com`.
- `postMessage` works cross-origin but requires explicit `targetOrigin` on both sides.
- CORS headers must be set on `jlite.example.com` for asset fetches.

Mitigations:
- Serve JupyterLite as a sub-path of the same Cloudflare Workers/Pages deployment to keep origins aligned.
- Use `SharedArrayBuffer` mode (COOP/COEP headers on the JupyterLite host) to eliminate the SW dependency.
- Use `jupyter-iframe-commands` (see below) which uses Comlink and works cross-origin.

### Scenario C — JupyterLite on a public CDN (lite.jupyter.org, mybinder.org)

JupyterLite is available at `https://jupyterlite.github.io/demo/` and similar public deployments. You can
embed these in an iframe but:
- No file sync is possible without `postMessage` protocols that the remote host must support.
- The user's kernel state is isolated in the remote origin.
- Useful only for read-only / demo notebooks.

### Scenario C — Public JupyterLite deployment (read-only)

JupyterLite is available at `https://jupyterlite.github.io/demo/` and similar public deployments.
Embed in an iframe for demonstrations, but no file sync is possible. Use only for read-only / demo notebooks.
Load notebooks via the `?fromURL=` parameter (requires `jupyterlab-open-url-parameter` extension).

### Recommended approach for wikive

Keep the JupyterLite bundle on the **same origin** as the wiki (`/jupyterlite/` sub-path). When deploying
to Cloudflare Pages or Workers, this is achieved automatically because both the wiki app and the static
JupyterLite assets are served from the same `*.pages.dev` domain.

For custom domains, ensure both the wiki and `public/jupyterlite/**` resolve from the same domain.

### `jupyter-iframe-commands` — structured postMessage bridge

[`jupyter-iframe-commands`](https://github.com/TileDB-Inc/jupyter-iframe-commands) is a production-ready
TileDB-maintained extension that provides a Comlink-based command bridge between a host page and an
embedded JupyterLite iframe. Install it into the bundle at build time:

```bash
pip install jupyter-iframe-commands
jupyter lite build --output-dir public/jupyterlite
```

Host page usage (npm package `jupyter-iframe-commands-host`):

```js
import { createBridge } from 'jupyter-iframe-commands-host';

const bridge = createBridge({ iframeId: 'my-jupyter-iframe' });
await bridge.ready;

// Execute any registered JupyterLab command:
await bridge.execute('apputils:change-theme', { theme: 'JupyterLab Dark' });
await bridge.execute('filebrowser:open-path', { path: 'my-notebook.ipynb' });

// List all available commands:
const commands = await bridge.listCommands();
```

This is the most robust mechanism for host↔iframe communication. It works cross-origin as long as the
`targetOrigin` is configured correctly.

> **Deep dive**: https://github.com/TileDB-Inc/jupyter-iframe-commands

---

## Integration roadmap (priority order)

1. **Drive sync via postMessage bridge** — highest value, no build step needed.
   See [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) §Approach A.

2. **Open specific notebook on load** — pass `?path=` once Drive sync is in place.

3. **Additional kernels** — xeus-python for faster startup, TypeScript.
   See [`jupyterlite-kernels.md`](jupyterlite-kernels.md).

4. **AI chat in notebooks** — `jupyter-ai` extension with the wiki's AI provider config.
   See [`jupyterlite-ai-chat.md`](jupyterlite-ai-chat.md).

5. **Anonymous share for notebooks** — extend the existing share flow to render `.ipynb` files
   read-only in `share.html` (either via JupyterLite REPL or a static nbformat renderer like
   `nbviewer.js`).

6. **Custom contents manager extension** — fully replace JupyterLite's IndexedDB storage with
   Google Drive. High effort; needed for true multi-device persistence.
   See [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) §Approach B.

---

## Known limitations

1. **No runtime extension install**: Extensions must be bundled at build time. The Extension Manager GUI
   does not work in JupyterLite as it does in server-based JupyterLab.
2. **Kernel threading**: Python code using `threading`, `subprocess`, socket networking, or blocking I/O
   may not work under Pyodide. xeus-python has better `time.sleep` support.
3. **piplite ≠ pip**: Only pure-Python or pre-compiled WASM wheels can be installed at runtime.
4. **Firefox private windows**: Service workers are blocked; kernel file access fails.
5. **Custom drive + kernel access**: Registering a custom `IDrive` in the UI layer does NOT automatically
   make files accessible from inside the Python kernel (e.g., `open('/drive/file.csv')`). The
   `DriveContentsProcessor` / Service Worker pathway must also be wired up.
6. **Storage isolation**: JupyterLite's IndexedDB is namespaced by origin. Two deployments on different
   origins see different file systems. Configure `contentsStorageName` if hosting multiple instances on
   the same origin.

---

## References

| Resource | URL |
|----------|-----|
| JupyterLite docs | https://jupyterlite.readthedocs.io/en/stable/ |
| JupyterLite GitHub | https://github.com/jupyterlite/jupyterlite |
| JupyterLite demo | https://jupyterlite.github.io/demo/ |
| IFrame communication (official docs) | https://jupyterlite.readthedocs.io/en/stable/howto/configure/advanced/iframe.html |
| Embed REPL (quickstart) | https://jupyterlite.readthedocs.io/en/stable/quickstart/embed-repl.html |
| Config files reference | https://jupyterlite.readthedocs.io/en/stable/howto/configure/config_files.html |
| Full schema reference | https://jupyterlite.readthedocs.io/en/stable/reference/schema-v0.html |
| Contents API reference | https://jupyterlite.readthedocs.io/en/stable/reference/contents.html |
| Browser storage config | https://jupyterlite.readthedocs.io/en/stable/howto/configure/storage.html |
| Migration guide | https://jupyterlite.readthedocs.io/en/stable/migration.html |
| Open from URL (`?fromURL=`) | https://jupyterlite.readthedocs.io/en/stable/howto/content/open-url-parameter.html |
| jupyter-iframe-commands | https://github.com/TileDB-Inc/jupyter-iframe-commands |
| JupyterLab extensions | https://jupyterlab.readthedocs.io/en/stable/user/extensions.html |
| Webpack module federation | https://webpack.js.org/concepts/module-federation/ |
| Pyodide (Python WASM) | https://pyodide.org/en/stable/ |
| xeus kernels (unified) | https://github.com/jupyterlite/xeus |
| xeus-lite docs | https://jupyterlite-xeus.readthedocs.io/ |
| nbformat spec | https://nbformat.readthedocs.io/en/latest/ |
| JupyterLite Contents package | https://github.com/jupyterlite/jupyterlite/tree/main/packages/contents |
| jupyterlite-ai (browser AI) | https://github.com/jupyterlite/ai |
| jupyterlab-google-drive JupyterLite issue | https://github.com/jupyterlab/jupyterlab-google-drive/issues/203 |
| JupyterLite service worker source | https://github.com/jupyterlite/jupyterlite/blob/main/packages/server-extension/src/service-worker.ts |
