const PageView = {
  template: `
    <div>
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="spinner"></div>
      </div>
      <div v-else-if="error" class="text-red-500 py-4">{{ error }}</div>
      <div v-else-if="type === 'folder'" class="prose">
        <h1>{{ folderName }}</h1>
        <ul>
          <li v-for="item in folderItems" :key="item.id">
            <a :href="'#/' + itemPath(item)" class="flex items-center gap-2">
              <span>{{ item.isFolder ? '&#128193;' : '&#128196;' }}</span>
              {{ item.name.replace(/\\.md$/, '') }}
            </a>
          </li>
        </ul>
        <p v-if="folderItems.length === 0" class="text-slate-400 italic">This folder is empty.</p>
      </div>
      <div v-else class="prose" ref="content" v-html="renderedHtml"></div>
    </div>
  `,
  props: ['resolved', 'currentPath'],
  data() {
    return {
      loading: false,
      error: null,
      content: '',
      folderItems: [],
      renderedHtml: '',
    };
  },
  computed: {
    type() {
      return this.resolved?.type;
    },
    folderName() {
      return this.resolved?.name || 'Home';
    },
  },
  watch: {
    resolved: {
      handler() { this.load(); },
      immediate: true,
    },
  },
  methods: {
    itemPath(item) {
      const base = this.currentPath ? this.currentPath + '/' : '';
      return base + (item.isFolder ? item.name : item.name.replace(/\.md$/, ''));
    },

    async load() {
      if (!this.resolved) return;
      this.loading = true;
      this.error = null;

      try {
        if (this.type === 'folder') {
          this.folderItems = await DriveService.listFolder(this.resolved.id);
        } else if (this.type === 'file') {
          this.content = await DriveService.getFileContent(this.resolved.id);
          this.renderedHtml = this.renderMarkdown(this.content);
        }
      } catch (e) {
        this.error = e.message;
      }

      this.loading = false;

      // Run mermaid after DOM update
      await this.$nextTick();
      this.renderMermaid();
      this.interceptLinks();
    },

    renderMarkdown(md) {
      const renderer = new marked.Renderer();
      renderer.code = function ({ text, lang }) {
        if (lang === 'mermaid') {
          return `<pre class="mermaid">${text}</pre>`;
        }
        const highlighted = hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang }).value
          : hljs.highlightAuto(text).value;
        return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
      };

      marked.setOptions({
        renderer,
        gfm: true,
        breaks: false,
      });

      return marked.parse(md);
    },

    renderMermaid() {
      const el = this.$refs.content;
      if (!el) return;
      const mermaidEls = el.querySelectorAll('.mermaid');
      if (mermaidEls.length > 0 && typeof mermaid !== 'undefined') {
        mermaid.run({ nodes: mermaidEls });
      }
    },

    interceptLinks() {
      const el = this.$refs.content;
      if (!el) return;
      el.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            // Resolve relative path
            const base = this.currentPath ? this.currentPath.split('/').slice(0, -1).join('/') : '';
            const resolved = base ? base + '/' + href : href;
            window.location.hash = '#/' + resolved.replace(/\.md$/, '');
          });
        }
      });
    },
  },
};
