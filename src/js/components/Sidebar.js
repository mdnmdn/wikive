const SidebarTree = {
  name: 'sidebar-tree',
  template: `
    <div class="tree-children">
      <div v-for="item in filteredItems" :key="item.id">
        <div
          class="tree-item"
          :class="{ active: isActive(item) }"
          @click="navigateDocument(item)"
        >
          <template v-if="item.isFolder">
            <svg
              class="icon chevron-icon"
              :class="{ 'transform rotate-90': expanded[item.id] }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style="width: 1rem; height: 1rem; transition: transform 0.2s; flex-shrink: 0; cursor: pointer"
              @click.stop="toggleExpand(item)"
            ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </template>
          <!-- docType icon -->
          <svg v-if="itemDocType(item) === 'snippet'" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 1rem; height: 1rem; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          <svg v-else-if="itemDocType(item) === 'drawing'" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 1rem; height: 1rem; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v12H4zM8 20h8"/></svg>
          <svg v-else-if="itemDocType(item) === 'asset' && !item.isFolder" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 1rem; height: 1rem; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
          <svg v-else-if="!item.isFolder" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 1rem; height: 1rem; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span class="truncate">{{ displayName(item) }}</span>
          <!-- expiry badge for snippets -->
          <span v-if="itemDocType(item) === 'snippet' && item.appProperties?.expiryTs" class="ml-auto text-[9px] uppercase tracking-wider font-semibold" :class="isExpiringSoon(item.appProperties.expiryTs) ? 'text-orange-500' : 'opacity-50'">{{ formatTimeLeft(item.appProperties?.expiryTs) }}</span>
        </div>
        <sidebar-tree
          v-if="item.isFolder && expanded[item.id]"
          :folder-id="item.id"
          :base-path="itemPath(item)"
          :current-path="currentPath"
          :expand-path="expandPath"
          :search-query="searchQuery"
          :perspective="perspective"
        ></sidebar-tree>
      </div>
    </div>
  `,
  props: ['folderId', 'basePath', 'currentPath', 'expandPath', 'searchQuery', 'perspective'],
  data() {
    return { items: [], loading: false, expanded: {} };
  },
  computed: {
    filteredItems() {
      let result = this.items;

      // Perspective filter
      if (this.perspective && this.perspective !== 'all') {
        result = result.filter(item => {
          const dt = this.itemDocType(item);
          const isSpecialFolder = item.isFolder && (item.name === '_snippets' || item.name === '_drawings' || item.name === '_assets');
          if (this.perspective === 'pages') return (dt === 'markdown' || (dt === 'folder' && !isSpecialFolder));
          if (this.perspective === 'snippets') return dt === 'snippet' || (item.isFolder && item.name === '_snippets');
          if (this.perspective === 'drawings') return dt === 'drawing' || (item.isFolder && item.name === '_drawings');
          if (this.perspective === 'assets') return dt === 'asset' || (item.isFolder && item.name === '_assets');
          return true;
        });
      }

      // Search filter
      if (this.searchQuery && this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(item => item.name.toLowerCase().includes(query));
      }

      return result;
    },
  },
  async mounted() { await this.loadItems(); },
  watch: {
    folderId() { this.loadItems(); },
    perspective() { this.loadItems(); },
  },
  methods: {
    async loadItems() {
      if (!this.folderId) return;
      this.loading = true;
      try {
        const all = await DriveService.listFolder(this.folderId);
        // At root level, show special folders; deduplicate folder+file with same base name
        const deduped = {};
        for (const item of all) {
          const baseName = item.isFolder ? item.name : item.name.replace(/\.md$/, '');
          if (!deduped[baseName] || (item.isFolder && !deduped[baseName].isFolder)) {
            deduped[baseName] = item;
          }
        }
        this.items = Object.values(deduped);
        for (const item of this.items) {
          if (item.isFolder) {
            const ip = this.itemPath(item);
            // Auto-expand for expandPath
            if (this.expandPath && (this.expandPath.startsWith(ip + '/') || this.expandPath === ip)) {
              this.expanded[item.id] = true;
            }
            // Auto-expand special folders when matching perspective is active
            if (this.perspective && this.basePath === '') {
              if ((this.perspective === 'snippets' && item.name === '_snippets') ||
                  (this.perspective === 'drawings' && item.name === '_drawings') ||
                  (this.perspective === 'assets' && item.name === '_assets')) {
                this.expanded[item.id] = true;
              }
            }
          }
        }
      } catch (e) { console.error(e); }
      this.loading = false;
    },
    displayName(item) {
      return item.name.replace(/\.md$/, '').replace(/\.excalidraw$/, '');
    },
    itemPath(item) {
      const base = this.basePath ? this.basePath + '/' : '';
      return base + (item.isFolder ? item.name : item.name.replace(/\.md$/, ''));
    },
    itemDocType(item) {
      const path = this.itemPath(item);
      return DocumentService.resolveDocumentType(item, path);
    },
    navigateDocument(item) {
      // For items inside _snippets or _drawings, use file ID in URL
      const dt = this.itemDocType(item);
      if (!item.isFolder && (dt === 'snippet' || dt === 'drawing')) {
        const specialFolder = dt === 'snippet' ? '_snippets' : '_drawings';
        window.location.hash = '#/' + specialFolder + '/' + item.id;
      } else {
        window.location.hash = '#/' + this.itemPath(item);
      }
    },
    toggleExpand(item) { this.expanded[item.id] = !this.expanded[item.id]; },
    isActive(item) {
      const dt = this.itemDocType(item);
      if (!item.isFolder && (dt === 'snippet' || dt === 'drawing')) {
        const specialFolder = dt === 'snippet' ? '_snippets' : '_drawings';
        return this.currentPath === specialFolder + '/' + item.id;
      }
      return this.currentPath === this.itemPath(item);
    },
    formatTimeLeft(expiryTs) {
      if (!expiryTs || expiryTs === '0' || expiryTs === 0) return '';
      const ts = typeof expiryTs === 'string' ? parseInt(expiryTs) : expiryTs;
      const diff = ts - Date.now();
      if (diff <= 0) return 'Exp';
      const m = Math.floor(diff / 60000);
      if (m < 60) return m + 'm';
      const h = Math.floor(m / 60);
      if (h < 24) return h + 'h';
      return Math.floor(h / 24) + 'd';
    },
    isExpiringSoon(expiryTs) {
      const ts = typeof expiryTs === 'string' ? parseInt(expiryTs) : expiryTs;
      return ts && (ts - Date.now() < 3600000);
    },
  },
};

