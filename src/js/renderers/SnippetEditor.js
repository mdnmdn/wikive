const SnippetEditor = {
  template: `
    <div class="snippet-content-area h-full" @paste="onGlobalPaste">
      <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
        <div class="flex items-center gap-3 flex-1 min-width-0">
          <input v-model="editName" placeholder="Snippet name..." class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded w-full max-w-xs" />
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
          <button @click="saveSnippet" :disabled="saving" class="ml-2 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            <div v-if="saving" class="spinner" style="width:0.75rem; height:0.75rem; border-width:1px; border-top-color:white"></div>
            {{ document?.id ? 'Update' : 'Create' }}
          </button>
          <button @click="$emit('mode-change', 'view')" class="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted">Cancel</button>
        </div>
      </div>
      <div ref="aceEditor" class="ace_editor"></div>
    </div>
  `,
  mixins: [AceMixin],
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'mode-change', 'toast'],
  data() {
    return { editName: '', editType: 'markdown', editExpiry: 1440, saving: false };
  },
  watch: {
    document: {
      handler(doc) {
        if (doc) {
          this.editName = doc.name || '';
          this.editType = doc.meta?.syntaxType || 'markdown';
          this.editExpiry = doc.meta?.duration || 1440;
        }
      },
      immediate: true,
    },
    editType(t) { this._aceSetMode(t); },
  },
  mounted() {
    this.$nextTick(() => {
      this._aceEnsure(this.$refs.aceEditor);
      this._aceEditor.setValue(this.content || '', -1);
      this._aceSetMode(this.editType);
      this._aceEditor.setReadOnly(false);
      this._aceEditor.focus();
    });
  },
  methods: {
    getContent() { return this._aceGetValue() || this.content; },
    async saveSnippet() {
      const content = this.getContent();
      this.saving = true;
      try {
        const duration = this.editExpiry;
        const expiryTs = duration > 0 ? Date.now() + duration * 60000 : 0;
        if (this.document?.id) {
          await StorageService.updateSnippet(this.document.id, this.editName, content, this.editType, expiryTs, duration);
          this.$emit('toast', 'Snippet updated', 'success');
        } else {
          const res = await StorageService.createSnippet(this.editName || 'Untitled', content, this.editType, expiryTs, duration);
          this.$emit('toast', 'Snippet created', 'success');
          window.location.hash = '#/_snippets/' + res.id;
        }
        this.$emit('save', { name: this.editName, type: this.editType, duration, expiryTs });
      } catch (e) {
        this.$emit('toast', 'Error: ' + e.message, 'error');
      }
      this.saving = false;
    },
    onGlobalPaste(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.classList.contains('ace_text-input')) return;
      const text = e.clipboardData?.getData('text');
      if (text && !this.document?.id) {
        this._aceEditor?.setValue(text, -1);
        this.editExpiry = 20;
      }
    },
  },
};
