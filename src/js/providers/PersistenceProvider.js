// Base class for storage providers
// All methods throw by default — providers must override what they support.
class PersistenceProvider {
  async initialize() { throw new Error('Not implemented: initialize'); }
  async getRootFolderId() { throw new Error('Not implemented: getRootFolderId'); }
  async listFolder(folderId) { throw new Error('Not implemented: listFolder'); }
  async resolvePath(path) { throw new Error('Not implemented: resolvePath'); }
  async createFolderPath(path) { throw new Error('Not implemented: createFolderPath'); }
  async getFileContent(fileId) { throw new Error('Not implemented: getFileContent'); }
  async getFileMetadata(fileId) { throw new Error('Not implemented: getFileMetadata'); }
  async createFile(name, parentId, content, options = {}) { throw new Error('Not implemented: createFile'); }
  async updateFile(fileId, content, metadata = null) { throw new Error('Not implemented: updateFile'); }
  async uploadBinary(name, parentId, blob, mimeType) { throw new Error('Not implemented: uploadBinary'); }
  async deleteFile(fileId, parentId) { throw new Error('Not implemented: deleteFile'); }
  async renameFile(fileId, newName, parentId) { throw new Error('Not implemented: renameFile'); }
  async createFolder(name, parentId) { throw new Error('Not implemented: createFolder'); }
  async getSpecialFolderId(folderName) { throw new Error('Not implemented: getSpecialFolderId'); }
  async getAssetsFolderId() { throw new Error('Not implemented: getAssetsFolderId'); }
  async getDrawingsFolderId() { throw new Error('Not implemented: getDrawingsFolderId'); }
  async getSnippetsFolderId() { throw new Error('Not implemented: getSnippetsFolderId'); }
  async listSnippets(folderId) { throw new Error('Not implemented: listSnippets'); }
  async createSnippet(name, content, type, expiryTs, duration) { throw new Error('Not implemented: createSnippet'); }
  async updateSnippet(fileId, name, content, type, expiryTs, duration) { throw new Error('Not implemented: updateSnippet'); }
  getDownloadUrl(fileId) { throw new Error('Not implemented: getDownloadUrl'); }
  getAuthHeaders() { throw new Error('Not implemented: getAuthHeaders'); }
  async ensureHomePage(folderId) { throw new Error('Not implemented: ensureHomePage'); }
  // Filter expired snippets from a listing and delete them in the background.
  // Default: returns items unchanged (no expiry concept on the backend).
  purgeExpiredSnippets(items, parentId) { return items; }
}
