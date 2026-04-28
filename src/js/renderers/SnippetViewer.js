const SnippetViewer = {
  template: `
    <div class="snippet-content-area h-full">
      <div v-if="document">
        <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
          <div class="flex items-center gap-3 flex-1 min-width-0">
            <div class="font-medium text-sm truncate" :title="document.name">{{ document.name }}</div>
            <div class="text-xs uppercase tracking-wide opacity-60">{{ document.meta.syntaxType || 'markdown' }}</div>
            <div v-if="timeLeftLabel" class="text-xs uppercase tracking-wide font-semibold" :class="isExpiringSoon ? 'text-orange-500' : ''">{{ timeLeftLabel }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="copyToClipboard" class="p-1.5 rounded-md hover:bg-muted" title="Copy">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            </button>
          </div>
        </div>
        <div ref="aceEditor" class="ace_editor"></div>
      </div>
      <div v-else class="snippet-empty-state">
        <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
        <p class="text-lg font-medium">Select a snippet or create a new one</p>
      </div>
    </div>
  `,
  mixins: [AceMixin],
  props: ['document', 'content', 'mode', 'darkMode', 'isSharedView'],
  emits: ['toast'],
  computed: {
    timeLeftLabel() {
      const ts = this.document?.meta?.expiryTs;
      if (!ts || ts === 0) return '';
      const diff = ts - Date.now();
      if (diff <= 0) return 'Expired';
      const m = Math.floor(diff / 60000);
      if (m < 60) return m + 'm left';
      const h = Math.floor(m / 60);
      if (h < 24) return h + 'h left';
      return Math.floor(h / 24) + 'd left';
    },
    isExpiringSoon() {
      const ts = this.document?.meta?.expiryTs;
      return ts && (ts - Date.now() < 3600000);
    },
  },
  watch: {
    content: { handler() { this.loadContent(); }, immediate: true },
  },
  methods: {
    async loadContent() {
      if (!this.document || this.content == null) return;
      this.$nextTick(async () => {
        this._aceEnsure(this.$refs.aceEditor);
        this._aceEditor.setValue(this.content || '', -1);
        await this._aceSetMode(this.document.meta.syntaxType || 'markdown');
        this._aceEditor.setReadOnly(true);
      });
    },
    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(this._aceGetValue() || this.content);
        this.$emit('toast', 'Copied', 'success');
      } catch {}
    },
  },
};
