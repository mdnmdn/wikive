# Agents

## Goal
Build a zero-backend personal wiki that runs entirely in the browser, storing Markdown pages and related files in the user's Google Drive. The app is designed to run as a static bundle (no build step, no server), so everything loads from CDN-hosted libraries and Google APIs.

## Reference docs

Detailed documentation lives in `_docs/`:

| File | Contents |
|------|----------|
| [`_docs/project-structure.md`](_docs/project-structure.md) | Full file layout, core concepts, tech stack, boot order, routing, service table, component and renderer tables, how to extend |
| [`_docs/ux.md`](_docs/ux.md) | Layout structure, screen modes, navigation, sidebar UX, header UX, dialogs, color system, responsive design, interaction patterns |
| [`_docs/persistence-providers.md`](_docs/persistence-providers.md) | Provider abstraction, `PersistenceProvider` and `AuthProvider` interfaces, how to add a new provider |
| [`_docs/cloudflare-integration.md`](_docs/cloudflare-integration.md) | Real-time notifications and presence via Cloudflare Worker + Durable Objects, WebSocket protocol, security |

## Core features
- Google OAuth login via Google Identity Services with minimum scope (`drive.file`).
- Markdown pages stored as Drive files, organized by folders.
- Page viewing with Markdown rendering, syntax highlighting, and Mermaid diagrams.
- Page editing with Toast UI Editor (WYSIWYG + Markdown).
- Hash-based routing (`#/path`) for static hosting.
- Sidebar navigation with perspective filters (All / Pages / Snippets / Drawings / Assets), breadcrumbs, and quick refresh.
- Asset manager for uploading, browsing, previewing, renaming, deleting, and copying wiki paths.
- Snippet manager for temporary code/text snippets with expiry metadata.
- Drawings manager for creating and editing Excalidraw diagrams.
- Local caching with stale-while-revalidate for fast loads.
- Anonymous share links for markdown pages, snippets, and drawings using provider-native public sharing.
- Optional dark mode toggle (persisted in `localStorage`).
- Optional real-time notifications and presence via a Cloudflare Worker (see `_docs/cloudflare-integration.md`).

## How it works
- **Runtime boot**: `index.html` loads CDN dependencies (Vue 3 global build, editors, Markdown tooling) and the locally built Excalidraw web component, then app services/components, and finally `js/app.js` which mounts the Vue app. See `_docs/project-structure.md` for exact script load order.
- **Authentication**: Google Identity Services uses the OAuth2 token flow to issue Drive API access tokens. Tokens and user profile data are cached in `sessionStorage` and refreshed when expired. Scope is `drive.file`, limiting access to files the app creates.
- **Drive model**: A root wiki folder is created (from `CONFIG.ROOT_FOLDER_NAME`, supports nested paths like `team/_wiki`). Within it, `_assets`, `_snippets`, and `_drawings` subfolders are created lazily on first use. Pages are stored as `.md` files, assets are binaries, snippets store metadata (language, expiry) in Drive `appProperties`, and drawings store Excalidraw JSON as `.excalidraw` files.
- **Routing**: Hash routes resolve to Drive paths. `onRouteChange()` detects special folders (`_assets`, `_snippets`, `_drawings`) and dispatches accordingly. For wiki paths, the app tries `segment.md` first, then an exact name match, then falls back to a not-found view.
- **UI flow**: `DocumentRenderer` receives a `document` + `mode` and dispatches to the correct renderer via `RendererService`. All document actions (save, delete, rename, clone, share) live in `AppHeader`; renderers expose action methods that `DocumentRenderer` delegates to via `triggerSave()`, `triggerCopy()`, etc.
- **Anonymous share flow**: From a file document, the header enables anonymous sharing. The active persistence provider makes the backing file publicly readable (for Google Drive: `anyone` + `reader`). The app then generates a `share.html?...` link that opens a frameless read-only renderer without login. For Google Drive, content is fetched through the optional Worker proxy to avoid XHR restrictions on public Drive downloads.

## Key architectural patterns

### Unified document model
Everything is a `Document` with a `docType` field (`markdown`, `snippet`, `drawing`, `asset`, `folder`). `DocumentService.toDocument()` normalises any Drive file into this shape. Type detection uses parent path, file extension, and `appProperties`.

### Renderer dispatch
`DocumentRenderer` looks up the component name from `RendererService.getRenderer(docType, mode)` and renders via Vue's `<component :is>`. All renderers emit standard events: `@save`, `@delete`, `@toast`, `@mode-change`, `@navigate`.

