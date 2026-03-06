# Services

The app has three singleton service objects that handle authentication, Drive API calls, and caching. They are plain JavaScript objects (not classes, not Vue reactive) defined in `js/services/`.

---

## AuthService (`js/services/auth.js`)

Wraps Google Identity Services (GIS) for OAuth2 token management.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tokenClient` | object | GIS token client instance |
| `accessToken` | string | Current OAuth2 access token |
| `tokenExpiry` | number | Token expiry timestamp (ms) |
| `user` | object | User info (`{ name, email, picture }`) |

### Methods

| Method | Description |
|--------|-------------|
| `init(onAuthChange)` | Initialize GIS, restore session from sessionStorage, call `onAuthChange(bool)` on state change |
| `login()` | Trigger Google OAuth2 consent popup |
| `logout()` | Revoke token, clear session and cache, notify app |
| `getToken()` | Return valid token or trigger re-auth if expired. Returns `null` during re-auth |
| `isLoggedIn()` | Check if token exists and hasn't expired |

### Session Persistence

The access token, expiry timestamp, and user info are stored in `sessionStorage` under the key `wiki_auth`. This means:
- Token survives page refreshes within the same tab
- Token is lost when the tab/browser closes
- Token is never stored in localStorage (which persists indefinitely)

### Token Expiry

Google access tokens last approximately 1 hour. The app sets the expiry 60 seconds early (`expires_in - 60`) to avoid edge-case failures. When `getToken()` detects an expired token, it calls `login()` to re-trigger the consent flow.

---

## DriveService (`js/services/drive.js`)

Wraps the Google Drive REST API v3 for all file operations.

### Internal Methods

| Method | Description |
|--------|-------------|
| `_fetch(url, options)` | Authenticated fetch wrapper. Adds `Authorization` header, handles 401 (re-auth), throws on errors |
| `_createFolder(name, parentId)` | Create a folder in Drive. `parentId` null = Drive root |
| `_welcomeContent()` | Returns the default `index.md` Markdown content |

### Folder Operations

| Method | Description |
|--------|-------------|
| `getRootFolderId()` | Find or create the `_wiki` folder in Drive root. Cached. |
| `getAssetsFolderId()` | Find or create `_assets` inside `_wiki`. Cached via listing. |
| `listFolder(folderId)` | List children of a folder. Returns `[{ id, name, isFolder, modifiedTime }]` sorted folders-first then alphabetically. Uses stale-while-revalidate caching. |
| `createFolderPath(path)` | Create nested folders from a slash-separated path (e.g., `guides/advanced`). Creates missing segments. Returns the final folder's ID. |

### File Operations

| Method | Description |
|--------|-------------|
| `resolvePath(path)` | Convert a URL path (e.g., `guides/setup`) to a Drive file/folder. Walks segments, tries `.md` extension first, then exact name match. Returns `{ id, type, name, parentId }` or `{ type: 'not_found', ... }`. |
| `getFileContent(fileId)` | Download file content as text. Stale-while-revalidate cached. |
| `createFile(name, parentId, content)` | Create a text file via multipart upload (`multipart/related`). Used for `.md` pages. |
| `updateFile(fileId, content)` | Update file content via media upload (`PATCH` with `uploadType=media`). |
| `uploadBinary(name, parentId, blob, mimeType)` | Upload a binary file (images, PDFs, etc.) via multipart upload with proper binary encoding. |
| `deleteFile(fileId, parentId)` | Permanently delete a file. Invalidates parent listing cache. |
| `renameFile(fileId, newName, parentId)` | Rename a file or folder via metadata PATCH. |

### Utility Methods

| Method | Description |
|--------|-------------|
| `getDownloadUrl(fileId)` | Returns the Drive API download URL for a file (`?alt=media`). Requires auth header. |
| `getAuthHeaders()` | Returns `{ Authorization: 'Bearer ...' }` for use with raw `fetch()` calls. |
| `getFileMetadata(fileId)` | Fetch file metadata (id, name, mimeType, size, modifiedTime). |

### Path Resolution Algorithm

`resolvePath(path)` converts URL paths to Drive files:

1. Empty path or `/` -> return root folder
2. Split path into segments (e.g., `guides/setup` -> `['guides', 'setup']`)
3. Starting from root folder, for each segment:
   - List children of current folder
   - If last segment:
     a. Try `segment + '.md'` (file match) -> return as file
     b. Try exact name match -> return as file or folder
     c. Return `not_found`
   - If not last segment: find matching folder, continue walking
4. Results are cached by path with TTL

---

## CacheService (`js/services/cache.js`)

localStorage-based cache with TTL and stale-while-revalidate semantics.

### Cache Keys

All keys are prefixed with `wiki:` to avoid collisions:

| Key Pattern | Stored By | Content |
|-------------|-----------|---------|
| `wiki:root_id` | DriveService | Root `_wiki` folder ID |
| `wiki:listing:{folderId}` | DriveService.listFolder | Array of child file/folder objects |
| `wiki:content:{fileId}` | DriveService.getFileContent | Raw file content string |
| `wiki:path:{path}` | DriveService.resolvePath | Resolved path object `{ id, type, name }` |

### Cache Entry Format

```javascript
{
  value: <any>,           // The cached data
  expiry: <timestamp>,    // When the entry becomes stale (Date.now() + TTL)
  ts: <timestamp>         // When the entry was written (used for LRU eviction)
}
```

### Methods

| Method | Description |
|--------|-------------|
| `get(key)` | Get raw cache entry (value + metadata) |
| `getValue(key)` | Get just the cached value |
| `isFresh(key)` | Check if entry exists and hasn't expired |
| `set(key, value)` | Store value with TTL from `CONFIG.CACHE_TTL` |
| `remove(key)` | Delete a specific cache entry |
| `invalidatePath(path)` | Remove content, path, and parent listing caches for a path |
| `clear()` | Remove all `wiki:*` entries from localStorage |

### Stale-While-Revalidate

When a cached value is requested:
1. If **fresh** (within TTL): return cached value immediately, kick off a background fetch to update the cache silently
2. If **stale** (past TTL but exists): return cached value immediately, background fetch will update
3. If **missing**: await the fresh fetch

This pattern ensures the UI always loads instantly from cache while staying up-to-date with Drive.

### LRU Eviction

If `localStorage.setItem()` throws a quota error, the cache evicts the 5 oldest entries (by `ts` timestamp) and retries. If it still fails, the write is silently dropped.
