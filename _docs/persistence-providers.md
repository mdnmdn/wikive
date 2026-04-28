# Persistence Providers

## Overview

The wiki uses a **provider abstraction** to decouple storage and authentication from any single backend. The default provider is Google Drive, but the architecture supports swapping in OneDrive, S3, Box, or any custom backend.

```
┌─────────────────┐     ┌────────────────┐
│  Components      │────▶│ StorageService │──┐
│  (Sidebar, etc.) │     │   (facade)     │  │    ┌──────────────────────┐
└─────────────────┘     └────────────────┘  ├───▶│ GoogleDriveProvider   │
                                             │    └──────────────────────┘
┌─────────────────┐     ┌────────────────┐  │    ┌──────────────────────┐
│  LoginScreen     │────▶│  AuthManager   │──┘    │ OneDriveProvider (…) │
│  AppHeader       │     │   (facade)     │       └──────────────────────┘
└─────────────────┘     └────────────────┘
```

Components never call a provider directly. They call `StorageService.method()` and `AuthManager.method()`, which delegate to whichever provider is active.

The original `DriveService` and `AuthService` globals remain available (from `auth.js` / `drive.js`) for any code that hasn't been migrated yet.

## Architecture

### Layer stack

1. **Base classes** (`js/providers/PersistenceProvider.js`, `AuthProvider.js`) — define the contract. Every method throws "Not implemented" by default.
2. **Provider implementations** (`js/providers/GoogleDriveProvider.js`, `GoogleAuthProvider.js`) — extend the base class and implement all methods for a specific backend.
3. **Facades** (`js/services/storage.js`, `js/services/auth-manager.js`) — global `StorageService` and `AuthManager` objects that delegate to the active provider. Bootstrap logic at the bottom reads `CONFIG.PROVIDER` and wires up the correct implementation.
4. **Original services** (`js/services/drive.js`, `js/services/auth.js`) — legacy globals still loaded after the facades, available for backward compatibility.

### Script loading order

```
cache.js
providers/PersistenceProvider.js
providers/AuthProvider.js
providers/GoogleDriveProvider.js
providers/GoogleAuthProvider.js
services/auth-manager.js        ← creates AuthManager, bootstraps auth provider
services/storage.js              ← creates StorageService, bootstraps storage provider
services/auth.js                 ← original AuthService (legacy)
services/drive.js                ← original DriveService (legacy)
services/document.js
services/renderer.js
```

### Provider selection

`CONFIG.PROVIDER` in `config.js` determines which provider is instantiated. The bootstrap code in `auth-manager.js` and `storage.js` reads this value:

```js
if (CONFIG.PROVIDER === 'google-drive') {
  AuthManager.setProvider(new GoogleAuthProvider(CONFIG));
  StorageService.setProvider(new GoogleDriveProvider(AuthManager, CONFIG));
}
```

## PersistenceProvider interface

All storage providers must extend `PersistenceProvider` and implement these methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `initialize` | `()` | `void` | One-time setup after auth is ready |
| `getRootFolderId` | `()` | `string` | Root folder ID for the wiki |
| `listFolder` | `(folderId)` | `Array<FileEntry>` | List folder contents |
| `resolvePath` | `(path)` | `ResolvedPath \| null` | Resolve wiki path to file/folder |
| `createFolderPath` | `(path)` | `string` | Create nested folders, return final ID |
| `getFileContent` | `(fileId)` | `string` | Read file content as text |
| `getFileMetadata` | `(fileId)` | `object` | File metadata (id, name, mimeType, size, dates) |
| `createFile` | `(name, parentId, content, options?)` | `object` | Create file. `options.mimeType`, `options.appProperties` |
| `updateFile` | `(fileId, content, metadata?)` | `object` | Update file content and/or metadata |
| `uploadBinary` | `(name, parentId, blob, mimeType)` | `object` | Upload binary file |
| `deleteFile` | `(fileId, parentId?)` | `void` | Delete file |
| `renameFile` | `(fileId, newName, parentId?)` | `object` | Rename file |
| `createFolder` | `(name, parentId)` | `string` | Create single folder, return ID |
| `getSpecialFolderId` | `(folderName)` | `string` | Get/create special folder (_assets, etc.) |
| `getAssetsFolderId` | `()` | `string` | Shorthand for `getSpecialFolderId('_assets')` |
| `getDrawingsFolderId` | `()` | `string` | Shorthand for `getSpecialFolderId('_drawings')` |
| `getSnippetsFolderId` | `()` | `string` | Shorthand for `getSpecialFolderId('_snippets')` |
| `listSnippets` | `(folderId)` | `Array` | List snippets with metadata |
| `createSnippet` | `(name, content, type, expiryTs, duration)` | `object` | Create snippet with metadata |
| `updateSnippet` | `(fileId, name, content, type, expiryTs, duration)` | `void` | Update snippet content + metadata |
| `createDrawing` | `(name, content, folderId)` | `object` | Create `.excalidraw` file |
| `getDownloadUrl` | `(fileId)` | `string` | URL to download file content |
| `getAuthHeaders` | `()` | `object` | Auth headers for download requests |
| `ensureHomePage` | `(folderId)` | `void` | Create home.md if missing |
| `enableAnonymousShare` | `(fileId)` | `object` | Make a file publicly readable using the provider’s built-in sharing model |
| `getAnonymousShareUrl` | `(fileId)` | `string` | Public unauthenticated content URL for an anonymously shared file |
| `purgeExpiredSnippets` | `(items, parentId)` | `Array` | Filter + delete expired snippets |
| `moveFile` | `(fileId, newName, oldParentId, newParentId)` | `object` | Move and/or rename a file |
| `copyFile` | `(fileId, name, parentId)` | `object` | Copy a file |

