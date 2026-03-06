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
        @edit="startEdit"
        @save="save"
        @cancel="cancelEdit"
        @new-page="showNewPageDialog"
      ></app-header>
      <div class="app-body">
        <sidebar :root-id="rootId" :current-path="currentPath" ref="sidebar"></sidebar>
        <main class="main-content" :style="isAssetsRoute ? 'max-width: none' : ''">
          <template v-if="isAssetsRoute">
            <asset-manager
              :assets-folder-id="assetsFolderId"
              @toast="showToast"
            ></asset-manager>
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
      <div v-if="showNewPage" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewPage = false">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-semibold mb-4">Create New Page</h3>
          <input
            v-model="newPagePath"
            @keyup.enter="createPage(newPagePath)"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            style="border-color: hsl(var(--border))"
            placeholder="path/to/page-name"
            ref="newPageInput"
          />
          <p class="text-xs text-slate-400 mt-2">Use / to create in subfolders. Folders are created automatically.</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showNewPage = false" class="px-4 py-2 text-sm rounded-lg border hover:bg-slate-50" style="border-color: hsl(var(--border))">Cancel</button>
            <button @click="createPage(newPagePath)" class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">Create</button>
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
      isAssetsRoute: false,
      assetsFolderId: null,
    };
  },
  async mounted() {
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
        this.resolved = null;
        try {
          this.assetsFolderId = await DriveService.getAssetsFolderId();
        } catch (e) {
          this.showToast('Failed to load assets: ' + e.message, 'error');
        }
        return;
      }

      this.isAssetsRoute = false;
      this.assetsFolderId = null;

      try {
        this.resolved = await DriveService.resolvePath(this.currentPath);

        if (this.resolved?.type === 'file') {
          this.fileContent = await DriveService.getFileContent(this.resolved.id);
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
      this.showNewPage = false;

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

        // Navigate to new page
        window.location.hash = '#/' + path;

        // Refresh sidebar
        this.refreshSidebar();
      } catch (e) {
        this.showToast('Failed to create page: ' + e.message, 'error');
      }
    },

    showNewPageDialog() {
      this.newPagePath = this.currentPath ? this.currentPath + '/' : '';
      this.showNewPage = true;
      this.$nextTick(() => {
        this.$refs.newPageInput?.focus();
      });
    },

    refreshSidebar() {
      // Force sidebar re-render by toggling rootId
      const id = this.rootId;
      this.rootId = null;
      this.$nextTick(() => { this.rootId = id; });
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

// Mount
app.mount('#app');
