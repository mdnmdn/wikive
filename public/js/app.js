// Main Vue application — Unified Document Architecture
const app = Vue.createApp({
  template: `
    <login-screen v-if="!authenticated"></login-screen>

    <!-- ═══ WIKI SELECTION (shown after auth, before a wiki is connected) ═══ -->
    <template v-else-if="!wikiReady">
      <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-purple-100">
        <div class="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center" style="color: hsl(var(--foreground))">
          <img src="/assets/logo.jpg" alt="Wiki Logo" class="w-20 h-auto mx-auto mb-5 rounded-lg" />

          <!-- Loading wiki definitions -->
          <div v-if="wikiLoading" class="flex flex-col items-center gap-3 py-4">
            <div class="spinner"></div>
            <p class="text-sm" style="color: hsl(var(--muted-foreground))">Loading wikis…</p>
          </div>

          <!-- Wiki picker -->
          <div v-else-if="showWikiSelector">
            <h2 class="text-lg font-semibold mb-1">Select a Wiki</h2>
            <p class="text-sm mb-5" style="color: hsl(var(--muted-foreground))">Choose which wiki to open</p>
            <div class="space-y-2 mb-4">
              <button
                v-for="wiki in wikiList"
                :key="wiki.wikiName"
                @click="selectWiki(wiki)"
                class="w-full text-left px-4 py-3 rounded-lg border hover:opacity-80 transition-colors flex items-center justify-between"
                style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))"
              >
                <span class="font-medium">{{ wiki.wikiName }}</span>
                <span class="text-xs" style="color: hsl(var(--muted-foreground))">{{ wiki.rootFolder }}</span>
              </button>
            </div>
            <button
              @click="showWikiSelector = false; showNewWikiDialog = true; $nextTick(() => $refs.newWikiNameInput?.focus())"
              class="w-full py-2 text-sm rounded-lg border transition-colors"
              style="border-color: hsl(var(--primary)); color: hsl(var(--primary))"
            >+ New Wiki</button>
          </div>

          <!-- New wiki form -->
          <div v-else-if="showNewWikiDialog">
            <h2 class="text-lg font-semibold mb-1">{{ wikiList.length === 0 ? 'Create Your First Wiki' : 'New Wiki' }}</h2>
            <p class="text-sm mb-5" style="color: hsl(var(--muted-foreground))">Choose a name and where to store pages in Google Drive</p>
            <div class="space-y-3 mb-5 text-left">
              <div>
                <label class="block text-xs font-medium mb-1" style="color: hsl(var(--muted-foreground))">Wiki name</label>
                <input
                  v-model="newWikiName"
                  @keyup.enter="!creatingWiki && createWikiAndConnect()"
                  :disabled="creatingWiki"
                  class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  style="border-color: hsl(var(--border))"
                  placeholder="default"
                  ref="newWikiNameInput"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color: hsl(var(--muted-foreground))">Root folder in Google Drive</label>
                <input
                  v-model="newWikiFolder"
                  @keyup.enter="!creatingWiki && createWikiAndConnect()"
                  :disabled="creatingWiki"
                  class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  style="border-color: hsl(var(--border))"
                  placeholder="_wiki"
                />
                <p class="text-xs mt-1" style="color: hsl(var(--muted-foreground))">Folder path in Drive, e.g. <code>_wiki</code> or <code>team/projects/wiki</code></p>
</div>
      </div>

      </template>

    <template v-else>
      <app-header
        :current-path="currentPath"
        :mode="mode"
        :user="user"
        :document="document"
        :dark-mode="darkMode"
        :notifications="notifications"
        :show-notifications="showNotifications"
        :presence-users="presenceUsers"
        :wiki-list="wikiList"
        :current-wiki="currentWikiName"
        @switch-wiki="switchWiki"
        @create-wiki="openCreateWikiDialog"
        @delete-wiki="deleteWiki"
        @edit="startEdit"
        @save="save"
        @cancel="cancelEdit"
        @new-page="showNewPageDialog"
        @new-snippet="createNewSnippet"
        @new-drawing="createNewDrawing"
        @new-notebook="createNewNotebook"
        @delete-page="deleteDocument"
        @toggle-dark="toggleDarkMode"
        @refresh-page="refreshPage"
        @rename-move="showRenameMoveDialog"
        @clone="cloneDocument"
        @share-anonymous="openAnonymousShareDialog"
        @toggle-notifications="showNotifications = !showNotifications"
        @clear-notifications="notifications = []; showNotifications = false"
        @navigate="onNavigate"
        @drawing-save="onDrawingSave"
        @drawing-toggle-autosave="$refs.renderer?.triggerToggleAutosave()"
        @drawing-toggle-fullscreen="$refs.renderer?.triggerToggleFullscreen()"
        @snippet-copy="$refs.renderer?.triggerCopy()"
        @asset-refresh="$refs.renderer?.triggerRefreshAssets()"
        @asset-upload="$refs.renderer?.triggerUpload()"
        @asset-create-subfolder="$refs.renderer?.triggerCreateSubfolder()"
        :ai-enabled="aiEnabled"
        @toggle-ai-chat="toggleAiChat"
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
              :is-shared-view="false"
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

      <!-- AI Chat Panel -->
      <ai-chat-panel
        v-if="aiPanelOpen && aiChat"
        :chat="aiChat"
        :model="aiModel"
        :page-context="currentPath"
        :document-context="documentContext"
        :ai-providers="aiProviders"
        :providers-saving="providersSaving"
        :encryption-key="encryptionKey"
        :custom-prompt="currentWikiCustomPrompt"
        @close="closeAiPanel"
        @model-change="onAiModelChange"
        @providers-change="onProvidersChange"
        @prompt-change="onCustomPromptChange"
        @page-refresh="refreshPage"
      ></ai-chat-panel>

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
      <!-- New Notebook dialog -->
      <div v-if="showNewNotebook" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewNotebook = false">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">New Notebook</h3>
          <input
            v-model="newNotebookName"
            @keyup.enter="newNotebookName.trim() && doCreateNewNotebook(newNotebookName)"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            style="border-color: hsl(var(--border)); color: hsl(var(--foreground)); background-color: hsl(var(--background))"
            placeholder="Notebook name"
            ref="newNotebookInput"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showNewNotebook = false" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="doCreateNewNotebook(newNotebookName)" :disabled="!newNotebookName.trim()" class="px-4 py-2 text-sm rounded-lg disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">Create</button>
          </div>
        </div>
      </div>
      <!-- New Drawing dialog -->
      <div v-if="showNewDrawing" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewDrawing = false">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">New Drawing</h3>
          <input
            v-model="newDrawingName"
            @keyup.enter="newDrawingName.trim() && doCreateNewDrawing(newDrawingName)"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            style="border-color: hsl(var(--border)); color: hsl(var(--foreground)); background-color: hsl(var(--background))"
            placeholder="Drawing name"
            ref="newDrawingInput"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showNewDrawing = false" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="doCreateNewDrawing(newDrawingName)" :disabled="!newDrawingName.trim()" class="px-4 py-2 text-sm rounded-lg disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">Create</button>
          </div>
        </div>
      </div>
      <!-- Rename/Move dialog -->
      <div v-if="showRenameMove" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="!renamingMoving && (showRenameMove = false)">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">{{ renameMoveTitle }}</h3>
          <input
            v-model="renameMoveValue"
            @keyup.enter="!renamingMoving && renameMovePage(renameMoveValue)"
            :disabled="renamingMoving"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            style="border-color: hsl(var(--border)); color: hsl(var(--foreground)); background-color: hsl(var(--background))"
            ref="renameMoveInput"
          />
          <p v-if="document?.docType === 'markdown'" class="text-xs mt-2" style="color: hsl(var(--muted-foreground))">Use / to move to a different folder. Folders are created automatically.</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showRenameMove = false" :disabled="renamingMoving" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80 disabled:opacity-50" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="renameMovePage(renameMoveValue)" :disabled="renamingMoving" class="px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">
              <template v-if="renamingMoving">
                <div class="spinner" style="border-color: hsl(var(--primary-foreground) / 0.3); border-top-color: hsl(var(--primary-foreground)); width: 1rem; height: 1rem; border-width: 1px"></div>
                <span>Saving…</span>
              </template>
              <template v-else><span>Save</span></template>
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
      <!-- Create Wiki dialog (from header) -->
      <div v-if="showCreateWikiDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="!creatingWiki && (showCreateWikiDialog = false)">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-md mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">New Wiki</h3>
          <div class="space-y-3 mb-5">
            <div>
              <label class="block text-xs font-medium mb-1" style="color: hsl(var(--muted-foreground))">Wiki name</label>
              <input
                v-model="newWikiName"
                @keyup.enter="!creatingWiki && createWikiFromHeader()"
                :disabled="creatingWiki"
                class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                style="border-color: hsl(var(--border))"
                placeholder="default"
                ref="createWikiNameInput"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1" style="color: hsl(var(--muted-foreground))">Root folder in Google Drive</label>
              <input
                v-model="newWikiFolder"
                @keyup.enter="!creatingWiki && createWikiFromHeader()"
                :disabled="creatingWiki"
                class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                style="border-color: hsl(var(--border))"
                placeholder="_wiki"
              />
              <p class="text-xs mt-1" style="color: hsl(var(--muted-foreground))">Folder path in Drive, e.g. <code>_wiki</code> or <code>team/projects/wiki</code></p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button @click="showCreateWikiDialog = false" :disabled="creatingWiki" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80 disabled:opacity-50" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Cancel</button>
            <button @click="createWikiFromHeader()" :disabled="creatingWiki || !newWikiName.trim() || !newWikiFolder.trim()" class="px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50 text-white" style="background-color: hsl(var(--primary))">
              <div v-if="creatingWiki" class="spinner" style="border-color:hsl(var(--primary-foreground)/0.3);border-top-color:hsl(var(--primary-foreground));width:1rem;height:1rem;border-width:1px"></div>
              {{ creatingWiki ? 'Creating…' : 'Create & Switch' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="anonymousShareDialog.open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="!anonymousShareDialog.loading && closeAnonymousShareDialog()">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-2">Anonymous Share</h3>
          <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">Anyone with this link can open a read-only public view of this document without signing in.</p>
          <div v-if="anonymousShareDialog.loading" class="flex items-center justify-center py-8"><div class="spinner"></div></div>
          <div v-else>
            <input
              :value="anonymousShareDialog.url"
              readonly
              class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
              style="border-color: hsl(var(--border)); color: hsl(var(--foreground)); background-color: hsl(var(--muted))"
            />
            <p v-if="anonymousShareDialog.error" class="text-sm mt-3 text-red-500">{{ anonymousShareDialog.error }}</p>
            <div class="flex justify-end gap-2 mt-4">
              <button @click="closeAnonymousShareDialog" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">Close</button>
              <button @click="copyAnonymousShareUrl" :disabled="!anonymousShareDialog.url" class="px-4 py-2 text-sm rounded-lg disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">Copy Link</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  `,
  provide() {
    return { rendererState: this.rendererState };
  },
  data() {
    return {
      rendererState: {
        drawingAutosave: false,
        drawingAutosaveStatus: '',
        drawingSaving: false,
        drawingFullscreen: false,
        snippetType: 'markdown',
        snippetExpiry: 1440,
        assetSearch: '',
      },
      authenticated: false,
      wikiReady: false,
      wikiLoading: false,
      showWikiSelector: false,
      showNewWikiDialog: false,
      showCreateWikiDialog: false,
      wikiList: [],
      currentWikiName: '',
      newWikiName: 'default',
      newWikiFolder: '_wiki',
      creatingWiki: false,
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
      showNewDrawing: false,
      newDrawingName: '',
      pendingNewDrawingName: '',
      pendingNewNotebook: false,
      showNewNotebook: false,
      newNotebookName: '',
      pendingNewNotebookName: '',
      confirmDialog: null,
      showRenameMove: false,
      renameMoveValue: '',
      renamingMoving: false,
      notifications: [],
      presenceUsers: [],
      showNotifications: false,
      anonymousShareDialog: {
        open: false,
        loading: false,
        url: '',
        error: '',
      },
      aiChat: null,
      aiPanelOpen: false,
      aiModel: 'gemini:gemini-2.0-flash',
      aiProviders: [],
      providersSaving: false,
      encryptionKey: null,
    };
  },
  computed: {
    aiEnabled() {
      return typeof isAiConfigured === 'function' && isAiConfigured();
    },
    documentContext() {
      const doc = this.document;
      if (!doc || !['markdown', 'snippet'].includes(doc.docType)) return null;
      return { name: doc.name, path: this.currentPath, docType: doc.docType };
    },
    currentWikiCustomPrompt() {
      if (!this.currentWikiName) return '';
      return this.wikiList.find(w => w.wikiName === this.currentWikiName)?.aiCustomPrompt || '';
    },
    renameMoveTitle() {
      const dt = this.document?.docType;
      if (dt === 'drawing') return 'Rename Drawing';
      if (dt === 'snippet') return 'Rename Snippet';
      if (dt === 'notebook') return 'Rename Notebook';
      return 'Rename / Move Page';
    },
    mainContentClass() {
      const dt = this.document?.docType;
      return {
        'snippets-full': dt === 'snippet',
        'drawings-full': dt === 'drawing',
        'notebooks-full': dt === 'notebook',
      };
    },
  },
  async mounted() {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    this.darkMode = savedDarkMode;
    this.applyDarkMode(savedDarkMode);

    // Restore AI model preference
    const savedAiModel = localStorage.getItem('wiki:ai-model');
    if (savedAiModel) {
      this.aiModel = savedAiModel;
    } else if (typeof getDefaultModel === 'function') {
      this.aiModel = getDefaultModel();
    }

    AuthManager.init((loggedIn) => {
      this.authenticated = loggedIn;
      this.user = AuthManager.user;
      if (loggedIn) {
        this.initApp();
      } else {
        this.wikiReady = false;
        this.wikiList = [];
        this.showWikiSelector = false;
        this.showNewWikiDialog = false;
        this.aiProviders = [];
        this.encryptionKey = null;
        if (this.aiChat) {
          this.aiChat.destroy?.();
          this.aiChat = null;
        }
        this.aiPanelOpen = false;
        if (typeof getDefaultModel === 'function') this.aiModel = getDefaultModel();
      }
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
    if (this.aiChat) {
      this.aiChat.destroy();
    }
  },
  methods: {
    async initApp() {
      // Reset wiki state in case a previous session is still showing
      this.wikiReady = false;
      this.document = null;
      this.fileContent = '';
      this.aiProviders = [];
      this.encryptionKey = null;
      if (this.aiChat) {
        this.aiChat.destroy?.();
        this.aiChat = null;
      }
      this.aiPanelOpen = false;
      if (typeof getDefaultModel === 'function') this.aiModel = getDefaultModel();

      // Namespace cache per authenticated user so accounts don't share entries
      CacheService.setUser(this.user.email);

      // Static config: ROOT_FOLDER_NAME hard-coded — skip wiki selection
      if (CONFIG.ROOT_FOLDER_NAME) {
        this.currentWikiName = CONFIG.ROOT_FOLDER_NAME.split('/').pop();
        await this._connectToWiki(CONFIG.ROOT_FOLDER_NAME);
        return;
      }

      // Dynamic wiki selection: load definitions from Drive
      this.wikiLoading = true;
      try {
        const { wikis, aiProviders, encryptionKey } = await StorageService.getWikiDefinitions();
        this.wikiList = wikis;
        this.aiProviders = aiProviders || [];
        await this._initEncryptionKey(encryptionKey);

        // Use the last-remembered wiki for this account if it still exists
        const savedName = localStorage.getItem('wiki_last:' + this.user.email);
        if (savedName) {
          const found = wikis.find(w => w.wikiName === savedName);
          if (found) {
            this.wikiLoading = false;
            this.currentWikiName = found.wikiName;
            await this._connectToWiki(found.rootFolder);
            return;
          }
        }

        this.wikiLoading = false;
        if (wikis.length === 0) {
          this.showNewWikiDialog = true;
          this.$nextTick(() => this.$refs.newWikiNameInput?.focus());
        } else {
          this.showWikiSelector = true;
        }
      } catch (e) {
        this.wikiLoading = false;
        this.showToast('Failed to load wikis: ' + e.message, 'error');
      }
    },

    async _connectToWiki(rootFolder) {
      StorageService.setRootFolderName(rootFolder);
      this.wikiReady = true;
      try {
        this.rootId = await StorageService.getRootFolderId();

        if (CONFIG.WORKER_URL) {
          await new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'js/services/realtime.js';
            s.onload = resolve;
            s.onerror = resolve;
            document.head.appendChild(s);
          });
        }

        if (typeof RealtimeService !== 'undefined' && CONFIG.WORKER_URL) {
          RealtimeService.onNotification((msg) => {
            this.notifications.unshift(msg);
            if (this.notifications.length > 50) this.notifications.length = 50;
            const action = msg.action === 'save' ? 'updated' : msg.action === 'create' ? 'created' : 'deleted';
            this.showToast(`${msg.user.name} ${action} ${msg.path}`, 'info');
            if (msg.path === this.currentPath) this.refreshPage();
          });
          RealtimeService.onPresence((users) => {
            this.presenceUsers = users.filter(u => u.email !== this.user?.email);
          });
          RealtimeService.connect(CONFIG.WORKER_URL, this.rootId, this.user);
        }

        this.onRouteChange();
      } catch (e) {
        this.showToast('Failed to initialize: ' + e.message, 'error');
      }
    },

    async selectWiki(wiki) {
      this.showWikiSelector = false;
      this.currentWikiName = wiki.wikiName;
      localStorage.setItem('wiki_last:' + this.user.email, wiki.wikiName);
      await this._connectToWiki(wiki.rootFolder);
    },

    async createWikiAndConnect() {
      const name = (this.newWikiName || '').trim();
      const folder = (this.newWikiFolder || '').trim();
      if (!name || !folder) return;
      this.creatingWiki = true;
      try {
        const newWiki = { wikiName: name, rootFolder: folder };
        const updated = [...this.wikiList, newWiki];
        await StorageService.saveWikiDefinitions({ wikis: updated, aiProviders: this.aiProviders, encryptionKey: this.encryptionKey });
        this.wikiList = updated;
        this.currentWikiName = name;
        localStorage.setItem('wiki_last:' + this.user.email, name);
        this.showNewWikiDialog = false;
        await this._connectToWiki(folder);
      } catch (e) {
        this.showToast('Failed to create wiki: ' + e.message, 'error');
      }
      this.creatingWiki = false;
    },

    openCreateWikiDialog() {
      this.newWikiName = '';
      this.newWikiFolder = '_wiki';
      this.showCreateWikiDialog = true;
      this.$nextTick(() => this.$refs.createWikiNameInput?.focus());
    },

    async createWikiFromHeader() {
      const name = (this.newWikiName || '').trim();
      const folder = (this.newWikiFolder || '').trim();
      if (!name || !folder) return;
      this.creatingWiki = true;
      try {
        const newWiki = { wikiName: name, rootFolder: folder };
        const updated = [...this.wikiList, newWiki];
        await StorageService.saveWikiDefinitions({ wikis: updated, aiProviders: this.aiProviders, encryptionKey: this.encryptionKey });
        this.wikiList = updated;
        this.showCreateWikiDialog = false;
        await this.switchWiki(newWiki);
      } catch (e) {
        this.showToast('Failed to create wiki: ' + e.message, 'error');
      }
      this.creatingWiki = false;
    },

    async switchWiki(wiki) {
      if (wiki.wikiName === this.currentWikiName) return;
      this.currentWikiName = wiki.wikiName;
      localStorage.setItem('wiki_last:' + this.user.email, wiki.wikiName);
      // Use replaceState to reset to home without firing a hashchange before the wiki is connected
      history.replaceState(null, '', '#/');
      await this._connectToWiki(wiki.rootFolder);
      this.refreshSidebar();
    },

    async deleteWiki(wiki) {
      try {
        await this.showConfirm(
          `Remove wiki "${wiki.wikiName}"?`,
          'This removes it from your wiki list. Files in Google Drive are not deleted.',
          'Remove'
        );
      } catch { return; }
      const updated = this.wikiList.filter(w => w.wikiName !== wiki.wikiName);
      try {
        await StorageService.saveWikiDefinitions({ wikis: updated, aiProviders: this.aiProviders, encryptionKey: this.encryptionKey });
        this.wikiList = updated;
        if (localStorage.getItem('wiki_last:' + this.user.email) === wiki.wikiName) {
          localStorage.removeItem('wiki_last:' + this.user.email);
        }
        this.showToast(`Wiki "${wiki.wikiName}" removed`, 'success');
        if (wiki.wikiName === this.currentWikiName) {
          if (updated.length > 0) {
            await this.switchWiki(updated[0]);
          } else {
            this.wikiReady = false;
            this.currentWikiName = '';
            this.showNewWikiDialog = true;
          }
        }
      } catch (e) {
        this.showToast('Failed to remove wiki: ' + e.message, 'error');
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

      // Notify presence of current path
      if (typeof RealtimeService !== 'undefined') RealtimeService.navigate(this.currentPath);

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

        // Drawings and Notebooks are always in edit mode
        if (this.document?.docType === 'drawing' || this.document?.docType === 'notebook') {
          this.mode = 'edit';
        }

        // Open blank new snippet in edit mode
        if (this.pendingNewSnippet && this.currentPath === '_snippets') {
          this.pendingNewSnippet = false;
          const doc = DocumentService.toDocument(
            { id: null, name: this._generateSnippetName(), isFolder: false }, null, '_snippets'
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
          const folderId = await StorageService.getDrawingsFolderId();
          const drawingName = this.pendingNewDrawingName || '';
          this.pendingNewDrawingName = '';
          const doc = DocumentService.toDocument(
            { id: null, name: drawingName, isFolder: false }, folderId, '_drawings'
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

        // Open blank new notebook in edit mode
        if (this.pendingNewNotebook && this.currentPath === '_notebooks') {
          this.pendingNewNotebook = false;
          const folderId = await StorageService.getNotebooksFolderId();
          const notebookName = this.pendingNewNotebookName || '';
          this.pendingNewNotebookName = '';
          const doc = DocumentService.toDocument(
            { id: null, name: notebookName, isFolder: false }, folderId, '_notebooks'
          );
          doc.docType = 'notebook';
          doc.type = 'file';
          this.document = doc;
          this.fileContent = JSON.stringify({
            cells: [],
            metadata: {},
            nbformat: 4,
            nbformat_minor: 5
          });
          this.mode = 'edit';
        }
      } catch (e) {
        this.showToast('Error loading: ' + e.message, 'error');
      }

      this._setupDocContext();
      this.loading = false;
    },

    async resolveSpecialRoute(specialFolder) {
      const segments = this.currentPath.split('/');
      const folderName = segments[0]; // _assets, _snippets, _drawings
      const itemId = segments[1] || null;

      // Get the special folder ID
      let folderId;
      if (specialFolder === 'assets') folderId = await StorageService.getAssetsFolderId();
      else if (specialFolder === 'snippets') folderId = await StorageService.getSnippetsFolderId();
      else if (specialFolder === 'drawings') folderId = await StorageService.getDrawingsFolderId();
        else if (specialFolder === 'notebooks') folderId = await StorageService.getNotebooksFolderId();

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
        } else if (specialFolder === 'notebooks') {
          this.document.docType = 'folder';
        }
        return;
      }

      // Specific item selected
      if (specialFolder === 'snippets') {
        const meta = await StorageService.getFileMetadata(itemId);
        this.document = DocumentService.toDocument(meta, folderId, this.currentPath);
        this.fileContent = await StorageService.getFileContent(itemId);
      } else if (specialFolder === 'drawings') {
        const meta = await StorageService.getFileMetadata(itemId);
        this.document = DocumentService.toDocument(meta, folderId, this.currentPath);
        this.fileContent = await StorageService.getFileContent(itemId);
        } else if (specialFolder === 'notebooks') {
          const meta = await StorageService.getFileMetadata(itemId);
          this.document = DocumentService.toDocument(meta, folderId, this.currentPath);
          this.fileContent = await StorageService.getFileContent(itemId);
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
      const resolved = await StorageService.resolvePath(this.currentPath);

      if (!resolved || resolved.type === 'not_found') {
        if (resolved?.name === 'home') {
          this.currentPath = 'home';
        }
        this.notFound = true;
        return;
      }

      if (resolved.type === 'file') {
        this.fileContent = await StorageService.getFileContent(resolved.id);
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
      // Snippets handle their own save (metadata + content)
      if (this.document?.docType === 'snippet') {
        await renderer.triggerSave();
        return;
      }
      const content = renderer.getContent();
      try {
        if (this.document && this.document.type === 'file') {
          await StorageService.updateFile(this.document.id, content);
          this.showToast('Saved', 'success');
          if (typeof RealtimeService !== 'undefined') RealtimeService.notifyUpdate('save', this.currentPath, this.document.docType);
        }
        this.fileContent = content;
        if (window._currentDocContext) window._currentDocContext.content = content;
        this.mode = 'view';
      } catch (e) {
        this.showToast('Failed to save: ' + e.message, 'error');
      }
    },

    async onDrawingSave() {
      await this.$refs.renderer?.triggerSave();
    },

    onModeChange(newMode) {
      this.mode = newMode;
    },

    async onRendererSave(data) {
      // Renderer handled its own save (snippets, drawings)
      // Clear parent listing cache so new items appear in the sidebar
      if (this.document?.parentId) {
        CacheService.remove('listing:' + this.document.parentId);
      } else {
        // New document (parentId not yet set) — clear its folder cache
        const dt = this.document?.docType;
        try {
          if (dt === 'snippet') {
            const fid = await StorageService.getSnippetsFolderId();
            if (fid) CacheService.remove('listing:' + fid);
          } else if (dt === 'drawing') {
            const fid = await StorageService.getDrawingsFolderId();
            if (fid) CacheService.remove('listing:' + fid);
          }
        } catch {}
      }
      if (typeof RealtimeService !== 'undefined') RealtimeService.notifyUpdate('save', this.currentPath, this.document?.docType);
      this.refreshSidebar();
      // Drawings stay in edit mode — don't reload the route (would remount Excalidraw).
      // Just patch the document name in place if it changed.
      if (this.document?.docType === 'drawing') {
        if (data?.name && this.document.name !== data.name) {
          this.document = { ...this.document, name: data.name };
        }
        return;
      }
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
          parentId = await StorageService.createFolderPath(segments.join('/'));
        } else {
          parentId = await StorageService.getRootFolderId();
        }
        const initialContent = '# ' + fileName.replace(/\.md$/, '') + '\n\nStart writing here...\n';
        await StorageService.createFile(fileName, parentId, initialContent);
        if (typeof RealtimeService !== 'undefined') RealtimeService.notifyUpdate('create', path, 'markdown');
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
      this.newDrawingName = '';
      this.showNewDrawing = true;
      this.$nextTick(() => this.$refs.newDrawingInput?.focus());
    },

    doCreateNewDrawing(name) {
      name = (name || '').trim();
      if (!name) return;
      this.pendingNewDrawingName = name;
      this.showNewDrawing = false;
      if (this.currentPath === '_drawings') {
        this.pendingNewDrawing = true;
        this.onRouteChange();
      } else {
        this.pendingNewDrawing = true;
        window.location.hash = '#/_drawings';
      }
    },

    createNewNotebook() {
      this.newNotebookName = '';
      this.showNewNotebook = true;
      this.$nextTick(() => this.$refs.newNotebookInput?.focus());
    },

    doCreateNewNotebook(name) {
      name = (name || '').trim();
      if (!name) return;
      if (!name.endsWith('.ipynb')) name += '.ipynb';
      this.pendingNewNotebookName = name;
      this.showNewNotebook = false;
      if (this.currentPath === '_notebooks') {
        this.pendingNewNotebook = true;
        this.onRouteChange();
      } else {
        this.pendingNewNotebook = true;
        window.location.hash = '#/_notebooks';
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
        await StorageService.deleteFile(this.document.id, this.document.parentId);
        if (typeof RealtimeService !== 'undefined') RealtimeService.notifyUpdate('delete', this.currentPath, this.document.docType);
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
      this.$refs.sidebar?.refresh();
    },

    refreshPage() {
      if (this.document && this.document.id) {
        CacheService.remove('content:' + this.document.id);
        CacheService.remove('path:' + this.currentPath);
        if (this.document.parentId) CacheService.remove('listing:' + this.document.parentId);
      }
      this.refreshSidebar();
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
        if (this.showRenameMove) { if (!this.renamingMoving) this.showRenameMove = false; return; }
        if (this.showNewPage) { if (!this.creatingPage) this.showNewPage = false; return; }
        if (this.showNewDrawing) { this.showNewDrawing = false; return; }
        if (this.showCreateWikiDialog) { if (!this.creatingWiki) this.showCreateWikiDialog = false; return; }
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

    showRenameMoveDialog() {
      const doc = this.document;
      if (!doc) return;
      if (doc.docType === 'drawing') {
        this.renameMoveValue = (doc.name || '').replace(/\.excalidraw$/, '');
      } else if (doc.docType === 'snippet') {
        this.renameMoveValue = doc.name || '';
      } else {
        this.renameMoveValue = this.currentPath;
      }
      this.showRenameMove = true;
      this.$nextTick(() => {
        const el = this.$refs.renameMoveInput;
        if (el) { el.focus(); el.select(); }
      });
    },

    async renameMovePage(newValue) {
      newValue = (newValue || '').trim();
      if (!newValue) { this.showRenameMove = false; return; }
      const docType = this.document?.docType;

      if (docType === 'notebook') {
        let newName = newValue;
        if (!newName.endsWith('.ipynb')) newName += '.ipynb';
        if (newName === this.document.name) { this.showRenameMove = false; return; }
        this.renamingMoving = true;
        try {
          await StorageService.renameFile(this.document.id, newName, this.document.parentId);
          this.document = { ...this.document, name: newName };
          CacheService.remove('listing:' + this.document.parentId);
          this.showToast('Notebook renamed', 'success');
          this.showRenameMove = false;
          this.refreshSidebar();
        } catch (e) { this.showToast('Failed: ' + e.message, 'error'); }
        this.renamingMoving = false;
        return;
      }

      if (docType === 'drawing') {
        const newName = newValue.replace(/\.excalidraw$/, '') + '.excalidraw';
        if (newName === this.document.name) { this.showRenameMove = false; return; }
        this.renamingMoving = true;
        try {
          await StorageService.renameFile(this.document.id, newName, this.document.parentId);
          this.document = { ...this.document, name: newName };
          CacheService.remove('listing:' + this.document.parentId);
          this.showToast('Drawing renamed', 'success');
          this.showRenameMove = false;
          this.refreshSidebar();
        } catch (e) { this.showToast('Failed: ' + e.message, 'error'); }
        this.renamingMoving = false;
        return;
      }

      if (docType === 'snippet') {
        if (newValue === this.document.name) { this.showRenameMove = false; return; }
        this.renamingMoving = true;
        try {
          await StorageService.renameFile(this.document.id, newValue, this.document.parentId);
          this.document = { ...this.document, name: newValue };
          CacheService.remove('listing:' + this.document.parentId);
          this.showToast('Snippet renamed', 'success');
          this.showRenameMove = false;
          this.refreshSidebar();
        } catch (e) { this.showToast('Failed: ' + e.message, 'error'); }
        this.renamingMoving = false;
        return;
      }

      // Markdown: path-based rename/move
      if (newValue === this.currentPath) { this.showRenameMove = false; return; }
      this.renamingMoving = true;
      try {
        const segments = newValue.split('/').filter(Boolean);
        const newFileName = segments.pop() + '.md';
        let newParentId;
        if (segments.length > 0) {
          newParentId = await StorageService.createFolderPath(segments.join('/'));
        } else {
          newParentId = await StorageService.getRootFolderId();
        }
        await StorageService.moveFile(this.document.id, newFileName, this.document.parentId, newParentId);
        CacheService.remove('path:' + this.currentPath);
        this.showToast('Page moved', 'success');
        this.showRenameMove = false;
        this.refreshSidebar(newValue);
        window.location.hash = '#/' + newValue;
      } catch (e) {
        this.showToast('Failed: ' + e.message, 'error');
      }
      this.renamingMoving = false;
    },

    async cloneDocument() {
      const doc = this.document;
      if (!doc?.id) return;
      try {
        if (doc.docType === 'markdown') {
          const baseName = doc.name.replace(/\.md$/, '');
          const data = await StorageService.copyFile(doc.id, baseName + '-copy.md', doc.parentId);
          const pathSegs = this.currentPath.split('/');
          pathSegs[pathSegs.length - 1] = baseName + '-copy';
          const newPath = pathSegs.join('/');
          this.showToast('Page cloned', 'success');
          this.pendingEditPath = newPath;
          this.refreshSidebar(newPath);
          window.location.hash = '#/' + newPath;
        } else if (doc.docType === 'snippet') {
          const data = await StorageService.copyFile(doc.id, 'Copy of ' + doc.name, doc.parentId);
          this.showToast('Snippet cloned', 'success');
          CacheService.remove('listing:' + doc.parentId);
          this.refreshSidebar();
          window.location.hash = '#/_snippets/' + data.id;
        } else if (doc.docType === 'drawing') {
          const baseName = doc.name.replace(/\.excalidraw$/, '');
          const data = await StorageService.copyFile(doc.id, baseName + '-copy.excalidraw', doc.parentId);
          this.showToast('Drawing cloned', 'success');
          CacheService.remove('listing:' + doc.parentId);
          this.refreshSidebar();
          window.location.hash = '#/_drawings/' + data.id;
        } else if (doc.docType === 'notebook') {
          const baseName = doc.name.replace(/\.ipynb$/, '');
          const data = await StorageService.copyFile(doc.id, baseName + '-copy.ipynb', doc.parentId);
          this.showToast('Notebook cloned', 'success');
          CacheService.remove('listing:' + doc.parentId);
          this.refreshSidebar();
          window.location.hash = '#/_notebooks/' + data.id;
        }
      } catch (e) {
        this.showToast('Failed to clone: ' + e.message, 'error');
      }
    },

    _generateSnippetName() {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const extMap = { markdown: 'md', javascript: 'js', python: 'py', html: 'html', css: 'css', json: 'json', yaml: 'yml', sh: 'sh', typescript: 'ts', golang: 'go', java: 'java', rust: 'rs', ruby: 'rb', sql: 'sql', xml: 'xml', text: 'txt' };
      const ext = extMap[this.rendererState.snippetType] || 'txt';
      return `snip-${yy}${mm}${dd}-${hh}-${min}.${ext}`;
    },

    showToast(message, type = 'info') {
      this.toast = { message, type };
      setTimeout(() => { this.toast = null; }, 3000);
    },

    _setupDocContext() {
      const doc = this.document;
      const supported = doc && (doc.docType === 'markdown' || doc.docType === 'snippet');
      window._currentDocContext = supported ? {
        name: doc.name,
        path: this.currentPath,
        docType: doc.docType,
        documentId: doc.id,
        content: this.fileContent,
      } : null;
      window._refreshCurrentDoc = () => {
        if (this.document?.id) CacheService.remove('content:' + this.document.id);
        this.onRouteChange();
      };
    },

    async openAiPanel() {
      this.aiPanelOpen = true;
      if (!this.aiChat) {
        try {
          // Build model list: from configured providers or from backend
          if (this.aiProviders && this.aiProviders.length > 0) {
            window.AI_MODELS = this.aiProviders.flatMap(p =>
              (p.models || []).map(m => ({ label: `${p.name} › ${m}`, value: `${p.id}::${m}` }))
            );
            if (!(window.AI_MODELS).find(m => m.value === this.aiModel)) {
              this.aiModel = window.AI_MODELS[0]?.value ?? this.aiModel;
            }
          } else {
            if (typeof window.fetchAiModels === 'function') await window.fetchAiModels();
            if (!(window.AI_MODELS ?? []).find(m => m.value === this.aiModel)) {
              this.aiModel = window.AI_MODELS[0]?.value ?? this.aiModel;
            }
            if (typeof getDefaultModel === 'function') this.aiModel = getDefaultModel();
          }

          // Resolve provider from model value (format: "providerId::modelName")
          let provider = null;
          let modelName = this.aiModel;
          if (this.aiModel && this.aiModel.includes('::')) {
            const sep = this.aiModel.indexOf('::');
            const providerId = this.aiModel.slice(0, sep);
            modelName = this.aiModel.slice(sep + 2);
            provider = this.aiProviders.find(p => p.id === providerId) || null;
          }

          const tools = typeof getWikiTools === 'function' ? await getWikiTools() : [];
          const baseSystem = window.WIKI_ASSISTANT_SYSTEM || 'You are a helpful AI assistant.';
          const customPrompt = this.currentWikiCustomPrompt;
          const system = customPrompt
            ? `${baseSystem}\n\n## Custom Instructions\n\n${customPrompt}`
            : baseSystem;
          this.aiChat = await createAiChat({
            model: modelName,
            provider,
            system,
            tools,
            encryptionKey: this.encryptionKey,
          });
          this.aiChat.chat.messages.subscribe(msgs => { this.aiMessages = msgs; });
          this.aiChat.chat.isGenerating.subscribe(v => { this.aiGenerating = v; });
        } catch (e) {
          console.error('AI chat error:', e);
          this.showToast('Failed to initialize AI chat: ' + e.message, 'error');
          this.aiPanelOpen = false;
        }
      }
    },

    closeAiPanel() {
      this.aiPanelOpen = false;
    },

    toggleAiChat() {
      if (this.aiPanelOpen) {
        this.closeAiPanel();
      } else {
        this.openAiPanel();
      }
    },

    async onAiModelChange(newModel) {
      this.aiModel = newModel;
      localStorage.setItem('wiki:ai-model', newModel);
      // Recreate chat so the new provider config/model takes effect immediately
      if (this.aiChat) {
        this.aiChat.destroy?.();
        this.aiChat = null;
        await this.openAiPanel();
      }
    },

    async _initEncryptionKey(encryptionKeyFromDrive) {
      if (encryptionKeyFromDrive) {
        this.encryptionKey = encryptionKeyFromDrive;
        localStorage.setItem('wiki:enc-key', encryptionKeyFromDrive);
        return;
      }
      const localKey = localStorage.getItem('wiki:enc-key');
      if (localKey) {
        this.encryptionKey = localKey;
        // Also save to Drive for other devices
        StorageService.saveWikiDefinitions({
          wikis: this.wikiList,
          aiProviders: this.aiProviders,
          encryptionKey: this.encryptionKey,
        }).catch(() => {});
        return;
      }
      if (typeof window.generateEncryptionKey === 'function') {
        this.encryptionKey = window.generateEncryptionKey();
        localStorage.setItem('wiki:enc-key', this.encryptionKey);
        StorageService.saveWikiDefinitions({
          wikis: this.wikiList,
          aiProviders: this.aiProviders,
          encryptionKey: this.encryptionKey,
        }).catch(() => {});
      }
    },

    async onProvidersChange(providers) {
      this.aiProviders = providers;
      // Rebuild model list from updated providers
      if (providers.length > 0) {
        window.AI_MODELS = providers.flatMap(p =>
          (p.models || []).map(m => ({ label: `${p.name} › ${m}`, value: `${p.id}::${m}` }))
        );
      }
      this.providersSaving = true;
      try {
        await StorageService.saveWikiDefinitions({ wikis: this.wikiList, aiProviders: providers, encryptionKey: this.encryptionKey });
      } catch (e) {
        this.showToast('Failed to save AI settings: ' + e.message, 'error');
      }
      this.providersSaving = false;
    },

    async onCustomPromptChange(prompt) {
      const idx = this.wikiList.findIndex(w => w.wikiName === this.currentWikiName);
      if (idx < 0) {
        this.showToast('No active wiki — custom prompt not saved', 'error');
        return;
      }
      const updated = [...this.wikiList];
      updated[idx] = { ...updated[idx], aiCustomPrompt: prompt || undefined };
      this.wikiList = updated;
      try {
        await StorageService.saveWikiDefinitions({ wikis: updated, aiProviders: this.aiProviders, encryptionKey: this.encryptionKey });
        this.showToast('Custom prompt saved', 'success');
      } catch (e) {
        this.showToast('Failed to save prompt: ' + e.message, 'error');
        return;
      }
      // Recreate the chat so the new prompt takes effect immediately
      if (this.aiChat) {
        this.aiChat.destroy?.();
        this.aiChat = null;
        await this.openAiPanel();
      }
    },

    closeAnonymousShareDialog() {
      this.anonymousShareDialog.open = false;
      this.anonymousShareDialog.loading = false;
      this.anonymousShareDialog.error = '';
    },

    async openAnonymousShareDialog() {
      const doc = this.document;
      if (!doc?.id || doc.type !== 'file') return;

      this.anonymousShareDialog.open = true;
      this.anonymousShareDialog.loading = true;
      this.anonymousShareDialog.url = '';
      this.anonymousShareDialog.error = '';

      try {
        const shareInfo = await StorageService.enableAnonymousShare(doc.id);
        this.anonymousShareDialog.url = this.buildAnonymousShareUrl(doc, shareInfo.publicUrl, shareInfo.resourceKey);
      } catch (e) {
        this.anonymousShareDialog.error = 'Failed to enable anonymous share: ' + e.message;
      } finally {
        this.anonymousShareDialog.loading = false;
      }
    },

    buildAnonymousShareUrl(doc, publicUrl, resourceKey) {
      const base = new URL('share.html', window.location.href.split('#')[0]);
      base.searchParams.set('file', doc.id);
      base.searchParams.set('type', doc.docType);
      base.searchParams.set('name', doc.name || '');
      base.searchParams.set('url', publicUrl || StorageService.getAnonymousShareUrl(doc.id));
      if (resourceKey) base.searchParams.set('resourceKey', resourceKey);
      if (CONFIG.WORKER_URL) {
        const proxyUrl = new URL('/share-file', CONFIG.WORKER_URL);
        proxyUrl.searchParams.set('file', doc.id);
        if (resourceKey) proxyUrl.searchParams.set('resourceKey', resourceKey);
        base.searchParams.set('proxy', proxyUrl.toString());
      }
      if (doc.meta?.syntaxType) base.searchParams.set('syntax', doc.meta.syntaxType);
      if (doc.meta?.expiryTs) base.searchParams.set('expiry', String(doc.meta.expiryTs));
      return base.toString();
    },

    async copyAnonymousShareUrl() {
      if (!this.anonymousShareDialog.url) return;
      try {
        await navigator.clipboard.writeText(this.anonymousShareDialog.url);
        this.showToast('Anonymous share link copied', 'success');
      } catch (e) {
        this.showToast('Copy failed: ' + e.message, 'error');
      }
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
app.component('notebook-viewer', NotebookViewer);
app.component('notebook-editor', NotebookEditor);
app.component('asset-viewer', AssetViewer);
app.component('folder-viewer', FolderViewer);
app.component('ai-chat-panel', AiChatPanel);

// Mount
app.mount('#app');
