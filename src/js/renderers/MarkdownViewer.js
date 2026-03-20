const MarkdownViewer = {
  template: `
    <div class="px-10 py-8">
      <div v-if="loading" class="flex items-center justify-center py-12"><div class="spinner"></div></div>
      <div v-else-if="error" class="text-red-500 py-4">{{ error }}</div>
      <div v-else class="prose" ref="content" v-html="renderedHtml"></div>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['navigate', 'toast'],
  data() {
    return { loading: false, error: null, renderedHtml: '' };
  },
  watch: {
    content: { handler() { this.render(); }, immediate: true },
    document: { handler() { this.render(); } },
  },
  methods: {
    render() {
      if (!this.content && !this.document) return;
      this.loading = true;
      this.error = null;
      try {
        this.renderedHtml = MarkdownService.render(this.content || '');
      } catch (e) {
        this.error = e.message;
      }
      this.loading = false;
      this.$nextTick(() => {
        MarkdownService.renderMermaid(this.$refs.content);
        MarkdownService.interceptLinks(this.$refs.content, this.document?.path, (path) => this.$emit('navigate', path));
      });
    },
  },
};
