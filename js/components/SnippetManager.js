const SnippetManager = {
  template: `
    <div class="snippet-content-area h-full" @paste="onGlobalPaste">
        <template v-if="selectedSnippet || isCreating">
          <!-- Editor Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
            <div class="flex items-center gap-3 flex-1 min-width-0">
              <template v-if="isReadMode">
                <div class="font-medium text-sm truncate" :title="selectedSnippet?.name">{{ selectedSnippet?.name || 'Untitled' }}</div>
                <div class="text-xs uppercase tracking-wide opacity-60">{{ selectedSnippet?.type || 'markdown' }}</div>
              </template>
              <template v-else>
                <input
                  v-model="editName"
                  placeholder="Snippet name..."
                  class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded w-full max-w-xs"
                />
                <select v-model="editType" class="text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary max-h-40" style="border-color: hsl(var(--border))">
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
              </template>
            </div>
            <div class="flex items-center gap-2">
              <button @click="copyToClipboard" class="p-1.5 rounded-md hover:bg-muted" title="Copy to clipboard">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              </button>
              <button v-if="selectedSnippet" @click="deleteSnippet(selectedSnippet)" class="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete snippet">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <button v-if="isReadMode && selectedSnippet" @click="switchToEdit" class="ml-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted">Edit</button>
              <button v-if="!isReadMode" @click="saveSnippet" :disabled="saving" class="ml-2 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                <div v-if="saving" class="spinner" style="width:0.75rem; height:0.75rem; border-width:1px; border-top-color:white"></div>
                {{ selectedSnippet ? 'Update' : 'Create' }}
              </button>
              <button v-if="!isReadMode" @click="cancelEdit" class="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted">Cancel</button>
              <button @click="createNewSnippet" class="p-1.5 rounded-md hover:bg-muted" title="New Snippet">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
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
            Create New Snippet
          </button>
        </div>
    </div>
  `,
  props: ['snippetsFolderId', 'snippetId'],
  emits: ['toast', 'refresh-snippets', 'snippet-selected'],
  data() {
    return {
      selectedSnippet: null,
      isCreating: false,
      isReadMode: false,
      editName: '',
      editType: 'markdown',
      editExpiry: 1440,
      saving: false,
      editor: null,
    };
  },
  watch: {
    snippetId: {
      handler(id) {
        if (id) this.loadSnippet(id);
        else { this.selectedSnippet = null; this.isCreating = false; this.isReadMode = false; }
      },
      immediate: true
    },
    editType(newType) { if (this.editor) this.setEditorMode(newType); }
  },
  mounted() {
    this.darkModeObserver = new MutationObserver(() => this.updateEditorTheme());
    this.darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    this._loadedModes = new Set(['markdown']);
  },
  beforeUnmount() {
    if (this.editor) { this.editor.destroy(); this.editor.container.remove(); }
    if (this.darkModeObserver) this.darkModeObserver.disconnect();
  },
  methods: {
    async loadSnippet(id) {
      this.isCreating = false;
      this.isReadMode = true;
      try {
        const meta = await DriveService.getFileMetadata(id);
        this.selectedSnippet = {
            id: meta.id,
            name: meta.name,
            type: meta.appProperties?.type || 'markdown',
            duration: meta.appProperties?.duration ? parseInt(meta.appProperties.duration) : 0,
            expiryTs: meta.appProperties?.expiryTs ? parseInt(meta.appProperties.expiryTs) : 0
        };
        this.$emit('snippet-selected', this.selectedSnippet);
        this.editName = this.selectedSnippet.name;
        this.editType = this.selectedSnippet.type;
        this.editExpiry = this.selectedSnippet.duration;
        
        const content = await DriveService.getFileContent(id);
        this.$nextTick(async () => {
          this.ensureEditor();
          this.editor.setValue(content || '', -1);
          await this.setEditorMode(this.editType);
          this.editor.setReadOnly(true);
        });
      } catch (e) { this.$emit('toast', 'Error: ' + e.message, 'error'); }
    },
    createNewSnippet(initialContent = '') {
      this.selectedSnippet = null;
      this.isCreating = true;
      this.isReadMode = false;
      this.editName = '';
      this.editType = 'markdown';
      this.editExpiry = 1440;
      this.$nextTick(() => { this.ensureEditor(); this.editor.setReadOnly(false); this.editor.setValue(initialContent, -1); this.editor.focus(); });
    },
    ensureEditor() {
      if (!this.$refs.aceEditor) return;
      if (!this.editor) {
        this.editor = ace.edit(this.$refs.aceEditor);
        this.updateEditorTheme();
        this.editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true });
      }
    },
    async setEditorMode(mode) {
      if (!this.editor) return;
      const aceMode = mode === 'text' ? 'text' : mode;
      if (aceMode !== 'text' && !this._loadedModes.has(aceMode)) {
        try {
          await this.loadAceMode(aceMode);
          this._loadedModes.add(aceMode);
        } catch (e) { this.editor.session.setMode('ace/mode/text'); return; }
      }
      this.editor.session.setMode(`ace/mode/${aceMode}`);
    },
    loadAceMode(mode) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.2/mode-${mode}.min.js`;
        s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
    },
    updateEditorTheme() {
      if (!this.editor) return;
      this.editor.setTheme(document.documentElement.classList.contains('dark') ? 'ace/theme/monokai' : 'ace/theme/github');
    },
    async saveSnippet() {
      const content = this.editor.getValue();
      this.saving = true;
      try {
        const duration = this.editExpiry;
        const expiryTs = duration > 0 ? Date.now() + duration * 60000 : 0;
        if (this.selectedSnippet) {
          await DriveService.updateSnippet(this.selectedSnippet.id, this.editName, content, this.editType, expiryTs, duration);
          this.selectedSnippet = {
            ...this.selectedSnippet,
            name: this.editName,
            type: this.editType,
            duration,
            expiryTs
          };
          this.$emit('snippet-selected', this.selectedSnippet);
          this.isReadMode = true;
          this.editor.setReadOnly(true);
          this.$emit('refresh-snippets');
        } else {
          const res = await DriveService.createSnippet(this.editName || 'Untitled', content, this.editType, expiryTs, duration);
          this.$emit('refresh-snippets');
          this.isCreating = false;
          this.isReadMode = true;
          this.selectedSnippet = {
            id: res.id,
            name: this.editName || 'Untitled',
            type: this.editType,
            duration,
            expiryTs
          };
          this.$emit('snippet-selected', this.selectedSnippet);
          this.$nextTick(async () => {
            this.ensureEditor();
            this.editor.setValue(content || '', -1);
            await this.setEditorMode(this.editType);
            this.editor.setReadOnly(true);
          });
          window.location.hash = '#/_snippets/' + res.id;
        }
        this.$emit('toast', 'Saved', 'success');
      } catch (e) { this.$emit('toast', 'Error: ' + e.message, 'error'); }
      this.saving = false;
    },
    async deleteSnippet(s) {
      if (!confirm('Delete?')) return;
      try {
        await DriveService.deleteFile(s.id);
        this.$emit('refresh-snippets');
        window.location.hash = '#/_snippets';
      } catch (e) { this.$emit('toast', 'Error: ' + e.message, 'error'); }
    },
    async copyToClipboard() {
      try { await navigator.clipboard.writeText(this.editor.getValue()); this.$emit('toast', 'Copied', 'success'); } catch (e) {}
    },
    onGlobalPaste(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.classList.contains('ace_text-input')) return;
      const text = e.clipboardData.getData('text');
      if (text) { this.createNewSnippet(text); this.editExpiry = 20; }
    },
    switchToEdit() {
      this.isReadMode = false;
      this.$nextTick(() => {
        this.ensureEditor();
        this.editor.setReadOnly(false);
        this.editor.focus();
      });
    },
    cancelEdit() {
      if (this.isCreating) {
        this.selectedSnippet = null;
        this.isCreating = false;
        this.isReadMode = false;
        this.editor?.setValue('', -1);
        return;
      }
      if (this.selectedSnippet) {
        this.loadSnippet(this.selectedSnippet.id);
      }
    },
    openNewSnippet() {
      this.createNewSnippet();
    }
  }
};
