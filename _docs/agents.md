# Agents

## Goal
Build a zero-backend personal wiki that runs entirely in the browser, storing Markdown pages and related files in the user’s Google Drive. The app is designed to run as a static bundle (no build step, no server), so everything loads from CDN-hosted libraries and Google APIs.

## Core features
- Google OAuth login via Google Identity Services with minimum scope (`drive.file`).
- Markdown pages stored as Drive files, organized by folders.
- Page viewing with Markdown rendering, syntax highlighting, and Mermaid diagrams.
- Page editing with Toast UI Editor (WYSIWYG + Markdown).
- Hash-based routing (`#/path`) for static hosting.
- Sidebar navigation, breadcrumbs, new page creation, and quick refresh.
- Asset manager for uploading, browsing, previewing, renaming, deleting, and copying wiki paths.
- Snippet manager for temporary code/text snippets with expiry metadata.
- Drawings manager for creating and reopening Excalidraw diagrams.
- Local caching with stale-while-revalidate for fast loads.
- Anonymous share links for markdown pages, snippets, and drawings using provider-native public sharing.
- Optional dark mode toggle.

## How it works
- **Runtime boot**: `index.html` loads CDN dependencies (Vue 3 global build, editors, Markdown tooling) and the locally built Excalidraw web component, then app services/components, and finally `js/app.js` which mounts the Vue app.
- **Authentication**: Google Identity Services uses the OAuth2 token flow to issue Drive API access tokens. Tokens and user profile data are cached in `sessionStorage` and refreshed when expired. Scope is `drive.file`, limiting access to files the app creates.
- **Drive model**: A root wiki folder is created (from `CONFIG.ROOT_FOLDER_NAME`). Within it, `_assets`, `_snippets`, and `_drawings` subfolders are created on first use. Pages are stored as `.md` files, assets are binaries, snippets store metadata (language, expiry) in Drive `appProperties`, and drawings store Excalidraw JSON.
- **Routing**: Hash routes resolve to Drive paths. For a path segment, the app tries `segment.md` first, then an exact name match, and falls back to a not-found view.
- **UI flow**: Components request data from services, store it in local state, and render view/edit/asset/snippet/drawing modes based on the current route and app state.
- **Anonymous share flow**: From a file document, the header can enable anonymous sharing. The active persistence provider is responsible for making the backing file publicly readable (for Google Drive: `anyone` + `reader`). The app then generates a `share.html?...` link that opens a frameless read-only renderer without requiring login. For Google Drive shared rendering, content is fetched through the optional Worker proxy to avoid browser-side XHR restrictions on public Drive downloads.

## Drawings
- **New diagrams**: Use the drawings manager UI to create a new Excalidraw diagram, which is saved as a JSON file under the `_drawings` folder in the wiki root.
- **Open diagrams**: Browse and open existing diagram files from `_drawings` to continue editing them in the Excalidraw canvas.

## Structure (high level)
- `index.html`: Loads CDN dependencies and initializes the app.
- `config.js`: App configuration (OAuth client ID, Drive API endpoints, cache TTL, scope).
- `js/app.js`: Vue app, router, and global state.
- `share.html`: Minimal unauthenticated shell for anonymous shared documents.
- `js/components/`: UI components (header, sidebar, editor, asset manager, snippets, etc.).
- `js/providers/`: Storage and auth provider contracts and implementations (see `_docs/persistence-providers.md`).
- `js/services/`: StorageService/AuthManager facades, cache, document model, renderer registry.
- `js/share-app.js`: Frameless read-only app used by anonymous share links.
- `css/app.css`: Layout and component styling.
- `assets/`: App branding assets.
