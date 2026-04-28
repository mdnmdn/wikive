const SnippetEditor = {
  template: `
    <div class="snippet-content-area h-full" @paste="onGlobalPaste">
      <div ref="aceEditor" class="ace_editor"></div>
    </div>
  `,
  inject: ['rendererState'],
  mixins: [AceMixin],
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'mode-change', 'toast'],
  data() {
    return { saving: false };
  },
  watch: {
    document: {
      handler(doc) {
        if (doc && this.rendererState) {
          this.rendererState.snippetType = doc.meta?.syntaxType || 'markdown';
          this.rendererState.snippetExpiry = doc.meta?.duration ?? 1440;
        }
      },
      immediate: true,
    },
    'rendererState.snippetType'(t) { this._aceSetMode(t); },
  },
  mounted() {
    this.$nextTick(() => {
      this._aceEnsure(this.$refs.aceEditor);
      this._aceEditor.setValue(this.content || '', -1);
      this._aceSetMode(this.rendererState?.snippetType || 'markdown');
      this._aceEditor.setReadOnly(false);
      this._aceEditor.focus();
    });
  },
  methods: {
    getContent() { return this._aceGetValue() || this.content; },
    async saveSnippet() {
      const content = this.getContent();
      const type = this.rendererState?.snippetType || 'markdown';
      const duration = this.rendererState?.snippetExpiry ?? 1440;
      const expiryTs = duration > 0 ? Date.now() + duration * 60000 : 0;
      const name = this.document?.name || 'Untitled';
      this.saving = true;
      try {
        if (this.document?.id) {
          await StorageService.updateSnippet(this.document.id, name, content, type, expiryTs, duration);
          this.$emit('toast', 'Snippet updated', 'success');
        } else {
          const res = await StorageService.createSnippet(name, content, type, expiryTs, duration);
          this.$emit('toast', 'Snippet created', 'success');
          window.location.hash = '#/_snippets/' + res.id;
        }
        this.$emit('save', { name, type, duration, expiryTs });
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
        if (this.rendererState) this.rendererState.snippetExpiry = 20;
      }
    },
  },
};
