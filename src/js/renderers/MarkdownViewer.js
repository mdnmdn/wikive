const MarkdownViewer = {
  template: `
    <div>
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
        this.renderedHtml = this.renderMarkdown(this.content || '');
      } catch (e) {
        this.error = e.message;
      }
      this.loading = false;
      this.$nextTick(() => {
        this.renderMermaid();
        this.interceptLinks();
      });
    },
    renderMarkdown(md) {
      const renderer = new marked.Renderer();
      renderer.code = function ({ text, lang }) {
        if (lang === 'mermaid') return '<pre class="mermaid">' + text + '</pre>';
        const highlighted = hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang }).value
          : hljs.highlightAuto(text).value;
        return '<pre><code class="hljs language-' + (lang || 'plaintext') + '">' + highlighted + '</code></pre>';
      };
      marked.setOptions({ renderer, gfm: true, breaks: false });
      return marked.parse(md);
    },
    renderMermaid() {
      const el = this.$refs.content;
      if (!el) return;
      const nodes = el.querySelectorAll('.mermaid');
      if (nodes.length > 0 && typeof mermaid !== 'undefined') mermaid.run({ nodes });
    },
    interceptLinks() {
      const el = this.$refs.content;
      if (!el) return;
      el.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const base = this.document?.path ? this.document.path.split('/').slice(0, -1).join('/') : '';
            const resolved = base ? base + '/' + href : href;
            this.$emit('navigate', resolved.replace(/\.md$/, ''));
          });
        }
      });
    },
  },
};
