// Main Vue application — Unified Document Architecture
const app = Vue.createApp({
  template: `
    <login-screen v-if="!authenticated"></login-screen>
    <template v-else>
      <app-header
        :current-path="currentPath"
        :mode="mode"
        :user="user"
        :document="document"
        :dark-mode="darkMode"
        @edit="startEdit"
        @save="save"
        @cancel="cancelEdit"
        @new-page="showNewPageDialog"
        @new-snippet="createNewSnippet"
        @new-drawing="createNewDrawing"
        @delete-page="deleteDocument"
        @toggle-dark="toggleDarkMode"
        @refresh-page="refreshPage"
      ></app-header>
      <div class="app-body">
        <sidebar
          :root-id="rootId"
          :current-path="currentPath"
          :expand-path="pendingExpandPath"
          :is-collapsed="sidebarCollapsed"
          @refresh="refreshSidebar"
          @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
          @toast="showToast"
          @assets-uploaded="onAssetsUploaded"
          ref="sidebar"
        ></sidebar>
        <main class="main-content" :class="mainContentClass">
          <!-- Not found -->
          <template v-if="notFound">
            <page-not-found :path="currentPath" @create="createPage"></page-not-found>
          </template>
          <!-- Unified document renderer -->
          <template v-else-if="document">
            <document-renderer
              ref="renderer"
              :document="document"
              :content="fileContent"
              :mode="mode"
              :dark-mode="darkMode"
              @save="onRendererSave"
              @delete="deleteDocument"
              @toast="showToast"
              @mode-change="onModeChange"
              @navigate="onNavigate"
              @create-snippet="createNewSnippet"
              @create-drawing="createNewDrawing"
            ></document-renderer>
          </template>
          <!-- Loading -->
          <template v-else-if="loading">
            <div class="flex items-center justify-center py-12"><div class="spinner"></div></div>
          </template>
        </main>
      </div>
      <!-- Toast -->
      <div v-if="toast" class="toast" :class="toast.type" @click="toast = null">{{ toast.message }}</div>
      <!-- New page dialog -->
      <div v-if="showNewPage" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="!creatingPage && (showNewPage = false)">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">Create New Page</h3>
          <input
            v-model="newPagePath"
            @keyup.enter="!creatingPage && createPage(newPagePath)"
            :disabled="creatingPage"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            style="border-color: hsl(var(--border)); color: hsl(var(--foreground)); background-color: hsl(var(--background))"
            placeholder="path/to/page-name"
            ref="newPageInput"
          />
          <p class="text-xs mt-2" style="color: hsl(var(--muted-foreground))">Use / to create in subfolders. Folders are created automatically.</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showNewPage = false" :disabled="creatingPage" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80 disabled:opacity-50" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="createPage(newPagePath)" :disabled="creatingPage" class="px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">
              <template v-if="creatingPage">
                <div class="spinner" style="border-color: hsl(var(--primary-foreground) / 0.3); border-top-color: hsl(var(--primary-foreground)); width: 1rem; height: 1rem; border-width: 1px"></div>
                <span>Creating…</span>
              </template>
              <template v-else><span>Create</span></template>
            </button>
          </div>
        </div>
      </div>
      <!-- Confirm dialog (replaces native confirm()) -->
      <div v-if="confirmDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="confirmDialog.reject()">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-2">{{ confirmDialog.title }}</h3>
          <p v-if="confirmDialog.message" class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">{{ confirmDialog.message }}</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="confirmDialog.reject()" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="confirmDialog.resolve()" class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">{{ confirmDialog.confirmLabel || 'Confirm' }}</button>
          </div>
        </div>
      </div>
    </template>
  `,
  data() {
    return {
      authenticated: false,
      user: null,
      rootId: null,
      currentPath: '',
      document: null,
      fileContent: '',
      mode: 'view',
      loading: false,
      notFound: false,
      toast: null,
      showNewPage: false,
      newPagePath: '',
      creatingPage: false,
      sidebarCollapsed: false,
      darkMode: false,
      pendingExpandPath: null,
      pendingEditPath: null,
      pendingNewSnippet: false,
      pendingNewDrawing: false,
      confirmDialog: null,
    };
  },
  computed: {
    mainContentClass() {
      const dt = this.document?.docType;
      return {
        'snippets-full': dt === 'snippet',
        'drawings-full': dt === 'drawing',
      };
    },
  },
  async mounted() {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    this.darkMode = savedDarkMode;
    this.applyDarkMode(savedDarkMode);

    AuthService.init((loggedIn) => {
      this.authenticated = loggedIn;
      this.user = AuthService.user;
      if (loggedIn) this.initApp();
    });

    window.addEventListener('hashchange', () => this.onRouteChange());
    window.addEventListener('keydown', this._onKeyDown = (e) => this.handleKeyDown(e));
    window.addEventListener('beforeunload', this._onBeforeUnload = (e) => {
      if (this.mode === 'edit' && this.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    }
  },
  unmounted() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('beforeunload', this._onBeforeUnload);
  },
  methods: {
    async initApp() {
      try {
        this.rootId = await DriveService.getRootFolderId();
        this.onRouteChange();
      } catch (e) {
        this.showToast('Failed to initialize: ' + e.message, 'error');
      }
    },

    async onRouteChange() {
      if (!this.authenticated) return;
      this.mode = 'view';
      this.notFound = false;
      this.document = null;
      this.fileContent = '';

      const hash = window.location.hash.slice(1) || '/';
      this.currentPath = hash.startsWith('/') ? hash.slice(1) : hash;

      this.loading = true;

      try {
        const specialFolder = DocumentService.getSpecialFolder(this.currentPath);

        if (specialFolder) {
          await this.resolveSpecialRoute(specialFolder);
        } else {
          await this.resolveWikiRoute();
        }

        // Auto-edit if pending
        if (this.pendingEditPath && this.currentPath === this.pendingEditPath && this.document?.type === 'file') {
          this.mode = 'edit';
          this.pendingEditPath = null;
        }

        // Open blank new snippet in edit mode
        if (this.pendingNewSnippet && this.currentPath === '_snippets') {
          this.pendingNewSnippet = false;
          const doc = DocumentService.toDocument(
            { id: null, name: '', isFolder: false }, null, '_snippets'
          );
          doc.docType = 'snippet';
          doc.type = 'file';
          this.document = doc;
          this.fileContent = '';
          this.mode = 'edit';
        }

        // Open blank new drawing in edit mode
        if (this.pendingNewDrawing && this.currentPath === '_drawings') {
          this.pendingNewDrawing = false;
          const folderId = await DriveService.getDrawingsFolderId();
          const doc = DocumentService.toDocument(
            { id: null, name: '', isFolder: false }, folderId, '_drawings'
          );
          doc.docType = 'drawing';
          doc.type = 'file';
          this.document = doc;
          this.fileContent = JSON.stringify({
            type: 'excalidraw', version: 2, source: 'google-wiki',
            elements: [], appState: { theme: this.darkMode ? 'dark' : 'light' }, files: {},
          });
          this.mode = 'edit';
        }
      } catch (e) {
        this.showToast('Error loading: ' + e.message, 'error');
      }

      this.loading = false;
    },

    async resolveSpecialRoute(specialFolder) {
      const segments = this.currentPath.split('/');
      const folderName = segments[0]; // _assets, _snippets, _drawings
      const itemId = segments[1] || null;

      // Get the special folder ID
      let folderId;
      if (specialFolder === 'assets') folderId = await DriveService.getAssetsFolderId();
      else if (specialFolder === 'snippets') folderId = await DriveService.getSnippetsFolderId();
      else if (specialFolder === 'drawings') folderId = await DriveService.getDrawingsFolderId();

      if (!itemId) {
        // Root of special folder — show as folder
        this.document = DocumentService.toDocument(
          { id: folderId, name: folderName, isFolder: true, mimeType: 'application/vnd.google-apps.folder' },
          this.rootId,
          this.currentPath
        );
        // For assets, the AssetViewer handles listing internally
        if (specialFolder === 'assets') {
          this.document.docType = 'asset';
        } else if (specialFolder === 'snippets') {
          // Show snippet list as a folder card grid (same as drawings)
          this.document.docType = 'folder';
        } else if (specialFolder === 'drawings') {
          // Show drawing list — render as folder with drawing items
          this.document.docType = 'folder';
        }
        return;
      }

      // Specific item selected
      if (specialFolder === 'snippets') {
        const meta = await DriveService.getFileMetadata(itemId);
        this.document = DocumentService.toDocument(meta, folderId, this.currentPath);
        this.fileContent = await DriveService.getFileContent(itemId);
      } else if (specialFolder === 'drawings') {
        const meta = await DriveService.getFileMetadata(itemId);
        this.document = DocumentService.toDocument(meta, folderId, this.currentPath);
        this.fileContent = await DriveService.getFileContent(itemId);
      } else {
        // Asset subfolder navigation is handled by the AssetViewer
        this.document = DocumentService.toDocument(
          { id: folderId, name: folderName, isFolder: true, mimeType: 'application/vnd.google-apps.folder' },
          this.rootId,
          this.currentPath
        );
        this.document.docType = 'asset';
      }
    },

    async resolveWikiRoute() {
      const resolved = await DriveService.resolvePath(this.currentPath);

      if (!resolved || resolved.type === 'not_found') {
        if (resolved?.name === 'home') {
          this.currentPath = 'home';
        }
        this.notFound = true;
        return;
      }

      if (resolved.type === 'file') {
        this.fileContent = await DriveService.getFileContent(resolved.id);
        this.document = DocumentService.toDocument(
          { id: resolved.id, name: resolved.name, isFolder: false },
          resolved.parentId,
          this.currentPath
        );
      } else if (resolved.type === 'folder') {
        this.document = DocumentService.toDocument(
          { id: resolved.id, name: resolved.name, isFolder: true, mimeType: 'application/vnd.google-apps.folder' },
          resolved.parentId,
          this.currentPath
        );
      }
    },

    startEdit() {
      this.mode = 'edit';
    },

    async save() {
      const renderer = this.$refs.renderer;
      if (!renderer) return;
      const content = renderer.getContent();
      try {
        if (this.document && this.document.type === 'file') {
          await DriveService.updateFile(this.document.id, content);
          this.showToast('Saved', 'success');
        }
        this.fileContent = content;
        this.mode = 'view';
      } catch (e) {
        this.showToast('Failed to save: ' + e.message, 'error');
      }
    },

    onModeChange(newMode) {
      this.mode = newMode;
    },

    onRendererSave(data) {
      // Renderer handled its own save (snippets, drawings)
      this.refreshSidebar();
      this.onRouteChange();
    },

    onNavigate(path) {
      window.location.hash = '#/' + path;
    },

    async createPage(path) {
      if (!path) return;
      this.creatingPage = true;
      try {
        const segments = path.split('/').filter(Boolean);
        const fileName = segments.pop() + '.md';
        let parentId;
        if (segments.length > 0) {
          parentId = await DriveService.createFolderPath(segments.join('/'));
        } else {
          parentId = await DriveService.getRootFolderId();
        }
        const initialContent = '# ' + fileName.replace(/\.md$/, '') + '\n\nStart writing here...\n';
        await DriveService.createFile(fileName, parentId, initialContent);
        this.showToast('Page created', 'success');
        this.showNewPage = false;
        this.newPagePath = '';
        this.pendingEditPath = path;
        window.location.hash = '#/' + path;
        this.refreshSidebar(path);
      } catch (e) {
        this.showToast('Failed to create page: ' + e.message, 'error');
      } finally {
        this.creatingPage = false;
      }
    },

    showNewPageDialog() {
      const isSpecial = DocumentService.getSpecialFolder(this.currentPath);
      this.newPagePath = (!isSpecial && this.currentPath) ? this.currentPath + '/' : '';
      this.showNewPage = true;
      this.$nextTick(() => { this.$refs.newPageInput?.focus(); });
    },

    createNewSnippet() {
      // Navigate to the snippets folder; route resolution will land on the folder view
      // where the user can create a new snippet from there
      if (this.currentPath.startsWith('_snippets') && !this.currentPath.includes('/')) {
        // Already on the snippets folder — open a blank snippet in edit mode directly
        this.pendingNewSnippet = true;
        this.onRouteChange();
      } else {
        this.pendingNewSnippet = true;
        window.location.hash = '#/_snippets';
      }
    },

    createNewDrawing() {
      if (this.currentPath === '_drawings') {
        this.pendingNewDrawing = true;
        this.onRouteChange();
      } else {
        this.pendingNewDrawing = true;
        window.location.hash = '#/_drawings';
      }
    },

    showConfirm(title, message, confirmLabel) {
      return new Promise((resolve, reject) => {
        this.confirmDialog = {
          title,
          message,
          confirmLabel,
          resolve: () => { this.confirmDialog = null; resolve(); },
          reject:  () => { this.confirmDialog = null; reject(); },
        };
      });
    },

    async deleteDocument() {
      if (!this.document || !this.document.id) return;
      try {
        await this.showConfirm(
          'Delete "' + (this.document.name || 'this document') + '"?',
          'This will move the file to trash in Google Drive.',
          'Delete'
        );
      } catch { return; } // user cancelled
      try {
        await DriveService.deleteFile(this.document.id, this.document.parentId);
        CacheService.remove('content:' + this.document.id);
        CacheService.remove('path:' + this.currentPath);
        this.showToast('Deleted', 'success');
        const parentPath = this.currentPath.split('/').slice(0, -1).join('/');
        window.location.hash = '#/' + (parentPath || '');
        this.refreshSidebar();
      } catch (e) {
        this.showToast('Failed to delete: ' + e.message, 'error');
      }
    },

    refreshSidebar(expandPath = null) {
      this.pendingExpandPath = expandPath;
      const id = this.rootId;
      this.rootId = null;
      this.$nextTick(() => { this.rootId = id; });
    },

    refreshPage() {
      if (this.document && this.document.id) {
        CacheService.remove('content:' + this.document.id);
        CacheService.remove('path:' + this.currentPath);
      }
      this.onRouteChange();
    },

    onAssetsUploaded() {
      // If viewing assets, refresh
      if (this.document?.docType === 'asset') {
        this.onRouteChange();
      }
    },

    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      this.applyDarkMode(this.darkMode);
      localStorage.setItem('darkMode', this.darkMode.toString());
    },

    applyDarkMode(isDark) {
      if (isDark) {
        document.documentElement.classList.add('dark');
        const hljsTheme = document.getElementById('hljs-theme');
        if (hljsTheme) hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
        if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      } else {
        document.documentElement.classList.remove('dark');
        const hljsTheme = document.getElementById('hljs-theme');
        if (hljsTheme) hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      }
    },

    isDirty() {
      const renderer = this.$refs.renderer;
      if (!renderer) return false;
      const current = renderer.getContent?.();
      return current !== undefined && current !== this.fileContent;
    },

    handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (this.confirmDialog) { this.confirmDialog.reject(); return; }
        if (this.showNewPage) { if (!this.creatingPage) this.showNewPage = false; return; }
        if (this.mode === 'edit') { this.cancelEdit(); return; }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'e' && this.mode === 'view' && this.document?.type === 'file' && RendererService.canEdit(this.document.docType)) {
        e.preventDefault(); this.startEdit();
      } else if (e.key === 's' && this.mode === 'edit') {
        e.preventDefault(); this.save();
      } else if (e.key === 'n' && this.mode !== 'edit') {
        e.preventDefault(); this.showNewPageDialog();
      }
    },

    async cancelEdit() {
      if (this.isDirty()) {
        try {
          await this.showConfirm('Discard unsaved changes?', '', 'Discard');
        } catch { return; }
      }
      this.mode = 'view';
    },

    showToast(message, type = 'info') {
      this.toast = { message, type };
      setTimeout(() => { this.toast = null; }, 3000);
    },
  },
});

// Register components
app.component('login-screen', LoginScreen);
app.component('app-header', AppHeader);
app.component('breadcrumb', Breadcrumb);
app.component('sidebar', Sidebar);
app.component('sidebar-tree', SidebarTree);
app.component('page-not-found', PageNotFound);
app.component('document-renderer', DocumentRenderer);
app.component('markdown-viewer', MarkdownViewer);
app.component('markdown-editor', MarkdownEditor);
app.component('snippet-viewer', SnippetViewer);
app.component('snippet-editor', SnippetEditor);
app.component('drawing-viewer', DrawingViewer);
app.component('drawing-editor', DrawingEditor);
app.component('asset-viewer', AssetViewer);
app.component('folder-viewer', FolderViewer);

// Mount
app.mount('#app');
