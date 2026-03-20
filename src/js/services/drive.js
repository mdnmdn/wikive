// Google Drive REST API service
const DriveService = {
  _rootId: null,

  async _fetch(url, options = {}) {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Token expired
      AuthService.login();
      throw new Error('Token expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Drive API error: ${res.status}`);
    }

    return res;
  },

  async getRootFolderId() {
    if (this._rootId) return this._rootId;

    // Check cache
    const cached = CacheService.getValue('root_id');
    if (cached) {
      this._rootId = cached;
      return cached;
    }

    // Handle hierarchical paths (e.g., "sefin-devops/_wiki")
    const pathSegments = CONFIG.ROOT_FOLDER_NAME.split('/').filter(Boolean);
    let currentParentId = 'root';

    for (let i = 0; i < pathSegments.length; i++) {
      const folderName = pathSegments[i];
      const isLast = i === pathSegments.length - 1;

      // Search for existing folder by name and parent
      const q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`;
      const res = await this._fetch(
        `${CONFIG.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
      );
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        currentParentId = data.files[0].id;
      } else {
        // Folder not found, create it
        const parentIdToCreate = currentParentId === 'root' ? null : currentParentId;
        currentParentId = await this._createFolder(folderName, parentIdToCreate);
      }

      if (isLast) {
        await this.ensureHomePage(currentParentId);
      }
    }

    this._rootId = currentParentId;
    CacheService.set('root_id', this._rootId);
    return this._rootId;
  },

  async _createFolder(name, parentId) {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) metadata.parents = [parentId];

    const res = await this._fetch(`${CONFIG.DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    return data.id;
  },

  async listFolder(folderId) {
    // Check cache first
    const cacheKey = 'listing:' + folderId;
    const cached = CacheService.getValue(cacheKey);

    const fetchFresh = async () => {
      const q = `'${folderId}' in parents and trashed=false`;
      const fields = 'files(id,name,mimeType,modifiedTime,appProperties)';
      const res = await this._fetch(
        `${CONFIG.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=name`
      );
      const data = await res.json();
      const files = (data.files || []).map(f => ({
        id: f.id,
        name: f.name,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        appProperties: f.appProperties || null,
      }));
      // Sort: folders first, then alphabetically
      files.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      CacheService.set(cacheKey, files);
      return files;
    };

    if (cached && CacheService.isFresh(cacheKey)) {
      // Stale-while-revalidate: return cached, refresh in background
      fetchFresh().catch(() => {});
      return cached;
    }

    if (cached) {
      // Stale cache - return it but also fetch fresh
      fetchFresh().catch(() => {});
      return cached;
    }

    return await fetchFresh();
  },

  async getFileContent(fileId) {
    const cacheKey = 'content:' + fileId;
    const cached = CacheService.getValue(cacheKey);

    const fetchFresh = async () => {
      const res = await this._fetch(
        `${CONFIG.DRIVE_API}/files/${fileId}?alt=media`
      );
      const content = await res.text();
      CacheService.set(cacheKey, content);
      return content;
    };

    if (cached && CacheService.isFresh(cacheKey)) {
      fetchFresh().catch(() => {});
      return cached;
    }

    if (cached) {
      fetchFresh().catch(() => {});
      return cached;
    }

    return await fetchFresh();
  },

  async resolvePath(path) {
    if (!path || path === '/' || path === '') {
      const rootId = await this.getRootFolderId();
      const children = await this.listFolder(rootId);
      const homeFile = children.find(f => !f.isFolder && f.name === 'home.md');
      if (homeFile) {
        return { id: homeFile.id, type: 'file', name: homeFile.name, parentId: rootId };
      }
      return { type: 'not_found', parentId: rootId, name: 'home', path: 'home' };
    }

    // Check cache
    const cacheKey = 'path:' + path;
    const cached = CacheService.getValue(cacheKey);
    if (cached && CacheService.isFresh(cacheKey)) return cached;

    const segments = path.split('/').filter(Boolean);
    let currentId = await this.getRootFolderId();

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      const children = await this.listFolder(currentId);

      if (isLast) {
        // Try exact file match (with .md)
        const mdFile = children.find(f => !f.isFolder && f.name === segment + '.md');
        if (mdFile) {
          const result = { id: mdFile.id, type: 'file', name: mdFile.name, parentId: currentId };
          CacheService.set(cacheKey, result);
          return result;
        }

        // Try exact name match (file without .md or folder)
        const exact = children.find(f => f.name === segment);
        if (exact) {
          if (exact.isFolder) {
            const result = { id: exact.id, type: 'folder', name: segment, parentId: currentId, path };
            CacheService.set(cacheKey, result);
            return result;
          }
          const result = { id: exact.id, type: 'file', name: exact.name, parentId: currentId };
          CacheService.set(cacheKey, result);
          return result;
        }

        // Not found
        return { type: 'not_found', parentId: currentId, name: segment, path };
      }

      // Navigate into folder
      const folder = children.find(f => f.isFolder && f.name === segment);
      if (!folder) {
        return { type: 'not_found', parentId: currentId, name: segments.slice(i).join('/'), path };
      }
      currentId = folder.id;
    }
  },

  _buildMultipart(metadata, contentType, content) {
    const boundary = 'wiki_boundary_' + Date.now();
    const body = [
      '--' + boundary,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      '--' + boundary,
      'Content-Type: ' + contentType,
      '',
      content,
      '--' + boundary + '--',
    ].join('\r\n');
    return { boundary, body };
  },

  async _multipartPost(metadata, contentType, content) {
    const { boundary, body } = this._buildMultipart(metadata, contentType, content);
    const res = await this._fetch(`${CONFIG.DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return await res.json();
  },

  async createFile(name, parentId, content) {
    const data = await this._multipartPost(
      { name, parents: [parentId] },
      'text/markdown',
      content
    );
    CacheService.remove('listing:' + parentId);
    return data;
  },

  async updateFile(fileId, content, metadata = null) {
    let url = `${CONFIG.DRIVE_UPLOAD_API}/files/${fileId}`;
    let options = {
      method: 'PATCH',
    };

    if (metadata) {
      // Multipart upload for metadata + content
      url += '?uploadType=multipart';
      const boundary = 'update_boundary_' + Date.now();
      options.headers = { 'Content-Type': `multipart/related; boundary=${boundary}` };
      options.body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: text/markdown',
        '',
        content,
        `--${boundary}--`,
      ].join('\r\n');
    } else {
      // Media-only upload
      url += '?uploadType=media';
      options.headers = { 'Content-Type': 'text/markdown' };
      options.body = content;
    }

    const res = await this._fetch(url, options);

    // Invalidate content cache
    CacheService.remove('content:' + fileId);

    return await res.json();
  },

  async createFolderPath(path) {
    const segments = path.split('/').filter(Boolean);
    let currentId = await this.getRootFolderId();

    for (const segment of segments) {
      const children = await this.listFolder(currentId);
      const existing = children.find(f => f.isFolder && f.name === segment);
      if (existing) {
        currentId = existing.id;
      } else {
        currentId = await this._createFolder(segment, currentId);
        CacheService.remove('listing:' + currentId);
      }
    }

    return currentId;
  },

  async uploadBinary(name, parentId, blob, mimeType) {
    const boundary = 'wiki_boundary_' + Date.now();
    const metaJson = JSON.stringify({ name, parents: [parentId] });
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;

    const metaBytes = new TextEncoder().encode(metaPart + filePart);
    const closeBytes = new TextEncoder().encode(closing);
    const blobBytes = new Uint8Array(await blob.arrayBuffer());

    const body = new Uint8Array(metaBytes.length + blobBytes.length + closeBytes.length);
    body.set(metaBytes, 0);
    body.set(blobBytes, metaBytes.length);
    body.set(closeBytes, metaBytes.length + blobBytes.length);

    const res = await this._fetch(`${CONFIG.DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const data = await res.json();
    CacheService.remove('listing:' + parentId);
    return data;
  },

  async deleteFile(fileId, parentId) {
    await this._fetch(`${CONFIG.DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
    });
    if (parentId) CacheService.remove('listing:' + parentId);
  },

  async renameFile(fileId, newName, parentId) {
    const res = await this._fetch(`${CONFIG.DRIVE_API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (parentId) CacheService.remove('listing:' + parentId);
    return await res.json();
  },

  getDownloadUrl(fileId) {
    return `${CONFIG.DRIVE_API}/files/${fileId}?alt=media`;
  },

  getAuthHeaders() {
    const token = AuthService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async getSpecialFolderId(folderName) {
    const rootId = await this.getRootFolderId();
    const children = await this.listFolder(rootId);
    const existing = children.find(f => f.isFolder && f.name === folderName);
    if (existing) return existing.id;
    const id = await this._createFolder(folderName, rootId);
    CacheService.remove('listing:' + rootId);
    return id;
  },

  getAssetsFolderId()   { return this.getSpecialFolderId('_assets'); },
  getDrawingsFolderId() { return this.getSpecialFolderId('_drawings'); },
  getSnippetsFolderId() { return this.getSpecialFolderId('_snippets'); },

  async listSnippets(folderId) {
    const q = `'${folderId}' in parents and trashed=false`;
    const fields = 'files(id,name,mimeType,modifiedTime,appProperties,createdTime)';
    const res = await this._fetch(
      `${CONFIG.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=createdTime desc`
    );
    const data = await res.json();
    return (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
      createdTime: f.createdTime,
      type: f.appProperties?.type || 'markdown',
      expiryTs: f.appProperties?.expiryTs ? parseInt(f.appProperties.expiryTs) : null,
      duration: f.appProperties?.duration ? parseInt(f.appProperties.duration) : 0,
    }));
  },

  async createSnippet(name, content, type, expiryTs, duration) {
    const folderId = await this.getSnippetsFolderId();
    return await this._multipartPost(
      {
        name: name || 'Untitled Snippet',
        parents: [folderId],
        appProperties: {
          type: type || 'markdown',
          expiryTs: expiryTs ? expiryTs.toString() : '0',
          duration: duration ? duration.toString() : '0',
        },
      },
      'text/plain',
      content
    );
  },

  async createDrawing(name, content, folderId) {
    const data = await this._multipartPost(
      { name: (name || 'Untitled') + '.excalidraw', parents: [folderId], mimeType: 'application/json' },
      'application/json',
      content
    );
    CacheService.remove('listing:' + folderId);
    return data;
  },

  async updateSnippet(fileId, name, content, type, expiryTs, duration) {
    const metadata = {
      name,
      appProperties: {
        type,
        expiryTs: expiryTs ? expiryTs.toString() : '0',
        duration: duration ? duration.toString() : '0',
      }
    };

    // Update metadata
    await this._fetch(`${CONFIG.DRIVE_API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });

    // Update content
    await this._fetch(`${CONFIG.DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });

    CacheService.remove('content:' + fileId);
  },

  async getFileMetadata(fileId) {
    const res = await this._fetch(
      `${CONFIG.DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,appProperties,createdTime`
    );
    return await res.json();
  },

  async ensureHomePage(folderId) {
    const children = await this.listFolder(folderId);
    const homeFile = children.find(f => !f.isFolder && f.name === 'home.md');
    if (!homeFile) {
      await this.createFile('home.md', folderId, this._welcomeContent());
    }
  },

  _welcomeContent() {
    return `# Welcome to your Wiki

This is your personal wiki stored in Google Drive.

## Getting Started

- Create new pages using the **New Page** button
- Organize content with folders
- Use **Markdown** for formatting
- Link between pages using relative paths

## Features

- Full Markdown support with syntax highlighting
- Mermaid diagram support
- WYSIWYG and raw markdown editing
- Automatic sync with Google Drive

\`\`\`mermaid
graph LR
    A[Write] --> B[Save]
    B --> C[Google Drive]
    C --> D[Read]
    D --> A
\`\`\`

Happy writing!
`;
  },
};
