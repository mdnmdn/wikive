// StorageService facade — delegates to the active PersistenceProvider
const StorageService = {
  _provider: null,

  setProvider(provider) {
    this._provider = provider;
  },

  getProvider() {
    if (!this._provider) throw new Error('No storage provider configured');
    return this._provider;
  },
};

// Dynamically delegate all PersistenceProvider methods
[
  'initialize', 'getRootFolderId', 'listFolder', 'resolvePath',
  'createFolderPath', 'getFileContent', 'getFileMetadata',
  'createFile', 'updateFile', 'uploadBinary', 'deleteFile',
  'renameFile', 'createFolder', 'getSpecialFolderId',
  'getAssetsFolderId', 'getDrawingsFolderId', 'getSnippetsFolderId',
  'listSnippets', 'createSnippet', 'updateSnippet', 'createDrawing',
  'getDownloadUrl', 'getAuthHeaders', 'ensureHomePage', 'purgeExpiredSnippets',
  'moveFile', 'copyFile',
].forEach(method => {
  StorageService[method] = function (...args) {
    return this.getProvider()[method](...args);
  };
});

// Bootstrap storage provider from config
(function bootstrapStorage() {
  if (!window.CONFIG) return;
  const provider = CONFIG.PROVIDER || 'google-drive';
  if (provider === 'google-drive') {
    StorageService.setProvider(new GoogleDriveProvider(AuthManager, CONFIG));
  }
})();
