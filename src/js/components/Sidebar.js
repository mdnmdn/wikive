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
          <span v-if="itemDocType(item) === 'snippet'" class="ms icon" style="font-size: 1rem">code</span>
          <span v-else-if="itemDocType(item) === 'drawing'" class="ms icon" style="font-size: 1rem">gesture</span>
          <span v-else-if="itemDocType(item) === 'notebook'" class="ms icon" style="font-size: 1rem">terminal</span>
          <span v-else-if="itemDocType(item) === 'asset' && !item.isFolder" class="ms icon" style="font-size: 1rem">attach_file</span>
          <span v-else-if="!item.isFolder" class="ms icon" style="font-size: 1rem">description</span>
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
          :refresh-key="refreshKey"
        ></sidebar-tree>
      </div>
    </div>
  `,
  props: ['folderId', 'basePath', 'currentPath', 'expandPath', 'searchQuery', 'perspective', 'refreshKey'],
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
          const isSpecialFolder = item.isFolder && (item.name === '_snippets' || item.name === '_drawings' || item.name === '_assets' || item.name === '_notebooks');
          if (this.perspective === 'pages') return (dt === 'markdown' || (dt === 'folder' && !isSpecialFolder));
          if (this.perspective === 'snippets') return dt === 'snippet' || (item.isFolder && item.name === '_snippets');
          if (this.perspective === 'drawings') return dt === 'drawing' || (item.isFolder && item.name === '_drawings');
          if (this.perspective === 'notebooks') return dt === 'notebook' || (item.isFolder && item.name === '_notebooks');
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
    refreshKey() { this.loadItems(); },
  },
  methods: {
    async loadItems() {
      if (!this.folderId) return;
      this.loading = true;
      try {
        let all = await StorageService.listFolder(this.folderId);
        all = StorageService.purgeExpiredSnippets(all, this.folderId);
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
                  (this.perspective === 'notebooks' && item.name === '_notebooks') ||
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
      return item.name.replace(/\.md$/, '').replace(/\.excalidraw$/, '').replace(/\.ipynb$/, '');
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
      // For items inside _snippets, _drawings or _notebooks, use file ID in URL
      const dt = this.itemDocType(item);
      if (!item.isFolder && (dt === 'snippet' || dt === 'drawing' || dt === 'notebook')) {
        let specialFolder = '_snippets';
        if (dt === 'drawing') specialFolder = '_drawings';
        else if (dt === 'notebook') specialFolder = '_notebooks';
        window.location.hash = '#/' + specialFolder + '/' + item.id;
      } else {
        window.location.hash = '#/' + this.itemPath(item);
      }
    },
    toggleExpand(item) { this.expanded[item.id] = !this.expanded[item.id]; },
    isActive(item) {
      const dt = this.itemDocType(item);
      if (!item.isFolder && (dt === 'snippet' || dt === 'drawing' || dt === 'notebook')) {
        let specialFolder = '_snippets';
        if (dt === 'drawing') specialFolder = '_drawings';
        else if (dt === 'notebook') specialFolder = '_notebooks';
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
          <span class="ms">format_list_bulleted</span>
        </button>
        <button @click="setPerspective('pages')" class="nav-btn" :class="{ active: perspective === 'pages' }" title="Pages">
          <span class="ms">description</span>
        </button>
        <button @click="setPerspective('snippets')" class="nav-btn" :class="{ active: perspective === 'snippets' }" title="Snippets">
          <span class="ms">code</span>
        </button>
        <button @click="setPerspective('drawings')" class="nav-btn" :class="{ active: perspective === 'drawings' }" title="Drawings">
          <span class="ms">gesture</span>
        </button>
        <button @click="setPerspective('notebooks')" class="nav-btn" :class="{ active: perspective === 'notebooks' }" title="Notebooks">
          <span class="ms">terminal</span>
        </button>
        <button @click="setPerspective('assets')" class="nav-btn" :class="{ active: perspective === 'assets' }" title="Assets">
          <span class="ms">folder_open</span>
        </button>
      </div>

      <!-- Search -->
      <div v-if="!isCollapsed" class="p-3 pb-2">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="'Search ' + perspective + '...'"
          class="w-full px-2 py-1 text-xs rounded border bg-background"
          style="border-color: hsl(var(--border))"
        />
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
          :refresh-key="refreshKey"
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
            <span class="ms" style="font-size: 1.5rem">upload_file</span>
            <span>Drop files here</span>
          </div>
        </div>
        <label class="sidebar-asset-upload-btn mt-2 w-full justify-center">
          <span class="ms" style="font-size: 1rem">upload</span>
          Upload
          <input type="file" multiple class="hidden" @change="onAssetFileInput" />
        </label>
      </div>

      <!-- Collapse Toggle -->
      <button @click="$emit('toggle-collapse')" class="collapse-toggle">
        <span class="ms" :style="isCollapsed ? 'font-size:1rem;transform:rotate(180deg);display:inline-block' : 'font-size:1rem'">chevron_left</span>
      </button>
    </aside>
  `,
  props: ['rootId', 'currentPath', 'expandPath', 'isCollapsed'],
  emits: ['refresh', 'toggle-collapse', 'toast', 'assets-uploaded'],
  data() {
    return {
      searchQuery: '',
      perspective: 'all',
      refreshKey: 0,
      assetDragging: false,
      assetUploading: false,
      assetUploadCount: 0,
    };
  },
  methods: {
    refresh() { this.refreshKey++; },
    setPerspective(p) {
      this.perspective = p;
      // Navigate to the matching route
      if (p === 'snippets' && !this.currentPath.startsWith('_snippets')) window.location.hash = '#/_snippets';
      else if (p === 'drawings' && !this.currentPath.startsWith('_drawings')) window.location.hash = '#/_drawings';
      else if (p === 'notebooks' && !this.currentPath.startsWith('_notebooks')) window.location.hash = '#/_notebooks';
      else if (p === 'assets' && !this.currentPath.startsWith('_assets')) window.location.hash = '#/_assets';
      else if ((p === 'all' || p === 'pages') && (this.currentPath.startsWith('_snippets') || this.currentPath.startsWith('_drawings') || this.currentPath.startsWith('_notebooks') || this.currentPath.startsWith('_assets'))) window.location.hash = '#/';
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
        const folderId = await StorageService.getAssetsFolderId();
        for (const file of files) {
          try {
            let name = file.name;
            if (!name || name === 'image.png') { const ext = file.type.split('/')[1] || 'bin'; name = 'pasted-' + Date.now() + '.' + ext; }
            await StorageService.uploadBinary(name, folderId, file, file.type || 'application/octet-stream');
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
