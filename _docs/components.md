# Components

All components are plain JavaScript objects with `template` strings, registered globally via `app.component()` in `js/app.js`. They use Vue 3's Options API.

---

## LoginScreen (`js/components/LoginScreen.js`)

The landing page shown when the user is not authenticated.

- Centered card with app icon, title, description
- "Sign in with Google" button that calls `AuthService.login()`
- Note about the `drive.file` scope limitation

**Props**: none
**Events**: none

---

## AppHeader (`js/components/AppHeader.js`)

The top navigation bar, always visible when authenticated.

- Left: app logo/title (links to `#/`), Breadcrumb component
- Center-right: context-sensitive action buttons
  - View mode + file resolved: **Edit** button
  - Edit mode: **Save** and **Cancel** buttons
  - Always: **New Page** button (+)
- Right: user avatar, name, logout button

**Props**: `currentPath`, `mode`, `user`, `resolved`
**Events**: `edit`, `save`, `cancel`, `new-page`

---

## Breadcrumb (`js/components/Breadcrumb.js`)

Renders the current path as clickable segments.

Example: path `guides/setup` renders as `/ guides / setup` where each segment links to its corresponding hash route.

**Props**: `path`
**Events**: none

---

## Sidebar (`js/components/Sidebar.js`)

The left sidebar containing the page tree and assets link.

- "Pages" heading
- `SidebarTree` component (recursive, starts from root folder)
- Separator line
- "Assets" link (`#/_assets`) with active state detection

The `_assets` folder is filtered out of the page tree to avoid duplication.

**Props**: `rootId`, `currentPath`
**Events**: none

---

## SidebarTree (`js/components/Sidebar.js`)

A recursive tree component that renders folder contents.

- Loads children via `DriveService.listFolder()` on mount
- Folders show open/closed folder icons, click toggles expansion
- Files show document icon, click navigates
- Active item gets highlighted background
- Lazy-loads subfolder contents on expansion
- Displays file names without `.md` extension

**Props**: `folderId`, `basePath`, `currentPath`
**Events**: none (navigates via `window.location.hash`)

---

## PageView (`js/components/PageView.js`)

Renders page content based on the resolved path.

### File mode
- Fetches content via `DriveService.getFileContent()`
- Renders Markdown to HTML using `marked.js`
- Applies syntax highlighting via `highlight.js`
- Renders mermaid diagrams (fenced code blocks with language `mermaid`)
- Intercepts relative links and converts them to hash navigation

### Folder mode
- Lists folder contents via `DriveService.listFolder()`
- Renders as a clickable file/folder list

### Markdown rendering pipeline

1. Custom `marked.Renderer` intercepts code blocks:
   - Language `mermaid` -> `<pre class="mermaid">` (processed by mermaid.js)
   - Other languages -> `hljs.highlight()` for syntax coloring
2. `marked.parse()` converts Markdown to HTML with GFM support
3. After Vue DOM update (`$nextTick`):
   - `mermaid.run()` renders all `.mermaid` elements
   - Relative links (`[text](path)`) get click handlers for hash navigation

**Props**: `resolved`, `currentPath`
**Events**: none

---

## PageEditor (`js/components/PageEditor.js`)

Wraps Toast UI Editor for WYSIWYG and raw Markdown editing.

- Creates a Toast UI `Editor` instance on mount, destroys on unmount
- Initial edit type: WYSIWYG (user can toggle to Markdown mode via the editor's built-in tab)
- Preview style: vertical split
- Toolbar: heading, bold, italic, strike, hr, quote, lists, table, link, code, codeblock
- `getContent()` method returns the current Markdown from the editor

**Props**: `content`, `resolved`
**Events**: `save`
**Exposed methods**: `getContent()` - called by the parent app to retrieve editor content on save

---

## PageNotFound (`js/components/PageNotFound.js`)

Shown when the URL path doesn't match any file or folder in Drive.

- Displays the path that wasn't found
- "Create this page" button that emits a `create` event

**Props**: `path`
**Events**: `create(path)` - parent app handles page creation

---

## AssetManager (`js/components/AssetManager.js`)

Full-featured asset management interface. See [assets.md](assets.md) for detailed documentation.

**Props**: `assetsFolderId`
**Events**: `toast(message, type)` - parent app shows notification

---

## Root App (`js/app.js`)

The Vue app instance acts as the root component and router.

### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `authenticated` | boolean | Whether the user is logged in |
| `user` | object | `{ name, email, picture }` from Google |
| `rootId` | string | Google Drive ID of the `_wiki` folder |
| `currentPath` | string | Current path from the URL hash |
| `resolved` | object | Result of `DriveService.resolvePath()` |
| `fileContent` | string | Raw Markdown content of the current file |
| `mode` | string | `'view'` or `'edit'` |
| `toast` | object | `{ message, type }` for notification display |
| `showNewPage` | boolean | Whether the new-page dialog is open |
| `newPagePath` | string | Path input in the new-page dialog |
| `isAssetsRoute` | boolean | Whether current route is `_assets` |
| `assetsFolderId` | string | Drive ID of the `_assets` folder |

### Key Methods

| Method | Description |
|--------|-------------|
| `initApp()` | Get root folder ID, trigger initial route |
| `onRouteChange()` | Parse hash, detect assets route, resolve path, load content |
| `startEdit()` | Switch to edit mode |
| `save()` | Get content from editor, update Drive, switch to view mode |
| `cancelEdit()` | Switch back to view mode without saving |
| `createPage(path)` | Create folders if needed, create `.md` file, navigate to it |
| `showNewPageDialog()` | Open the new-page modal |
| `refreshSidebar()` | Force sidebar re-render by toggling `rootId` |
| `showToast(message, type)` | Display a notification for 3 seconds |
