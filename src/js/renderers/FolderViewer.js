const FolderViewer = {
  template: `
    <div class="px-10 py-8">
      <div v-if="loading" class="flex items-center justify-center py-12"><div class="spinner"></div></div>
      <!-- If folder has a default page (home.md / index.md), render it as markdown -->
      <template v-else-if="defaultPageContent !== null">
        <div class="prose" ref="mdContent" v-html="renderedHtml"></div>
      </template>
      <!-- Otherwise show folder contents as cards -->
      <template v-else>
        <div v-if="folderItems.length === 0" class="text-center py-12" style="color: hsl(var(--muted-foreground))">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          <p class="text-sm">{{ isSnippetsFolder ? 'No snippets yet.' : 'This folder is empty.' }}</p>
        </div>

        <div v-else class="doc-grid">
          <!-- Snippet card -->
          <template v-if="isSnippetsFolder">
            <a v-for="item in folderItems" :key="item.id" :href="'#/_snippets/' + item.id" class="doc-card block p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-5 h-5 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                <span class="font-medium text-sm truncate flex-1">{{ item.name }}</span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="item.appProperties?.type" class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style="background: hsl(var(--muted)); color: hsl(var(--muted-foreground))">{{ item.appProperties.type }}</span>
                <span v-if="expiryLabel(item)" class="text-[10px] uppercase tracking-wide font-semibold" :class="isExpiringSoon(item) ? 'text-orange-500' : ''" style="color: hsl(var(--muted-foreground))">{{ expiryLabel(item) }}</span>
                <span v-if="item.modifiedTime" class="text-xs ml-auto" style="color: hsl(var(--muted-foreground))">{{ formatDate(item.modifiedTime) }}</span>
              </div>
            </a>
          </template>

          <!-- Generic folder/drawing/markdown cards -->
          <template v-else>
            <a v-for="item in folderItems" :key="item.id" :href="'#/' + itemPath(item)" class="doc-card block p-4">
              <div class="flex items-center gap-3 mb-2">
                <svg v-if="item.isFolder" class="w-5 h-5 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                <svg v-else-if="item.name.endsWith('.excalidraw')" class="w-5 h-5 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4h16v12H4zM8 20h8"/></svg>
                <svg v-else class="w-5 h-5 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span class="font-medium text-sm truncate">{{ displayName(item) }}</span>
              </div>
              <div v-if="item.modifiedTime" class="text-xs" style="color: hsl(var(--muted-foreground))">{{ formatDate(item.modifiedTime) }}</div>
            </a>
          </template>
        </div>
      </template>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['navigate', 'toast', 'create-snippet', 'create-drawing'],
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
    isSnippetsFolder() { return this.document?.path === '_snippets'; },
    isDrawingsFolder() { return this.document?.path === '_drawings'; },
    isSpecialFolder() { return ['_snippets', '_drawings', '_assets'].includes(this.document?.path); },
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
    expiryLabel(item) {
      const ts = item.appProperties?.expiryTs ? parseInt(item.appProperties.expiryTs) : 0;
      if (!ts) return '';
      const diff = ts - Date.now();
      if (diff <= 0) return 'Expired';
      const m = Math.floor(diff / 60000);
      if (m < 60) return m + 'm left';
      const h = Math.floor(m / 60);
      if (h < 24) return h + 'h left';
      return Math.floor(h / 24) + 'd left';
    },
    isExpiringSoon(item) {
      const ts = item.appProperties?.expiryTs ? parseInt(item.appProperties.expiryTs) : 0;
      return ts && (ts - Date.now() < 3600000);
    },
    async load() {
      if (!this.document?.id) return;
      this.loading = true;
      this.defaultPageContent = null;
      this.defaultPageId = null;
      try {
        let items = await StorageService.listFolder(this.document.id);
        if (this.isSnippetsFolder) items = StorageService.purgeExpiredSnippets(items, this.document.id);
        this.folderItems = items;

        // Check for home.md or index.md
        const defaultFile = items.find(f => !f.isFolder && (f.name === 'home.md' || f.name === 'index.md'));
        if (defaultFile) {
          this.defaultPageId = defaultFile.id;
          this.defaultPageContent = await StorageService.getFileContent(defaultFile.id);
          this.renderedHtml = MarkdownService.render(this.defaultPageContent);
          this.$nextTick(() => {
            MarkdownService.renderMermaid(this.$refs.mdContent);
            MarkdownService.interceptLinks(this.$refs.mdContent, this.document?.path, (path) => this.$emit('navigate', path));
          });
        }
      } catch (e) {
        this.$emit('toast', 'Error: ' + e.message, 'error');
      }
      this.loading = false;
    },
    async createDefaultPage() {
      if (!this.document?.id) return;
      this.creatingPage = true;
      try {
        const fileName = 'home.md';
        const initialContent = '# ' + this.folderName + '\n\nStart writing here...\n';
        await StorageService.createFile(fileName, this.document.id, initialContent);
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
