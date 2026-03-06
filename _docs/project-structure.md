# Project Structure

## File layout
```
index.html
config.js
css/app.css
js/app.js
js/components/
  AppHeader.js
  AssetManager.js
  Breadcrumb.js
  LoginScreen.js
  PageEditor.js
  PageNotFound.js
  PageView.js
  Sidebar.js
  SnippetManager.js
js/services/
  auth.js
  cache.js
  drive.js
assets/
```

## Tech stack (CDN)
- Vue 3 (global build) for UI composition.
- Tailwind CSS for styling and utility classes.
- marked.js for Markdown rendering.
- highlight.js for code syntax highlighting.
- mermaid for diagrams.
- Toast UI Editor for page editing.
- Ace Editor for snippets.
- Google Identity Services + Google Drive REST API.

## Script loading and boot flow
- `index.html` loads CDN libraries first (UI frameworks and editors).
- `config.js` defines OAuth client ID, Drive API endpoints, cache TTL, and scope.
- Services (`cache.js`, `auth.js`, `drive.js`) load before components.
- Components are registered globally, then `js/app.js` mounts the Vue app.
- Vue is pulled from `https://unpkg.com/vue@3/dist/vue.global.prod.js` to avoid a build step.

## Architecture approach
- **No build step**: plain HTML/CSS/JS with CDN dependencies.
- **Thin services**: `AuthService`, `DriveService`, `CacheService` encapsulate external APIs and storage.
- **State at the root**: `js/app.js` holds global state and switches between view/edit/assets/snippets.
- **Component-driven UI**: each component owns its local state, calling services as needed.

## Authentication (OAuth2)
- Google Identity Services token client issues OAuth2 access tokens (OIDC-compatible identity provider).
- Scope is `https://www.googleapis.com/auth/drive.file` (only app-created files).
- Access token + user profile stored in `sessionStorage` and revalidated on expiry.

## Drive integration
- Root wiki folder path is defined by `CONFIG.ROOT_FOLDER_NAME` (supports nested paths).
- `_assets` and `_snippets` folders are created lazily on first access.
- Page routing resolves to Drive files by trying `segment.md` first, then an exact name match.
- Snippets store `type`, `expiryTs`, and `duration` in Drive `appProperties` metadata.

## Routing
- Hash-based routing (`window.location.hash`).
- Wiki pages: `#/path/to/page` resolves to a Drive folder or `page.md`.
- Assets: `#/_assets` opens the asset manager (subfolders handled internally).
- Snippets: `#/_snippets` and `#/_snippets/<id>` open snippet list/editor.
- Route resolution prefers `segment.md`, then exact name match.

## Services
- `AuthService` (`js/services/auth.js`): OAuth token lifecycle and user info.
- `DriveService` (`js/services/drive.js`): CRUD for pages, assets, and snippets.
- `CacheService` (`js/services/cache.js`): localStorage cache with TTL + stale-while-revalidate.

## Key components
- `AppHeader`: Global actions, user menu, and breadcrumb.
- `Sidebar`: Wiki tree, snippets list, and assets entry with search.
- `PageView`: Markdown rendering, mermaid, and link interception.
- `PageEditor`: Toast UI Editor wrapper.
- `AssetManager`: Uploads, previews, downloads, and wiki path copying.
- `SnippetManager`: Ace-based editor with expiry metadata.

## Assets and snippets
- Assets live in Drive under `_wiki/_assets` and are linked with `/_assets/...` paths.
- Snippets live under `_wiki/_snippets` with metadata for language and expiry.

## How to extend
- **New component**: add a file under `js/components/`, then register it in `js/app.js`.
- **New route**: extend `onRouteChange()` in `js/app.js` to handle the hash prefix and render a new component.
- **New Drive operation**: add a method to `DriveService` and call it from the component.
- **Sidebar entry**: update `Sidebar` to link to the new route or folder.
