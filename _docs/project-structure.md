# Project Structure

## File layout
```
index.html
config.js
css/app.css
js/app.js
js/components/
  AppHeader.js        — header bar, create dropdown, dark mode toggle
  Breadcrumb.js       — path breadcrumb with document-aware name resolution
  DocumentRenderer.js — dispatcher: picks renderer by docType + mode
  LoginScreen.js      — Google sign-in
  PageNotFound.js     — 404 with "create page" action
  Sidebar.js          — unified tree with perspective filters (SidebarTree + Sidebar)
js/renderers/
  MarkdownViewer.js   — markdown rendering, mermaid, link interception
  MarkdownEditor.js   — Toast UI Editor wrapper
  SnippetViewer.js    — read-only Ace view with expiry display
  SnippetEditor.js    — editable Ace with name/type/expiry controls
  DrawingViewer.js    — read-only Excalidraw display
  DrawingEditor.js    — Excalidraw editor with save/fullscreen
  AssetViewer.js      — asset grid: preview, upload, rename, delete
  FolderViewer.js     — folder contents as cards, or home.md/index.md if present
js/services/
  auth.js             — OAuth token lifecycle
  cache.js            — localStorage cache with TTL
  document.js         — document model, type detection, special folder helpers
  drive.js            — Google Drive REST API wrapper
  renderer.js         — renderer registry (docType → component name)
assets/
```

## Core concepts

The architecture is built around three ideas:

1. **Document** — everything is a document. Markdown pages, snippets, drawings, assets, and folders are all represented by a single `Document` shape with a `docType` field (`markdown`, `snippet`, `drawing`, `asset`, `folder`).

2. **Renderer** — each document type has a view component and an optional edit component. `DocumentRenderer` dispatches to the correct one based on `docType` + `mode`. The registry lives in `RendererService`.

3. **Perspective** — the sidebar shows a single unified tree. Perspective filter buttons (All, Pages, Snippets, Drawings, Assets) narrow the tree to matching items. Special folders (`_snippets`, `_drawings`, `_assets`) auto-expand when their perspective is active.

## Tech stack (CDN & Local)
- Vue 3 (global build) for UI composition.
- Tailwind CSS for styling and utility classes.
- marked.js for Markdown rendering.
- highlight.js for code syntax highlighting.
- mermaid for diagrams.
- Toast UI Editor for page editing.
- Ace Editor for snippets.
- Excalidraw Web Component (built from `components/excalidraw-webcomponent`).
- Google Identity Services + Google Drive REST API.

## Script loading and boot flow
- `index.html` loads CDN libraries and the local Excalidraw web component script.
- `config.js` defines OAuth client ID, Drive API endpoints, cache TTL, and scope.
- Services (`cache.js`, `auth.js`, `drive.js`, `document.js`, `renderer.js`) load before renderers and components.
- Renderers load next (8 files under `js/renderers/`), then components.
- `js/app.js` registers everything globally and mounts the Vue app.
- Vue is pulled from `https://unpkg.com/vue@3/dist/vue.global.prod.js` to avoid a build step.

## Architecture approach
- **No build step for main app**: plain HTML/CSS/JS with CDN dependencies.
- **Pre-built components**: Excalidraw is bundled as a web component using Vite to simplify embedding.
- **Unified document model**: `DocumentService.toDocument()` normalises any Drive file into a standard shape. Type detection uses parent path, file extension, and `appProperties`.
- **Renderer dispatch**: `DocumentRenderer` receives a `document` + `mode`, looks up the component name from `RendererService`, and renders via `<component :is="...">`. All renderers emit standard events (`@save`, `@delete`, `@toast`, `@mode-change`, `@navigate`).
- **Minimal root state**: `js/app.js` holds one `document` object, `fileContent`, and `mode`. No per-type flags.
- **Perspective-filtered sidebar**: one tree component, one search input, five filter buttons. No separate list components for snippets or drawings.

## Authentication (OAuth2)
- Google Identity Services token client issues OAuth2 access tokens (OIDC-compatible identity provider).
- Scope is `https://www.googleapis.com/auth/drive.file` (only app-created files).
- Access token + user profile stored in `sessionStorage` and revalidated on expiry.

## Drive integration
- Root wiki folder path is defined by `CONFIG.ROOT_FOLDER_NAME` (supports nested paths like `team/_wiki`).
- `_assets`, `_snippets`, and `_drawings` folders are created lazily on first access via `getSpecialFolderId()`.
- `listFolder()` returns `appProperties` alongside file metadata so snippet expiry info is available in folder listings.
- Snippets store `type`, `expiryTs`, and `duration` in Drive `appProperties` metadata.