const Sidebar = {
  template: `
    <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
      <!-- Perspective Filters -->
      <div class="p-2 flex items-center justify-around border-b" style="border-color: hsl(var(--border))">
        <button @click="setPerspective('all')" class="nav-btn" :class="{ active: perspective === 'all' }" title="All">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
        </button>
        <button @click="setPerspective('pages')" class="nav-btn" :class="{ active: perspective === 'pages' }" title="Pages">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
        </button>
        <button @click="setPerspective('snippets')" class="nav-btn" :class="{ active: perspective === 'snippets' }" title="Snippets">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
        </button>
        <button @click="setPerspective('drawings')" class="nav-btn" :class="{ active: perspective === 'drawings' }" title="Drawings">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v12H4zM8 20h8"/></svg>
        </button>
        <button @click="setPerspective('assets')" class="nav-btn" :class="{ active: perspective === 'assets' }" title="Assets">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        </button>
      </div>

      <!-- Search & Refresh -->
      <div v-if="!isCollapsed" class="p-3 pb-2">
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="'Search ' + perspective + '...'"
            class="flex-1 px-2 py-1 text-xs rounded border bg-background"
            style="border-color: hsl(var(--border))"
          />
          <button @click="$emit('refresh')" class="p-1 opacity-50 hover:opacity-100"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
        </div>
      </div>

      <!-- Unified Tree -->
      <div v-if="!isCollapsed" class="flex-1 flex flex-col overflow-y-auto">
        <sidebar-tree
          v-if="rootId"
          :folder-id="rootId"
          base-path=""
          :current-path="currentPath"
          :expand-path="expandPath"
          :search-query="searchQuery"
          :perspective="perspective"
        ></sidebar-tree>
      </div>

      <!-- Upload drop zone for assets perspective -->
      <div v-if="!isCollapsed && perspective === 'assets'" class="p-3 border-t" style="border-color: hsl(var(--border))">
        <div
          class="sidebar-asset-drop"
          :class="{ 'sidebar-asset-drop-active': assetDragging }"
          @dragover.prevent="assetDragging = true"
          @dragleave.prevent="assetDragging = false"
          @drop.prevent="onAssetDrop"
        >
          <div v-if="assetUploading" class="flex flex-col items-center gap-2 text-xs">
            <div class="spinner"></div>
            <span>Uploading {{ assetUploadCount }} file(s)...</span>
          </div>
          <div v-else class="flex flex-col items-center gap-2 text-xs opacity-70">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            <span>Drop files here</span>
          </div>
        </div>
        <label class="sidebar-asset-upload-btn mt-2 w-full justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Upload
          <input type="file" multiple class="hidden" @change="onAssetFileInput" />
        </label>
      </div>

      <!-- Collapse Toggle -->
      <button @click="$emit('toggle-collapse')" class="collapse-toggle">
        <svg class="w-4 h-4" :class="{ 'rotate-180': isCollapsed }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
      </button>
    </aside>
  `,
  props: ['rootId', 'currentPath', 'expandPath', 'isCollapsed'],
  emits: ['refresh', 'toggle-collapse', 'toast', 'assets-uploaded'],
  data() {
    return {
      searchQuery: '',
      perspective: 'all',
      assetDragging: false,
      assetUploading: false,
      assetUploadCount: 0,
    };
  },
  watch: {
    currentPath: {
      handler(path) {
        // Auto-switch perspective based on route
        if (path && path.startsWith('_snippets')) this.perspective = 'snippets';
        else if (path && path.startsWith('_drawings')) this.perspective = 'drawings';
        else if (path && path.startsWith('_assets')) this.perspective = 'assets';
      },
      immediate: true,
    },
  },
  methods: {
    setPerspective(p) {
      this.perspective = p;
      // Navigate to the matching route
      if (p === 'snippets' && !this.currentPath.startsWith('_snippets')) window.location.hash = '#/_snippets';
      else if (p === 'drawings' && !this.currentPath.startsWith('_drawings')) window.location.hash = '#/_drawings';
      else if (p === 'assets' && !this.currentPath.startsWith('_assets')) window.location.hash = '#/_assets';
      else if ((p === 'all' || p === 'pages') && (this.currentPath.startsWith('_snippets') || this.currentPath.startsWith('_drawings') || this.currentPath.startsWith('_assets'))) window.location.hash = '#/';
    },
    onAssetFileInput(e) {
      const files = Array.from(e.target.files || []);
      if (files.length) this.uploadAssetFiles(files);
      e.target.value = '';
    },
    onAssetDrop(e) {
      this.assetDragging = false;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) this.uploadAssetFiles(files);
    },
    async uploadAssetFiles(files) {
      if (!files.length) return;
      this.assetUploading = true;
      this.assetUploadCount = files.length;
      let success = 0;
      try {
        const folderId = await DriveService.getAssetsFolderId();
        for (const file of files) {
          try {
            let name = file.name;
            if (!name || name === 'image.png') { const ext = file.type.split('/')[1] || 'bin'; name = 'pasted-' + Date.now() + '.' + ext; }
            await DriveService.uploadBinary(name, folderId, file, file.type || 'application/octet-stream');
            success++;
          } catch (e) { this.$emit('toast', 'Failed to upload ' + file.name + ': ' + e.message, 'error'); }
        }
        if (success > 0) {
          CacheService.remove('listing:' + folderId);
          this.$emit('toast', success + ' file(s) uploaded', 'success');
          this.$emit('assets-uploaded');
        }
      } catch (e) { this.$emit('toast', 'Upload failed: ' + e.message, 'error'); }
      this.assetUploading = false;
      this.assetUploadCount = 0;
    },
  },
  components: { 'sidebar-tree': SidebarTree },
};
