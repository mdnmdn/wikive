# Routing

Google Wiki uses hash-based routing. The URL fragment after `#` determines what content is displayed.

## URL Format

```
http://localhost:9595/#/path/to/page
```

The hash is parsed by `app.onRouteChange()` which listens to the `hashchange` event.

## Route Resolution

| URL Hash | Resolved To |
|----------|-------------|
| `#/` or empty | Root `_wiki` folder (folder listing) |
| `#/index` | `_wiki/index.md` (file) |
| `#/guides` | `_wiki/guides/` if folder exists, or `_wiki/guides.md` if file |
| `#/guides/setup` | `_wiki/guides/setup.md` (tries .md first, then exact name) |
| `#/_assets` | Asset manager (special route) |
| `#/nonexistent` | PageNotFound component |

## Path Resolution Algorithm

When a hash changes, the app calls `DriveService.resolvePath(path)`:

1. **Empty or `/`**: Returns the root `_wiki` folder
2. **`_assets` prefix**: Triggers the asset manager route (handled in `app.js` before `resolvePath`)
3. **All other paths**: Split into segments and walk the Drive folder tree:

```
Path: "guides/setup"
Segments: ["guides", "setup"]

Step 1: List _wiki/ children
  -> Find folder "guides" -> enter it

Step 2: List guides/ children  (last segment)
  -> Try "setup.md" -> found! Return as file
  -> If not found, try "setup" exact match -> folder or non-md file
  -> If nothing matches -> return not_found
```

## File vs Folder Priority

For the last segment of a path:

1. **File with `.md`** is tried first: `segment.md`
2. **Exact name match** is tried second: could be a folder or a non-Markdown file
3. **Not found**: triggers the PageNotFound component

This means if you have both `notes.md` and a `notes/` folder, the file takes priority at `#/notes`.

## Navigation Methods

### Sidebar Click
`SidebarTree.navigate(item)` sets `window.location.hash = '#/' + path`. For folders, it also toggles expansion.

### Breadcrumb Click
Each breadcrumb segment links to `#/` + the path up to that segment.

### Wiki Links
In rendered Markdown, relative links (those not starting with `http` or `#`) are intercepted by `PageView.interceptLinks()`. The link's `href` is resolved relative to the current page's directory:

```markdown
<!-- On page at #/guides/setup -->
[See advanced](advanced)        -> #/guides/advanced
[Back to index](../index)       -> #/index
```

### Logo Click
The app logo always links to `#/`.

### Hash Change
Any programmatic change to `window.location.hash` triggers `onRouteChange()`.

## Special Routes

| Route | Handler |
|-------|---------|
| `#/_assets` | `AssetManager` component with `_assets` folder |
| `#/_assets/*` | Same - subfolder navigation is handled within AssetManager |

The `_assets` route is detected in `app.onRouteChange()` before `DriveService.resolvePath()` is called. This avoids resolving `_assets` as a regular wiki path.

## Why Hash Routing?

Hash-based routing (`#/path`) has key advantages for a zero-backend app:

1. **No server configuration**: The server always serves `index.html` regardless of the URL path. No rewrite rules needed.
2. **Works with `file://`**: The app can be opened directly as a file in the browser.
3. **Works on any hosting**: GitHub Pages, S3, Netlify, Apache, nginx - no `.htaccess` or `_redirects` file needed.
4. **No library needed**: `window.addEventListener('hashchange', ...)` is all it takes.
