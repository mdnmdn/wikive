const SnippetManager = {
  template: `
    <div class="snippet-manager" @paste="onGlobalPaste">
      <!-- Left Sidebar: Snippet List -->
      <div class="snippet-list-sidebar">
        <div class="p-3 border-b" style="border-color: hsl(var(--border))">
          <div class="flex items-center gap-2 mb-3">
            <h1 class="text-lg font-bold flex-1" style="color: hsl(var(--foreground))">Snippets</h1>
            <button @click="createNewSnippet" class="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90" title="New Snippet">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search snippets..."
            class="w-full px-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-primary"
            style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))"
          />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div v-if="loading" class="flex justify-center py-8">
            <div class="spinner"></div>
          </div>
          <div v-else-if="filteredSnippets.length === 0" class="text-center py-8 text-sm" style="color: hsl(var(--muted-foreground))">
            No snippets found.
          </div>
          <div
            v-for="s in filteredSnippets"
            :key="s.id"
            class="snippet-item"
            :class="{ 'active': selectedSnippet && selectedSnippet.id === s.id }"
            @click="selectSnippet(s)"
          >
            <div class="font-medium text-sm truncate" :title="s.name">{{ s.name }}</div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <div class="text-[10px] uppercase tracking-wider whitespace-nowrap" style="color: hsl(var(--muted-foreground))">
                {{ formatRelativeDate(s.modifiedTime) }}
              </div>
              <div class="text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap" :class="isExpiringSoon(s.expiryTs) ? 'text-orange-500' : 'text-primary'">
                {{ formatTimeLeft(s.expiryTs) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Area: Editor/View -->
      <div class="snippet-content-area">
        <template v-if="selectedSnippet || isCreating">
          <!-- Editor Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
            <div class="flex items-center gap-3 flex-1 min-width-0">
              <input
                v-model="editName"
                placeholder="Snippet name..."
                class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded w-full max-w-xs"
              />
              <select v-model="editType" class="text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto max-h-40" style="border-color: hsl(var(--border))">
                <optgroup label="Common">
                  <option value="markdown">Markdown</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="sh">Bash/Shell</option>
                </optgroup>
                <optgroup label="Languages">
                  <option value="c_cpp">C / C++</option>
                  <option value="csharp">C#</option>
                  <option value="golang">Go</option>
                  <option value="java">Java</option>
                  <option value="php">PHP</option>
                  <option value="ruby">Ruby</option>
                  <option value="rust">Rust</option>
                  <option value="typescript">TypeScript</option>
                  <option value="dart">Dart</option>
                  <option value="kotlin">Kotlin</option>
                  <option value="swift">Swift</option>
                  <option value="clojure">Clojure</option>
                  <option value="elixir">Elixir</option>
                  <option value="haskell">Haskell</option>
                  <option value="lua">Lua</option>
                  <option value="perl">Perl</option>
                  <option value="r">R</option>
                  <option value="scala">Scala</option>
                </optgroup>
                <optgroup label="Markup & Config">
                  <option value="xml">XML</option>
                  <option value="powershell">PowerShell</option>
                  <option value="sql">SQL</option>
                  <option value="latex">LaTeX</option>
                  <option value="dockerfile">Dockerfile</option>
                  <option value="nginx">Nginx</option>
                  <option value="toml">TOML</option>
                  <option value="ini">INI</option>
                  <option value="vbscript">VBScript</option>
                  <option value="text">Plain Text</option>
                </optgroup>
              </select>
              <select v-model="editExpiry" class="text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary" style="border-color: hsl(var(--border))">
                <option :value="5">5 minutes</option>
                <option :value="20">20 minutes</option>
                <option :value="60">1 hour</option>
                <option :value="1440">1 day</option>
                <option :value="10080">1 week</option>
                <option :value="0">No expiration</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <button @click="copyToClipboard" class="p-1.5 rounded-md hover:bg-muted" title="Copy to clipboard">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              </button>
              <button v-if="selectedSnippet" @click="deleteSnippet(selectedSnippet)" class="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete snippet">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <button @click="saveSnippet" :disabled="saving" class="ml-2 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                <div v-if="saving" class="spinner" style="width:0.75rem; height:0.75rem; border-width:1px; border-top-color:white"></div>
                {{ selectedSnippet ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
          <!-- Ace Editor Container -->
          <div ref="aceEditor" class="ace_editor"></div>
        </template>
        <div v-else class="snippet-empty-state">
          <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          <p class="text-lg font-medium">Select a snippet or create a new one</p>
          <p class="text-sm opacity-60">You can also paste text directly to create a 20min snippet</p>
          <button @click="createNewSnippet" class="mt-6 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            Create First Snippet
          </button>
        </div>
      </div>
    </div>
  `,
  props: ['snippetsFolderId'],
  emits: ['toast'],
  data() {
    return {
      snippets: [],
      loading: false,
      saving: false,
      searchQuery: '',
      selectedSnippet: null,
      isCreating: false,
      editName: '',
      editType: 'markdown',
      editExpiry: 1440, // 1 day default
      editor: null,
      cleanupTimer: null,
    };
  },
  computed: {
    filteredSnippets() {
      const query = this.searchQuery.toLowerCase().trim();
      if (!query) return this.snippets;
      return this.snippets.filter(s => s.name.toLowerCase().includes(query));
    },
  },
  watch: {
    snippetsFolderId: {
      handler(id) {
        if (id) {
          this.loadSnippets();
          this.startCleanupTimer();
        }
      },
      immediate: true,
    },
    editType(newType) {
      if (this.editor) {
        this.setEditorMode(newType);
      }
    },
  },
  mounted() {
    this.initAce();
    // Watch for dark mode changes
    this.darkModeObserver = new MutationObserver(() => this.updateEditorTheme());
    this.darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    this._loadedModes = new Set(['markdown']); // Track loaded Ace modes
  },
  beforeUnmount() {
    if (this.editor) {
      this.editor.destroy();
      this.editor.container.remove();
    }
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.darkModeObserver) this.darkModeObserver.disconnect();
  },
  methods: {
    initAce() {
      // Ace will be initialized when needed
    },

    async setEditorMode(mode) {
      if (!this.editor) return;
      const aceMode = mode === 'text' ? 'text' : mode;
      
      if (aceMode !== 'text' && !this._loadedModes.has(aceMode)) {
        try {
          await this.loadAceMode(aceMode);
          this._loadedModes.add(aceMode);
        } catch (e) {
          console.error(`Failed to load Ace mode: ${aceMode}`, e);
          // Fallback to text if mode fails to load
          this.editor.session.setMode('ace/mode/text');
          return;
        }
      }
      this.editor.session.setMode(`ace/mode/${aceMode}`);
    },

    loadAceMode(mode) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.2/mode-${mode}.min.js`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    updateEditorTheme() {
      if (!this.editor) return;
      const isDark = document.documentElement.classList.contains('dark');
      this.editor.setTheme(isDark ? 'ace/theme/monokai' : 'ace/theme/github');
    },

    async loadSnippets() {
      if (!this.snippetsFolderId) return;
      this.loading = true;
      try {
        this.snippets = await DriveService.listSnippets(this.snippetsFolderId);
        // Deferred cleanup
        setTimeout(() => this.cleanExpiredSnippets(), 1000);
      } catch (e) {
        this.$emit('toast', 'Failed to load snippets: ' + e.message, 'error');
      }
      this.loading = false;
    },

    async selectSnippet(snippet) {
      this.isCreating = false;
      this.selectedSnippet = snippet;
      this.editName = snippet.name;
      this.editType = snippet.type;
      this.editExpiry = snippet.duration || 0;

      this.loading = true;
      try {
        const content = await DriveService.getFileContent(snippet.id);
        this.$nextTick(async () => {
          this.ensureEditor();
          this.editor.setValue(content, -1);
          await this.setEditorMode(this.editType);
        });
      } catch (e) {
        this.$emit('toast', 'Failed to load content: ' + e.message, 'error');
      }
      this.loading = false;
    },

    createNewSnippet(initialContent = '') {
      this.selectedSnippet = null;
      this.isCreating = true;
      this.editName = '';
      this.editType = 'markdown';
      this.editExpiry = 1440;

      this.$nextTick(() => {
        this.ensureEditor();
        this.editor.setValue(initialContent, -1);
        this.editor.focus();
      });
    },

    ensureEditor() {
      if (!this.$refs.aceEditor) return;
      if (!this.editor) {
        this.editor = ace.edit(this.$refs.aceEditor);
        this.updateEditorTheme();
        this.editor.setOptions({
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
        });
      }
    },

    async saveSnippet() {
      const content = this.editor.getValue();
      if (!content && !this.editName) {
        this.$emit('toast', 'Cannot save empty snippet', 'error');
        return;
      }

      this.saving = true;
      try {
        const duration = this.editExpiry;
        const expiryTs = duration > 0 ? Date.now() + duration * 60000 : 0;
        
        if (this.selectedSnippet) {
          await DriveService.updateSnippet(this.selectedSnippet.id, this.editName, content, this.editType, expiryTs, duration);
          this.$emit('toast', 'Snippet updated', 'success');
        } else {
          await DriveService.createSnippet(this.editName, content, this.editType, expiryTs, duration);
          this.$emit('toast', 'Snippet created', 'success');
        }
        
        await this.loadSnippets();
        this.isCreating = false;
        // Select the newest snippet
        if (this.snippets.length > 0) {
          this.selectSnippet(this.snippets[0]);
        }
      } catch (e) {
        this.$emit('toast', 'Failed to save: ' + e.message, 'error');
      }
      this.saving = false;
    },

    async deleteSnippet(snippet) {
      if (!confirm(`Delete snippet "${snippet.name}"?`)) return;
      try {
        await DriveService.deleteFile(snippet.id);
        this.$emit('toast', 'Snippet deleted', 'success');
        if (this.selectedSnippet && this.selectedSnippet.id === snippet.id) {
          this.selectedSnippet = null;
          this.isCreating = false;
        }
        await this.loadSnippets();
      } catch (e) {
        this.$emit('toast', 'Failed to delete: ' + e.message, 'error');
      }
    },

    async copyToClipboard() {
      if (!this.editor) return;
      try {
        await navigator.clipboard.writeText(this.editor.getValue());
        this.$emit('toast', 'Copied to clipboard', 'success');
      } catch (e) {
        this.$emit('toast', 'Failed to copy', 'error');
      }
    },

    onGlobalPaste(e) {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.classList.contains('ace_text-input')) {
        return;
      }

      const text = e.clipboardData.getData('text');
      if (text) {
        this.createNewSnippet(text);
        this.editExpiry = 20; 
        this.$emit('toast', 'Created 20min snippet from paste', 'info');
      }
    },

    formatRelativeDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return date.toLocaleDateString();
    },

    formatTimeLeft(expiryTs) {
      if (!expiryTs || expiryTs === 0) return 'No expiration';
      const now = Date.now();
      const diff = expiryTs - now;
      if (diff <= 0) return 'Expired';
      
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    },

    isExpiringSoon(expiryTs) {
      if (!expiryTs) return false;
      const diff = expiryTs - Date.now();
      return diff > 0 && diff < 3600000;
    },

    async cleanExpiredSnippets() {
      const expired = this.snippets.filter(s => s.expiryTs > 0 && s.expiryTs < Date.now());
      if (expired.length === 0) return;
      
      for (const s of expired) {
        try {
          await DriveService.deleteFile(s.id);
        } catch (e) {
          console.error('Failed to delete expired snippet', s.name, e);
        }
      }
      await this.loadSnippets();
    },

    startCleanupTimer() {
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      this.cleanupTimer = setInterval(() => {
        this.cleanExpiredSnippets();
      }, 5 * 60000);
    }
  }
};
