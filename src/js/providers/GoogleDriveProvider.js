// Google Drive implementation of PersistenceProvider
class GoogleDriveProvider extends PersistenceProvider {
  constructor(authManager, config) {
    super();
    this._authManager = authManager;
    this._config = config;
    this._rootId = null;
    this._wikiDefsFileId = null;
  }

  async _fetch(url, options = {}) {
    const token = this._authManager.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      this._authManager.login();
      throw new Error('Token expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Drive API error: ${res.status}`);
    }

    return res;
  }

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
  }

  async _multipartPost(metadata, contentType, content) {
    const { boundary, body } = this._buildMultipart(metadata, contentType, content);
    const res = await this._fetch(`${this._config.DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return await res.json();
  }

  async getRootFolderId() {
    if (this._rootId) return this._rootId;

    const cached = CacheService.getValue('root_id');
    if (cached) {
      this._rootId = cached;
      return cached;
    }

    const pathSegments = this._config.ROOT_FOLDER_NAME.split('/').filter(Boolean);
    let currentParentId = 'root';

    for (let i = 0; i < pathSegments.length; i++) {
      const folderName = pathSegments[i];
      const isLast = i === pathSegments.length - 1;

      const q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`;
      const res = await this._fetch(
        `${this._config.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
      );
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        currentParentId = data.files[0].id;
      } else {
        const parentIdToCreate = currentParentId === 'root' ? null : currentParentId;
        currentParentId = await this.createFolder(folderName, parentIdToCreate);
      }

      if (isLast) {
        await this.ensureHomePage(currentParentId);
      }
    }

    this._rootId = currentParentId;
    CacheService.set('root_id', this._rootId);
    return this._rootId;
  }

  async createFolder(name, parentId) {
    const metadata = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) metadata.parents = [parentId];
    const res = await this._fetch(`${this._config.DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    return data.id;
  }

  async listFolder(folderId) {
    const cacheKey = 'listing:' + folderId;
    const cached = CacheService.getValue(cacheKey);

    const fetchFresh = async () => {
      const q = `'${folderId}' in parents and trashed=false`;
      const fields = 'files(id,name,mimeType,modifiedTime,appProperties)';
      const res = await this._fetch(
        `${this._config.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=name`
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
      files.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      CacheService.set(cacheKey, files);
      return files;
    };

    if (cached && CacheService.isFresh(cacheKey)) { fetchFresh().catch(() => {}); return cached; }
    if (cached) { fetchFresh().catch(() => {}); return cached; }
    return await fetchFresh();
  }

  async getFileContent(fileId) {
    const cacheKey = 'content:' + fileId;
    const cached = CacheService.getValue(cacheKey);

    const fetchFresh = async () => {
      const res = await this._fetch(`${this._config.DRIVE_API}/files/${fileId}?alt=media`);
      const content = await res.text();
      CacheService.set(cacheKey, content);
      return content;
    };

    if (cached && CacheService.isFresh(cacheKey)) { fetchFresh().catch(() => {}); return cached; }
    if (cached) { fetchFresh().catch(() => {}); return cached; }
    return await fetchFresh();
  }

  async resolvePath(path) {
    if (!path || path === '/' || path === '') {
      const rootId = await this.getRootFolderId();
      const children = await this.listFolder(rootId);
      const homeFile = children.find(f => !f.isFolder && f.name === 'home.md');
      if (homeFile) return { id: homeFile.id, type: 'file', name: homeFile.name, parentId: rootId };
      return { type: 'not_found', parentId: rootId, name: 'home', path: 'home' };
    }

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
        const mdFile = children.find(f => !f.isFolder && f.name === segment + '.md');
        if (mdFile) {
          const result = { id: mdFile.id, type: 'file', name: mdFile.name, parentId: currentId };
          CacheService.set(cacheKey, result);
          return result;
        }
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
        return { type: 'not_found', parentId: currentId, name: segment, path };
      }

      const folder = children.find(f => f.isFolder && f.name === segment);
      if (!folder) return { type: 'not_found', parentId: currentId, name: segments.slice(i).join('/'), path };
      currentId = folder.id;
    }
  }

  async createFile(name, parentId, content, options = {}) {
    const mimeType = options.mimeType || 'text/markdown';
    const metadata = { name, parents: [parentId] };
    if (options.appProperties) metadata.appProperties = options.appProperties;
    const data = await this._multipartPost(metadata, mimeType, content);
    CacheService.remove('listing:' + parentId);
    return data;
  }

  async updateFile(fileId, content, metadata = null) {
    let url = `${this._config.DRIVE_UPLOAD_API}/files/${fileId}`;
    let options = { method: 'PATCH' };

    if (metadata) {
      url += '?uploadType=multipart';
      const { boundary, body } = this._buildMultipart(metadata, 'text/markdown', content);
      options.headers = { 'Content-Type': `multipart/related; boundary=${boundary}` };
      options.body = body;
    } else {
      url += '?uploadType=media';
      options.headers = { 'Content-Type': 'text/markdown' };
      options.body = content;
    }

    const res = await this._fetch(url, options);
    CacheService.remove('content:' + fileId);
    return await res.json();
  }

  async createFolderPath(path) {
    const segments = path.split('/').filter(Boolean);
    let currentId = await this.getRootFolderId();
    for (const segment of segments) {
      const children = await this.listFolder(currentId);
      const existing = children.find(f => f.isFolder && f.name === segment);
      if (existing) {
        currentId = existing.id;
      } else {
        currentId = await this.createFolder(segment, currentId);
        CacheService.remove('listing:' + currentId);
      }
    }
    return currentId;
  }

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
    const res = await this._fetch(`${this._config.DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const data = await res.json();
    CacheService.remove('listing:' + parentId);
    return data;
  }

  async deleteFile(fileId, parentId) {
    await this._fetch(`${this._config.DRIVE_API}/files/${fileId}`, { method: 'DELETE' });
    if (parentId) CacheService.remove('listing:' + parentId);
  }

  async renameFile(fileId, newName, parentId) {
    const res = await this._fetch(`${this._config.DRIVE_API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (parentId) CacheService.remove('listing:' + parentId);
    return await res.json();
  }

  getDownloadUrl(fileId) {
    return `${this._config.DRIVE_API}/files/${fileId}?alt=media`;
  }

  getAuthHeaders() {
    const token = this._authManager.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getSpecialFolderId(folderName) {
    const rootId = await this.getRootFolderId();
    const children = await this.listFolder(rootId);
    const existing = children.find(f => f.isFolder && f.name === folderName);
    if (existing) return existing.id;
    const id = await this.createFolder(folderName, rootId);
    CacheService.remove('listing:' + rootId);
    return id;
  }

  getAssetsFolderId()   { return this.getSpecialFolderId('_assets'); }
  getDrawingsFolderId() { return this.getSpecialFolderId('_drawings'); }
  getSnippetsFolderId() { return this.getSpecialFolderId('_snippets'); }

  async listSnippets(folderId) {
    const q = `'${folderId}' in parents and trashed=false`;
    const fields = 'files(id,name,mimeType,modifiedTime,appProperties,createdTime)';
    const res = await this._fetch(
      `${this._config.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=createdTime desc`
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
  }

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
  }

  async createDrawing(name, content, folderId) {
    const data = await this._multipartPost(
      { name: (name || 'Untitled') + '.excalidraw', parents: [folderId], mimeType: 'application/json' },
      'application/json',
      content
    );
    CacheService.remove('listing:' + folderId);
    return data;
  }

  async updateSnippet(fileId, name, content, type, expiryTs, duration) {
    const metadata = {
      name,
      appProperties: {
        type,
        expiryTs: expiryTs ? expiryTs.toString() : '0',
        duration: duration ? duration.toString() : '0',
      }
    };
    await this._fetch(`${this._config.DRIVE_API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    await this._fetch(`${this._config.DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });
    CacheService.remove('content:' + fileId);
  }

  purgeExpiredSnippets(items, parentId) {
    const now = Date.now();
    const expired = items.filter(item => {
      if (item.isFolder) return false;
      const ts = item.appProperties?.expiryTs ? parseInt(item.appProperties.expiryTs) : 0;
      return ts > 0 && ts < now;
    });
    if (expired.length > 0) {
      Promise.all(expired.map(item => this.deleteFile(item.id, parentId).catch(() => {}))).catch(() => {});
    }
    return expired.length > 0 ? items.filter(i => !expired.includes(i)) : items;
  }

  async moveFile(fileId, newName, oldParentId, newParentId) {
    let url = `${this._config.DRIVE_API}/files/${fileId}`;
    const params = [];
    if (newParentId !== oldParentId) {
      params.push(`addParents=${newParentId}`);
      if (oldParentId) params.push(`removeParents=${oldParentId}`);
    }
    if (params.length) url += '?' + params.join('&');
    const res = await this._fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    CacheService.remove('listing:' + oldParentId);
    if (newParentId !== oldParentId) CacheService.remove('listing:' + newParentId);
    CacheService.remove('content:' + fileId);
    return await res.json();
  }

  async copyFile(fileId, name, parentId) {
    const res = await this._fetch(`${this._config.DRIVE_API}/files/${fileId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parents: [parentId] }),
    });
    const data = await res.json();
    CacheService.remove('listing:' + parentId);
    return data;
  }

  async getFileMetadata(fileId) {
    const res = await this._fetch(
      `${this._config.DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,appProperties,createdTime`
    );
    return await res.json();
  }

  async enableAnonymousShare(fileId) {
    const res = await this._fetch(
      `${this._config.DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type,role)`
    );
    const data = await res.json();
    const existing = (data.permissions || []).find(permission =>
      permission.type === 'anyone' && permission.role === 'reader'
    );

    if (!existing) {
      await this._fetch(`${this._config.DRIVE_API}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'anyone',
          role: 'reader',
          allowFileDiscovery: false,
        }),
      });
    }

    const fileRes = await this._fetch(
      `${this._config.DRIVE_API}/files/${fileId}?fields=id,resourceKey`
    );
    const fileData = await fileRes.json();

    return {
      fileId,
      publicUrl: this.getAnonymousShareUrl(fileId),
      resourceKey: fileData.resourceKey || '',
    };
  }

  getAnonymousShareUrl(fileId) {
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
  }

  async ensureHomePage(folderId) {
    const children = await this.listFolder(folderId);
    const homeFile = children.find(f => !f.isFolder && f.name === 'home.md');
    if (!homeFile) {
      await this.createFile('home.md', folderId, this._welcomeContent());
    }
  }

  setRootFolderName(name) {
    if (this._config.ROOT_FOLDER_NAME === name) return;
    this._config = { ...this._config, ROOT_FOLDER_NAME: name };
    this._rootId = null;
    CacheService.remove('root_id');
  }

  async getWikiDefinitions() {
    const q = `name='wiki_definitions.json' and 'root' in parents and trashed=false`;
    const res = await this._fetch(
      `${this._config.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
    );
    const data = await res.json();
    if (!data.files || data.files.length === 0) {
      this._wikiDefsFileId = null;
      return { id: null, wikis: [], aiProviders: [] };
    }
    this._wikiDefsFileId = data.files[0].id;
    const contentRes = await this._fetch(
      `${this._config.DRIVE_API}/files/${this._wikiDefsFileId}?alt=media`
    );
    const text = await contentRes.text();
    try {
      const parsed = JSON.parse(text);
      // Old format: plain array of wiki definitions
      if (Array.isArray(parsed)) {
        return { id: this._wikiDefsFileId, wikis: parsed, aiProviders: [] };
      }
      // New format: { wikis, aiProviders }
      return { id: this._wikiDefsFileId, wikis: parsed.wikis || [], aiProviders: parsed.aiProviders || [] };
    } catch {
      return { id: this._wikiDefsFileId, wikis: [], aiProviders: [] };
    }
  }

  async saveWikiDefinitions({ wikis, aiProviders = [] }) {
    const content = JSON.stringify({ wikis, aiProviders }, null, 2);
    if (this._wikiDefsFileId) {
      await this._fetch(
        `${this._config.DRIVE_UPLOAD_API}/files/${this._wikiDefsFileId}?uploadType=media`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content }
      );
    } else {
      const data = await this._multipartPost(
        { name: 'wiki_definitions.json', parents: ['root'] },
        'application/json',
        content
      );
      this._wikiDefsFileId = data.id;
    }
  }

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
  }
}
