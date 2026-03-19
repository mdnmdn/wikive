// Main Vue application
const app = Vue.createApp({
  template: `
    <login-screen v-if="!authenticated"></login-screen>
    <template v-else>
      <app-header
        :current-path="currentPath"
        :mode="mode"
        :user="user"
        :resolved="resolved"
        :dark-mode="darkMode"
        :is-snippets-route="isSnippetsRoute"
        :snippet-name="selectedSnippetName"
        @edit="startEdit"
        @save="save"
        @cancel="cancelEdit"
        @new-page="showNewPageDialog"
        @new-snippet="createSnippetFromHeader"
        @delete-page="deletePage"
        @toggle-dark="toggleDarkMode"
        @refresh-page="refreshPage"
      ></app-header>
      <div class="app-body">
        <sidebar
          :root-id="rootId"
          :current-path="currentPath"
          :expand-path="pendingExpandPath"
          :snippets-version="snippetListVersion"
          :assets-folder-id="assetsFolderId"
          :is-drawings-route="isDrawingsRoute"
          :drawings-folder-id="drawingsFolderId"
          :selected-drawing-id="selectedDrawingId"
          :is-collapsed="sidebarCollapsed"
          @refresh="refreshSidebar"
          @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
          @toast="showToast"
          @assets-uploaded="refreshAssetsFromSidebar"
          ref="sidebar"
        ></sidebar>
        <main class="main-content" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'snippets-full': isSnippetsRoute, 'wiki-edit-full': mode === 'edit' }" :style="(isAssetsRoute || isSnippetsRoute || isDrawingsRoute || mode === 'edit') ? 'max-width: none' : ''">
          <template v-if="isAssetsRoute">
            <asset-manager
              ref="assetManager"
              :assets-folder-id="assetsFolderId"
              @toast="showToast"
            ></asset-manager>
          </template>
          <template v-else-if="isSnippetsRoute">
            <snippet-manager
              ref="snippetManager"
              :snippets-folder-id="snippetsFolderId"
              :snippet-id="selectedSnippetId"
              @toast="showToast"
              @refresh-snippets="refreshSnippets"
              @snippet-selected="onSnippetSelected"
            ></snippet-manager>
          </template>
          <template v-else-if="isDrawingsRoute">
            <drawing-manager
              ref="drawingManager"
              :drawings-folder-id="drawingsFolderId"
              :drawing-id="selectedDrawingId"
              @toast="showToast"
            ></drawing-manager>
          </template>
          <template v-else-if="mode === 'edit'">
            <page-editor
              ref="editor"
              :content="fileContent"
              :resolved="resolved"
            ></page-editor>
          </template>
          <template v-else-if="resolved && resolved.type === 'not_found'">
            <page-not-found :path="currentPath" @create="createPage"></page-not-found>
          </template>
          <template v-else>
            <page-view :resolved="resolved" :current-path="currentPath"></page-view>
          </template>
        </main>
      </div>
      <!-- Toast notifications -->
      <div v-if="toast" class="toast" :class="toast.type" @click="toast = null">
        {{ toast.message }}
      </div>
      <!-- New page dialog -->
      <div v-if="showNewPage" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="!creatingPage && (showNewPage = false)">
        <div class="bg-background text-foreground rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
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
            <button
              @click="showNewPage = false"
              :disabled="creatingPage"
              class="px-4 py-2 text-sm rounded-lg border hover:opacity-80 disabled:opacity-50"
              style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))"
            >Cancel</button>
            <button
              @click="createPage(newPagePath)"
              :disabled="creatingPage"
              class="px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
              style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))"
            >
              <template v-if="creatingPage">
                <div class="spinner" style="border-color: hsl(var(--primary-foreground) / 0.3); border-top-color: hsl(var(--primary-foreground)); width: 1rem; height: 1rem; border-width: 1px"></div>
                <span>Creating…</span>
              </template>
              <template v-else>
                <span>Create</span>
              </template>
            </button>
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
      resolved: null,
      fileContent: '',
      mode: 'view', // 'view' | 'edit'
      toast: null,
      showNewPage: false,
      newPagePath: '',
      creatingPage: false,
      isAssetsRoute: false,
      assetsFolderId: null,
      isSnippetsRoute: false,
      snippetsFolderId: null,
      selectedSnippetId: null,
      selectedSnippetName: '',
      snippetListVersion: 0,
      pendingNewSnippet: false,
      isDrawingsRoute: false,
      drawingsFolderId: null,
      selectedDrawingId: null,
      sidebarCollapsed: false,
      darkMode: false,
      pendingExpandPath: null,
      pendingEditPath: null,
    };
  },
  async mounted() {
    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    this.darkMode = savedDarkMode;
    this.applyDarkMode(savedDarkMode);

    // Init auth
    AuthService.init((loggedIn) => {
      this.authenticated = loggedIn;
      this.user = AuthService.user;
      if (loggedIn) this.initApp();
    });

    // Hash routing
    window.addEventListener('hashchange', () => this.onRouteChange());

    // Init mermaid
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    }
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

      const hash = window.location.hash.slice(1) || '/';
      this.currentPath = hash.startsWith('/') ? hash.slice(1) : hash;

      // Check if navigating to assets
      if (this.currentPath === '_assets' || this.currentPath.startsWith('_assets/')) {
        this.isAssetsRoute = true;
        this.isSnippetsRoute = false;
        this.isDrawingsRoute = false;
        this.resolved = null;
        try {
          this.assetsFolderId = await DriveService.getAssetsFolderId();
        } catch (e) {
          this.showToast('Failed to load assets: ' + e.message, 'error');
        }
        return;
      }

      // Check if navigating to snippets
      if (this.currentPath === '_snippets' || this.currentPath.startsWith('_snippets/')) {
        this.isSnippetsRoute = true;
        this.isAssetsRoute = false;
        this.isDrawingsRoute = false;
        this.resolved = null;
        
        // Extract snippet ID if present
        const segments = this.currentPath.split('/');
        this.selectedSnippetId = segments.length > 1 ? segments[1] : null;
        this.selectedSnippetName = '';

        try {
          this.snippetsFolderId = await DriveService.getSnippetsFolderId();
          if (this.pendingNewSnippet) {
            this.pendingNewSnippet = false;
            this.$nextTick(() => this.$refs.snippetManager?.createNewSnippet());
          }
        } catch (e) {
          this.showToast('Failed to load snippets: ' + e.message, 'error');
        }
        return;
      }

      // Check if navigating to drawings
      if (this.currentPath === '_drawings' || this.currentPath.startsWith('_drawings/')) {
        this.isDrawingsRoute = true;
        this.isAssetsRoute = false;
        this.isSnippetsRoute = false;
        this.resolved = null;

        const segments = this.currentPath.split('/');
        this.selectedDrawingId = segments.length > 1 ? segments[1] : null;

        try {
          this.drawingsFolderId = await DriveService.getDrawingsFolderId();
        } catch (e) {
          this.showToast('Failed to load drawings: ' + e.message, 'error');
        }
        return;
      }

      this.isAssetsRoute = false;
      this.isSnippetsRoute = false;
      this.isDrawingsRoute = false;
      this.assetsFolderId = null;
      this.snippetsFolderId = null;
      this.drawingsFolderId = null;
      this.selectedSnippetId = null;
      this.selectedSnippetName = '';
      this.selectedDrawingId = null;

      try {
        this.resolved = await DriveService.resolvePath(this.currentPath);

        if (this.resolved?.type === 'file') {
          this.fileContent = await DriveService.getFileContent(this.resolved.id);
        }

        if (this.resolved?.type === 'not_found' && this.resolved?.name === 'home') {
          this.currentPath = 'home';
        }

        if (this.pendingEditPath && this.currentPath === this.pendingEditPath && this.resolved?.type === 'file') {
          this.mode = 'edit';
          this.pendingEditPath = null;
        }
      } catch (e) {
        this.showToast('Error loading page: ' + e.message, 'error');
      }
    },

    startEdit() {
      this.mode = 'edit';
    },

    async save() {
      const editor = this.$refs.editor;
      if (!editor) return;

      const content = editor.getContent();

      try {
        if (this.resolved && this.resolved.type === 'file') {
          await DriveService.updateFile(this.resolved.id, content);
          this.showToast('Page saved', 'success');
        }
        this.fileContent = content;
        this.mode = 'view';
        // Re-resolve to refresh view
        this.resolved = await DriveService.resolvePath(this.currentPath);
      } catch (e) {
        this.showToast('Failed to save: ' + e.message, 'error');
      }
    },

    cancelEdit() {
      this.mode = 'view';
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

        const initialContent = `# ${fileName.replace(/\.md$/, '')}\n\nStart writing here...\n`;
        await DriveService.createFile(fileName, parentId, initialContent);

        this.showToast('Page created', 'success');
        this.showNewPage = false;
        this.newPagePath = '';

        this.pendingEditPath = path;

        // Navigate to new page
        window.location.hash = '#/' + path;

        // Refresh sidebar with auto-expand
        this.refreshSidebar(path);
      } catch (e) {
        this.showToast('Failed to create page: ' + e.message, 'error');
      } finally {
        this.creatingPage = false;
      }
    },

    showNewPageDialog() {
      this.newPagePath = this.currentPath ? this.currentPath + '/' : '';
      this.showNewPage = true;
      this.$nextTick(() => {
        this.$refs.newPageInput?.focus();
      });
    },

    refreshSidebar(expandPath = null) {
      // Force sidebar re-render by toggling rootId
      this.pendingExpandPath = expandPath;
      const id = this.rootId;
      this.rootId = null;
      this.$nextTick(() => { this.rootId = id; });
      this.refreshSnippets();
    },

    refreshAssetsFromSidebar() {
      if (this.isAssetsRoute) {
        this.$nextTick(() => this.$refs.assetManager?.loadItems());
      }
    },

    refreshSnippets() {
      this.snippetListVersion += 1;
    },

    onSnippetSelected(snippet) {
      this.selectedSnippetName = snippet?.name || '';
    },

    createSnippetFromHeader() {
      if (!this.isSnippetsRoute) {
        window.location.hash = '#/_snippets';
        this.pendingNewSnippet = true;
        return;
      }
      this.$nextTick(() => this.$refs.snippetManager?.createNewSnippet());
    },

    async deletePage() {
      if (!this.resolved || this.resolved.type !== 'file') return;
      if (!confirm('Delete this page?')) return;
      try {
        await DriveService.deleteFile(this.resolved.id, this.resolved.parentId);
        CacheService.remove('content:' + this.resolved.id);
        CacheService.remove('path:' + this.currentPath);
        this.showToast('Page deleted', 'success');
        window.location.hash = '#/';
      } catch (e) {
        this.showToast('Failed to delete: ' + e.message, 'error');
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
        if (hljsTheme) {
          hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
        }
        if (typeof mermaid !== 'undefined') {
          mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        }
      } else {
        document.documentElement.classList.remove('dark');
        const hljsTheme = document.getElementById('hljs-theme');
        if (hljsTheme) {
          hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        }
        if (typeof mermaid !== 'undefined') {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
        }
      }
    },

    refreshPage() {
      if (this.resolved && this.resolved.type === 'file') {
        CacheService.remove('content:' + this.resolved.id);
        CacheService.remove('path:' + this.currentPath);
      }
      this.onRouteChange();
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
app.component('page-view', PageView);
app.component('page-not-found', PageNotFound);
app.component('page-editor', PageEditor);
app.component('asset-manager', AssetManager);
app.component('snippet-manager', SnippetManager);
app.component('drawing-manager', DrawingManager);

// Mount
app.mount('#app');
