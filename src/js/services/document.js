// Document model & type detection service
const SPECIAL_FOLDERS = {
  ASSETS: '_assets',
  SNIPPETS: '_snippets',
  DRAWINGS: '_drawings',
};

const DocumentService = {
  resolveDocumentType(file, parentPath) {
    if (file.mimeType === 'application/vnd.google-apps.folder' || file.isFolder) return 'folder';
    const pp = (parentPath || '').split('/')[0];
    if (pp === SPECIAL_FOLDERS.SNIPPETS) return 'snippet';
    if (file.name && file.name.endsWith('.excalidraw')) return 'drawing';
    if (pp === SPECIAL_FOLDERS.ASSETS) return 'asset';
    if (file.appProperties?.docType === 'snippet') return 'snippet';
    if (file.name && file.name.endsWith('.md')) return 'markdown';
    return 'asset';
  },

  toDocument(driveFile, parentId, path) {
    const docType = this.resolveDocumentType(driveFile, path);
    return {
      id: driveFile.id,
      name: driveFile.name,
      type: driveFile.isFolder || driveFile.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      docType,
      parentId,
      path: path || '',
      meta: {
        syntaxType: driveFile.appProperties?.type || null,
        expiryTs: driveFile.appProperties?.expiryTs ? parseInt(driveFile.appProperties.expiryTs) : null,
        duration: driveFile.appProperties?.duration ? parseInt(driveFile.appProperties.duration) : 0,
        mimeType: driveFile.mimeType || null,
        size: driveFile.size || null,
        modifiedTime: driveFile.modifiedTime || null,
        createdTime: driveFile.createdTime || null,
      },
    };
  },

  getSpecialFolder(path) {
    const first = (path || '').split('/')[0];
    if (first === SPECIAL_FOLDERS.ASSETS) return 'assets';
    if (first === SPECIAL_FOLDERS.SNIPPETS) return 'snippets';
    if (first === SPECIAL_FOLDERS.DRAWINGS) return 'drawings';
    return null;
  },
};
