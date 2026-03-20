const FolderViewer = {
  template: `
    <div>
      <div v-if="loading" class="flex items-center justify-center py-12"><div class="spinner"></div></div>
      <!-- If folder has a default page (home.md / index.md), render it as markdown -->
      <template v-else-if="defaultPageContent !== null">
        <div class="prose" ref="mdContent" v-html="renderedHtml"></div>
      </template>
      <!-- Otherwise show folder contents as cards -->
      <template v-else>
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold" style="color: hsl(var(--foreground))">{{ folderName }}</h1>
          <button @click="createDefaultPage" :disabled="creatingPage" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition-colors disabled:opacity-50" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">
            <template v-if="creatingPage">
              <div class="spinner" style="width:0.875rem;height:0.875rem;border-width:1px;border-color:hsl(var(--primary-foreground)/0.3);border-top-color:hsl(var(--primary-foreground))"></div>
              Creating…
            </template>
            <template v-else>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Create Page
            </template>
          </button>
        </div>
        <div v-if="folderItems.length === 0" class="text-center py-12" style="color: hsl(var(--muted-foreground))">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          <p class="text-sm">This folder is empty.</p>
        </div>
        <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
          <a
            v-for="item in folderItems"
            :key="item.id"
            :href="'#/' + itemPath(item)"
            class="block border rounded-lg p-4 hover:shadow-md transition-shadow"
            style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))"
          >
            <div class="flex items-center gap-3 mb-2">
              <svg v-if="item.isFolder" class="w-6 h-6 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              <svg v-else-if="item.name.endsWith('.excalidraw')" class="w-6 h-6 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4h16v12H4zM8 20h8"/></svg>
              <svg v-else class="w-6 h-6 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="font-medium text-sm truncate">{{ displayName(item) }}</span>
            </div>
            <div v-if="item.modifiedTime" class="text-xs" style="color: hsl(var(--muted-foreground))">{{ formatDate(item.modifiedTime) }}</div>
          </a>
        </div>
      </template>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['navigate', 'toast'],
  data() {
    return {
      folderItems: [],
      loading: false,
      defaultPageContent: null,
      defaultPageId: null,
      renderedHtml: '',
      creatingPage: false,
    };
  },
  computed: {
    folderName() { return this.document?.name || 'Home'; },
  },
  watch: {
    document: { handler() { this.load(); }, immediate: true },
  },
  methods: {
    itemPath(item) {
      const base = this.document?.path ? this.document.path + '/' : '';
      const docPath = this.document?.path || '';
      if (docPath.startsWith('_snippets') || docPath.startsWith('_drawings')) {
        if (!item.isFolder) return docPath + '/' + item.id;
      }
      return base + (item.isFolder ? item.name : item.name.replace(/\.md$/, ''));
    },
    displayName(item) {
      return item.name.replace(/\.md$/, '').replace(/\.excalidraw$/, '');
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return d.toLocaleDateString();
    },
    async load() {
      if (!this.document?.id) return;
      this.loading = true;
      this.defaultPageContent = null;
      this.defaultPageId = null;
      try {
        const items = await DriveService.listFolder(this.document.id);
        this.folderItems = items;

        // Check for home.md or index.md
        const defaultFile = items.find(f => !f.isFolder && (f.name === 'home.md' || f.name === 'index.md'));
        if (defaultFile) {
          this.defaultPageId = defaultFile.id;
          this.defaultPageContent = await DriveService.getFileContent(defaultFile.id);
          this.renderedHtml = this.renderMarkdown(this.defaultPageContent);
          this.$nextTick(() => {
            this.renderMermaid();
            this.interceptLinks();
          });
        }
      } catch (e) {
        this.$emit('toast', 'Error: ' + e.message, 'error');
      }
      this.loading = false;
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
      const el = this.$refs.mdContent;
      if (!el) return;
      const nodes = el.querySelectorAll('.mermaid');
      if (nodes.length > 0 && typeof mermaid !== 'undefined') mermaid.run({ nodes });
    },
    interceptLinks() {
      const el = this.$refs.mdContent;
      if (!el) return;
      el.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const base = this.document?.path || '';
            const resolved = base ? base + '/' + href : href;
            this.$emit('navigate', resolved.replace(/\.md$/, ''));
          });
        }
      });
    },
    async createDefaultPage() {
      if (!this.document?.id) return;
      this.creatingPage = true;
      try {
        const fileName = 'home.md';
        const initialContent = '# ' + this.folderName + '\n\nStart writing here...\n';
        await DriveService.createFile(fileName, this.document.id, initialContent);
        CacheService.remove('listing:' + this.document.id);
        this.$emit('toast', 'Page created', 'success');
        await this.load();
      } catch (e) {
        this.$emit('toast', 'Failed to create page: ' + e.message, 'error');
      }
      this.creatingPage = false;
    },
  },
};
