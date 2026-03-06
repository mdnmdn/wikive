# Architecture

## File Structure

```
google-wiki/
  index.html                          # Entry point - loads all CDN deps and app scripts
  config.js                           # OAuth client ID, API URLs, cache TTL
  justfile                            # just serve -> python3 -m http.server 8080
  css/
    app.css                           # Layout, prose, sidebar, toast, asset manager styles
  js/
    app.js                            # Vue app instance, router, global state, component registration
    services/
      auth.js                        # AuthService - Google Identity Services wrapper
      cache.js                       # CacheService - localStorage with TTL
      drive.js                       # DriveService - Google Drive REST API
    components/
      LoginScreen.js                  # Sign-in card (shown when not authenticated)
      AppHeader.js                    # Top bar: logo, breadcrumb, action buttons, user menu
      Breadcrumb.js                   # Clickable path segments from current route
      Sidebar.js                      # Sidebar + SidebarTree (recursive folder tree)
      PageView.js                     # Markdown renderer (marked + hljs + mermaid)
      PageEditor.js                   # Toast UI Editor wrapper
      PageNotFound.js                 # "Create this page" prompt
      AssetManager.js                 # File upload, preview, rename, delete, wiki paths
```

## CDN Dependencies

All dependencies load from CDNs in `index.html`. No package.json, no node_modules:

| Library | CDN | Purpose |
|---------|-----|---------|
| Vue 3 | unpkg | Reactive UI framework |
| Tailwind CSS | cdn.tailwindcss.com | Utility-first CSS (with shadcn color tokens) |
| marked.js | jsdelivr | Markdown to HTML conversion |
| highlight.js | cdnjs | Syntax highlighting for code blocks |
| mermaid | jsdelivr | Diagram rendering (flowcharts, sequence, etc.) |
| Toast UI Editor | uicdn.toast.com | WYSIWYG + raw Markdown editor |
| Google Identity Services | accounts.google.com | OAuth2 authentication |

## Component Tree

```
#app (Vue root)
  LoginScreen                    (if not authenticated)
  AppHeader                      (always shown when authenticated)
    Breadcrumb
  Sidebar
    SidebarTree                  (recursive, lazy-loads subfolders)
  main-content
    AssetManager                 (if route is #/_assets)
    PageEditor                   (if mode === 'edit')
    PageNotFound                 (if resolved.type === 'not_found')
    PageView                     (default: render markdown or folder listing)
```

## Data Flow

```
User clicks sidebar link
  -> window.location.hash changes
  -> hashchange event fires
  -> app.onRouteChange()
  -> DriveService.resolvePath(path)
     -> walks folder segments via listFolder()
     -> returns { id, type, name, parentId }
  -> if file: DriveService.getFileContent(id) -> app.fileContent
  -> PageView renders markdown (marked + hljs + mermaid)
```

```
User clicks Edit
  -> app.mode = 'edit'
  -> PageEditor mounts, creates Toast UI Editor with fileContent
  -> User edits content
  -> User clicks Save
  -> editor.getMarkdown() -> DriveService.updateFile(id, content)
  -> app.mode = 'view', re-render
```

```
User uploads asset
  -> AssetManager.uploadFiles()
  -> DriveService.uploadBinary(name, folderId, blob, mimeType)
     -> multipart/related POST to Drive upload API
  -> cache invalidated, file list reloaded
```

## State Management

There is no Vuex or Pinia. The app uses Vue's built-in reactivity:

- **App-level state** (`js/app.js`): `authenticated`, `user`, `rootId`, `currentPath`, `resolved`, `fileContent`, `mode`, `isAssetsRoute`, `assetsFolderId`
- **Component-level state**: Each component manages its own local data (e.g., `Sidebar` tracks `expanded` folders, `AssetManager` tracks `folderStack`)
- **Singleton services**: `AuthService`, `DriveService`, `CacheService` are plain objects with methods. They are not reactive - components call them and store results in their own reactive data.

## Google Drive Folder Structure

When the app initializes, it creates this structure in the user's Google Drive:

```
My Drive/
  _wiki/                         # Root wiki folder (created on first login)
    index.md                     # Welcome page (created on first login)
    _assets/                     # Asset storage (created on first visit to Assets)
      images/                    # User-created subfolders
      documents/
    guides/                      # User-created content folders
      setup.md
      advanced.md
    notes.md
```

The `_assets` folder is hidden from the sidebar's page tree and shown as a separate "Assets" link at the bottom of the sidebar.

## Script Loading Order

Scripts in `index.html` load in dependency order:

1. **CDN libraries** (in `<head>`): Tailwind, highlight.js, Toast UI Editor CSS/JS
2. **`config.js`**: Must load before services (they reference `CONFIG`)
3. **Vue 3**: Must load before components and app.js
4. **marked.js, mermaid**: Must load before PageView uses them
5. **Google Identity Services**: Loaded async, AuthService waits for it
6. **Services** (`cache.js` -> `auth.js` -> `drive.js`): Order matters - auth.js uses CacheService, drive.js uses both
7. **Components**: Order doesn't matter (registered before mount)
8. **`app.js`**: Last - creates app, registers components, mounts

## Styling Approach

- **Tailwind CSS** via CDN script tag with a custom config that defines shadcn/ui color tokens as CSS custom properties
- **CSS custom properties** in `:root` for the color system (background, foreground, muted, accent, primary, destructive, border)
- **`css/app.css`** for layout (sidebar, main content, app body), prose typography, component-specific styles (sidebar tree, asset cards, drop zone, toasts, spinner)
- Components use Tailwind utility classes in their templates and reference CSS custom properties via `hsl(var(--name))` for consistent theming