### All actions live in AppHeader — no per-renderer toolbars
Document actions (Save, Edit, Delete, Rename, Clone, Share) are all rendered by `AppHeader` based on `document.docType` and `mode`. Renderers expose imperative methods (`saveDrawing()`, `saveSnippet()`, `copyToClipboard()`, etc.) that `DocumentRenderer` calls via `$refs` through its `trigger*()` delegation methods. No renderer renders its own action toolbar.

### Shared reactive state via provide/inject (`rendererState`)
`app.js` creates a `rendererState` plain object in `data()` (Vue makes it reactive) and provides it to all descendants via `provide()`. `AppHeader` and all renderers inject it. This avoids prop-drilling for cross-cutting state:

| Key | Set by | Read by |
|-----|--------|---------|
| `drawingAutosave` | `DrawingEditor` | `AppHeader` |
| `drawingAutosaveStatus` | `DrawingEditor` | `AppHeader` |
| `drawingSaving` | `DrawingEditor` | `AppHeader` |
| `drawingFullscreen` | `DrawingEditor` | `AppHeader` |
| `snippetType` | `SnippetEditor` (from doc) | `AppHeader` (select), `SnippetEditor` (Ace mode) |
| `snippetExpiry` | `SnippetEditor` (from doc) | `AppHeader` (select), `SnippetEditor` (on save) |
| `assetSearch` | `AppHeader` (input) | `AssetViewer` (filter) |

### Props-down / events-up with minimal root state
`app.js` holds: `document`, `fileContent`, `mode`, `darkMode`, `rendererState`, `sidebarCollapsed`. No per-type flags in root state beyond `rendererState`.

## Document type behaviours

| Type | View | Edit | Always edit? |
|------|------|------|-------------|
| `markdown` | Rendered HTML | Toast UI Editor | No |
| `snippet` | Read-only Ace | Editable Ace | No |
| `drawing` | Read-only Excalidraw | Excalidraw editor | **Yes** — drawings are always in edit mode |
| `asset` | Card grid with preview/upload | N/A | N/A |
| `folder` | `home.md`/`index.md` as markdown, or card grid | N/A | N/A |

## Creation flows

- **New page**: "+" dropdown → name dialog (supports `/` for subfolders) → created in Drive → auto-navigates and enters edit mode via `pendingEditPath`.
- **New drawing**: "+" dropdown → name dialog → navigates to `#/_drawings` with `pendingNewDrawingName` set → `onRouteChange` opens a blank canvas pre-named → user edits → "Create" button in header saves to Drive.
- **New snippet**: "+" dropdown → navigates to `#/_snippets` with `pendingNewSnippet` set → `onRouteChange` opens a blank Ace editor with an auto-generated name (`snip-YYMMDD-HH-MM.ext`) → user edits → "Save" button in header saves to Drive with `rendererState.snippetType` and `rendererState.snippetExpiry`.
- **New asset**: drag-and-drop or upload button in the sidebar (assets perspective) or in `AssetViewer`.

## Structure (high level)
- `index.html`: Loads CDN dependencies and initializes the app.
- `config.js`: App configuration (OAuth client ID, Drive API endpoints, cache TTL, scope, optional Worker URL).
- `js/app.js`: Vue app root — router, global state, dialogs, provide/inject setup.
- `share.html` + `js/share-app.js`: Minimal unauthenticated shell for anonymous shared documents.
- `js/components/`: UI components — `AppHeader`, `Sidebar`/`SidebarTree`, `DocumentRenderer`, `Breadcrumb`, `LoginScreen`, `PageNotFound`.
- `js/renderers/`: One viewer + one editor per doc type (`Markdown`, `Snippet`, `Drawing`, `Asset`, `Folder`).
- `js/providers/`: Storage and auth provider contracts (`PersistenceProvider`, `AuthProvider`) and Google Drive implementations.
- `js/services/`: `StorageService` + `AuthManager` facades, `CacheService`, `DocumentService`, `RendererService`, `RealtimeService`.
- `css/app.css`: Layout and component styling (themed CSS custom properties, `.tree-item`, `.nav-btn`, `.prose`, etc.).
- `assets/`: App branding assets (logo).
- `worker/`: Optional Cloudflare Worker for real-time features (see `_docs/cloudflare-integration.md`).