### FileEntry shape (returned by `listFolder`)

```js
{
  id: string,
  name: string,
  isFolder: boolean,
  mimeType: string,
  modifiedTime: string,       // ISO 8601
  appProperties: object|null  // provider-specific metadata
}
```

### ResolvedPath shape (returned by `resolvePath`)

```js
// Found:
{ id: string, type: 'file'|'folder', name: string, parentId: string, path?: string }

// Not found:
{ type: 'not_found', parentId: string, name: string, path: string }
```

## AuthProvider interface

All auth providers must extend `AuthProvider` and implement:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `init` | `(onAuthChange)` | `void` | Initialize auth. Call `onAuthChange(bool)` on state change |
| `login` | `()` | `void` | Trigger login flow |
| `logout` | `()` | `void` | Clear tokens, revoke session |
| `getToken` | `()` | `string\|null` | Current valid token, or null (triggers re-auth) |
| `isLoggedIn` | `()` | `boolean` | Whether user has valid session |

Plus the `user` property: `{ name: string, email: string, picture: string }`.

## How to add a new provider

### 1. Create provider files

```
js/providers/OneDriveProvider.js    — extends PersistenceProvider
js/providers/OneDriveAuthProvider.js — extends AuthProvider
```

### 2. Implement all interface methods

Use `GoogleDriveProvider.js` as a reference. Key considerations:

- **Folder model**: Google Drive uses folder IDs. If your backend uses paths (S3), you'll need to map between the two conventions.
- **Metadata storage**: Google Drive uses `appProperties` for snippet metadata. Other backends may use custom headers (S3), file properties (OneDrive), or a sidecar JSON file.
- **Caching**: Use `CacheService` internally for the same stale-while-revalidate pattern.
- **Auth headers**: `getAuthHeaders()` should return whatever headers are needed to fetch download URLs. For presigned URLs (S3), return `{}`.
- **Anonymous share**: Providers that support public links should implement `enableAnonymousShare()` and `getAnonymousShareUrl()`. The app uses those methods to expose a copyable `share.html` link that opens a read-only renderer without authentication.
- **Public download constraints**: Some providers expose public download URLs that work for top-level navigation but not browser XHR. In those cases the app may need a lightweight proxy layer for the frameless shared renderer.

### 3. Add script tags to index.html

```html
<!-- Provider implementations -->
<script src="js/providers/GoogleDriveProvider.js"></script>
<script src="js/providers/GoogleAuthProvider.js"></script>
<script src="js/providers/OneDriveProvider.js"></script>
<script src="js/providers/OneDriveAuthProvider.js"></script>
```

### 4. Add bootstrap logic

In `js/services/auth-manager.js`:
```js
if (provider === 'onedrive') {
  AuthManager.setProvider(new OneDriveAuthProvider(CONFIG));
}
```

In `js/services/storage.js`:
```js
if (provider === 'onedrive') {
  StorageService.setProvider(new OneDriveProvider(AuthManager, CONFIG));
}
```

### 5. Add config keys

```js
const CONFIG = {
  PROVIDER: 'onedrive',

  // OneDrive config
  ONEDRIVE_CLIENT_ID: '...',
  ONEDRIVE_REDIRECT_URI: '...',

  // Shared
  ROOT_FOLDER_NAME: '_wiki',
  CACHE_TTL: 5 * 60 * 1000,
};
```

## Provider-specific notes

### Google Drive
- Uses `drive.file` scope (app can only access files it created)
- Files identified by opaque IDs
- Metadata stored in `appProperties`
- Auth via Google Identity Services OAuth2 token flow
- Anonymous sharing is implemented with the Drive permissions API by adding an `anyone` / `reader` permission, then using the public `https://drive.usercontent.google.com/download?id=...&export=download` URL as the content source for `share.html`
- If Drive returns a `resourceKey` for the file, the provider must pass it through so the unauthenticated share shell can send the `X-Goog-Drive-Resource-Keys` header when fetching content
- Because the Drive public download endpoint may reject browser XHR even when direct navigation works, the recommended shared-renderer path is to fetch the file through the optional Worker `/share-file` proxy

### OneDrive (future)
- Would use Microsoft Graph API
- Auth via MSAL.js
- Files identified by item IDs or paths
- Metadata via custom properties or driveItem fields

### S3 (future)
- No native folder concept — use key prefixes
- Auth via AWS Cognito or presigned URLs
- Metadata via S3 object tags or a manifest file
- `getDownloadUrl` returns presigned URL, `getAuthHeaders` returns `{}`

### Box (future)
- Auth via Box OAuth2 / JWT
- Files identified by numeric IDs
- Metadata via Box metadata templates