## Routing
- Hash-based routing (`window.location.hash`).
- Unified scheme: `#/path/to/doc` for all document types.
- `_snippets/`, `_drawings/`, `_assets/` are just folders treated uniformly by the router.
- Wiki pages: `#/path/to/page` resolves to `page.md` (preferred) or a folder.
- Snippets: `#/_snippets` shows the folder; `#/_snippets/<fileId>` opens a specific snippet.
- Drawings: `#/_drawings` shows the folder; `#/_drawings/<fileId>` opens a specific drawing.
- Assets: `#/_assets` opens the asset viewer (subfolder navigation handled internally).
- Route resolution: `onRouteChange()` calls `DocumentService.getSpecialFolder()` to detect special routes, then either `resolveSpecialRoute()` or `resolveWikiRoute()`.

## Services

| Service | File | Purpose |
|---------|------|---------|
| `AuthService` | `js/services/auth.js` | OAuth token lifecycle and user info |
| `DriveService` | `js/services/drive.js` | CRUD for all file types, folder paths, binary uploads |
| `CacheService` | `js/services/cache.js` | localStorage cache with TTL + stale-while-revalidate |
| `DocumentService` | `js/services/document.js` | `toDocument()` normaliser, `resolveDocumentType()`, `getSpecialFolder()` |
| `RendererService` | `js/services/renderer.js` | `getRenderer(docType, mode)` → component name, `canEdit(docType)` |

## Key components

| Component | File | Role |
|-----------|------|------|
| `AppHeader` | `js/components/AppHeader.js` | Header bar with context-aware buttons. "+" dropdown creates any document type. Edit/Save/Delete buttons appear based on `document.docType` and `RendererService.canEdit()`. |
| `Breadcrumb` | `js/components/Breadcrumb.js` | Path breadcrumb. Resolves snippet IDs and drawing filenames to human-readable names using the `document` prop. |
| `Sidebar` | `js/components/Sidebar.js` | Perspective filter buttons, search input, asset upload zone. Contains `SidebarTree` for recursive folder display. |
| `SidebarTree` | `js/components/Sidebar.js` | Recursive tree component. Shows docType-aware icons (document, code, canvas, paperclip). Snippet items show expiry badges. Navigation uses file IDs for snippets/drawings. |
| `DocumentRenderer` | `js/components/DocumentRenderer.js` | Dispatcher. Receives `document` + `mode`, resolves component name via `RendererService`, renders via `<component :is>`. |
| `PageNotFound` | `js/components/PageNotFound.js` | 404 page with "Create this page" button. |

## Renderers

| Renderer | File | View | Edit |
|----------|------|------|------|
| Markdown | `js/renderers/Markdown{Viewer,Editor}.js` | marked.js + mermaid + highlight.js + link interception | Toast UI Editor |
| Snippet | `js/renderers/Snippet{Viewer,Editor}.js` | Read-only Ace with copy button and expiry display | Editable Ace with name, language, and expiry controls |
| Drawing | `js/renderers/Drawing{Viewer,Editor}.js` | Read-only Excalidraw with download | Excalidraw editor with save and fullscreen |
| Asset | `js/renderers/AssetViewer.js` | Grid with preview modal, upload, rename, delete, subfolder navigation | (not editable) |
| Folder | `js/renderers/FolderViewer.js` | If `home.md` or `index.md` exists, renders it as markdown. Otherwise shows contents as cards with a "Create Page" button. | (not editable) |

## Folder behaviour
- Navigating to a folder checks for `home.md` or `index.md` inside it.
- If found, the file content is rendered as markdown (with mermaid and link interception).
- If not found, folder contents are displayed as a card grid with document-type icons, modification dates, and a "Create Page" button that creates `home.md` in that folder.

## Assets and snippets
- Assets live in Drive under `_wiki/_assets` and are linked with `/_assets/...` paths.
- Snippets live under `_wiki/_snippets` with metadata for language and expiry.

## Drawings
- Drawings live in Drive under `_wiki/_drawings` as Excalidraw JSON files (`.excalidraw` extension).
- Viewer shows read-only Excalidraw with download. Editor adds save, fullscreen, and name editing.

## How to extend

- **New document type**: add a `docType` case to `DocumentService.resolveDocumentType()`, register view/edit components in `RendererService._renderers`, create renderer files under `js/renderers/`, add `<script>` tags to `index.html`, and register the components in `js/app.js`.
- **New perspective**: add a filter button in `Sidebar`, add the filtering logic in `SidebarTree.filteredItems`.
- **New Drive operation**: add a method to `DriveService` and call it from the renderer.
