// Renderer registry — maps docType + mode to component name
const RendererService = {
  _renderers: {
    markdown: { view: 'markdown-viewer',  edit: 'markdown-editor' },
    snippet:  { view: 'snippet-viewer',   edit: 'snippet-editor' },
    drawing:  { view: 'drawing-viewer',   edit: 'drawing-editor' },
    asset:    { view: 'asset-viewer',     edit: null },
    folder:   { view: 'folder-viewer',    edit: null },
  },

  getRenderer(docType, mode) {
    const entry = this._renderers[docType];
    if (!entry) return null;
    return mode === 'edit' ? entry.edit : entry.view;
  },

  canEdit(docType) {
    const entry = this._renderers[docType];
    return !!(entry && entry.edit);
  },
};
