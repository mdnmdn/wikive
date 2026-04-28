const SnippetViewer = {
  template: `
    <div class="snippet-content-area h-full">
      <div v-if="document" class="h-full">
        <div ref="aceEditor" class="ace_editor h-full"></div>
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
  mounted() {
    this.$nextTick(() => this.loadContent());
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
