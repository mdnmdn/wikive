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
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style="width: 1rem; height: 1rem; transition: transform 0.2s; flex-shrink: 0; cursor: pointer"
              @click.stop="toggleExpand(item)"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </template>
          <svg
            v-else
            class="icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style="width: 1rem; height: 1rem; flex-shrink: 0"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span class="truncate">{{ displayName(item) }}</span>
        </div>
        <sidebar-tree
          v-if="item.isFolder && expanded[item.id]"
          :folder-id="item.id"
          :base-path="itemPath(item)"
          :current-path="currentPath"
          :expand-path="expandPath"
          :search-query="searchQuery"
        ></sidebar-tree>
      </div>
    </div>
  `,
  props: ['folderId', 'basePath', 'currentPath', 'expandPath', 'searchQuery'],
  data() {
    return {
      items: [],
      loading: false,
      expanded: {},
    };
  },
  computed: {
    filteredItems() {
      if (!this.searchQuery || !this.searchQuery.trim()) return this.items;
      const query = this.searchQuery.toLowerCase();
      return this.items.filter(item => item.name.toLowerCase().includes(query));
    },
  },
  async mounted() {
    await this.loadItems();
  },
  watch: {
    folderId() { this.loadItems(); },
  },
  methods: {
    async loadItems() {
      if (!this.folderId) return;
      this.loading = true;
      try {
        const all = await DriveService.listFolder(this.folderId);
        let items = this.basePath === '' ? all.filter(f => f.name !== '_assets' && f.name !== '_snippets') : all;
        const deduped = {};
        for (const item of items) {
          const baseName = item.isFolder ? item.name : item.name.replace(/\.md$/, '');
          if (!deduped[baseName] || (item.isFolder && !deduped[baseName].isFolder)) {
            deduped[baseName] = item;
          }
        }
        this.items = Object.values(deduped);
        if (this.expandPath) {
          for (const item of this.items) {
            if (item.isFolder) {
              const itemPath = this.itemPath(item);
              if (this.expandPath.startsWith(itemPath + '/') || this.expandPath === itemPath) {
                this.expanded[item.id] = true;
              }
            }
          }
        }
      } catch (e) { console.error(e); }
      this.loading = false;
    },
    displayName(item) { return item.name.replace(/\.md$/, ''); },
    itemPath(item) {
      const base = this.basePath ? this.basePath + '/' : '';
      return base + (item.isFolder ? item.name : item.name.replace(/\.md$/, ''));
    },
    navigateDocument(item) { window.location.hash = '#/' + this.itemPath(item); },
    toggleExpand(item) { this.expanded[item.id] = !this.expanded[item.id]; },
    isActive(item) { return this.currentPath === this.itemPath(item); },
  },
};

const SnippetList = {
  template: `
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex justify-center py-8"><div class="spinner"></div></div>
      <div v-else-if="filteredSnippets.length === 0" class="text-center py-8 text-xs opacity-50">No snippets</div>
      <div
        v-for="s in filteredSnippets"
        :key="s.id"
        class="snippet-item"
        :class="{ 'active': isSnippetActive(s) }"
        @click="selectSnippet(s)"
      >
        <div class="font-medium text-xs truncate" :title="s.name">{{ s.name }}</div>
        <div class="flex items-center justify-between gap-2 mt-1">
          <div class="text-[9px] uppercase tracking-wider opacity-60">{{ formatRelativeDate(s.modifiedTime) }}</div>
          <div class="text-[9px] uppercase tracking-wider font-semibold" :class="isExpiringSoon(s.expiryTs) ? 'text-orange-500' : 'text-primary'">{{ formatTimeLeft(s.expiryTs) }}</div>
        </div>
      </div>
    </div>
  `,
  props: ['currentPath', 'searchQuery', 'snippetsVersion'],
  data() {
    return {
      snippets: [],
      loading: false,
    };
  },
  computed: {
    filteredSnippets() {
      const query = this.searchQuery.toLowerCase().trim();
      if (!query) return this.snippets;
      return this.snippets.filter(s => s.name.toLowerCase().includes(query));
    },
  },
  async mounted() {
    this.loadSnippets();
  },
  watch: {
    snippetsVersion() {
      this.loadSnippets();
    },
  },
  methods: {
    async loadSnippets() {
      this.loading = true;
      try {
        const folderId = await DriveService.getSnippetsFolderId();
        this.snippets = await DriveService.listSnippets(folderId);
      } catch (e) { console.error(e); }
      this.loading = false;
    },
    selectSnippet(s) { window.location.hash = '#/_snippets/' + s.id; },
    isSnippetActive(s) { return this.currentPath === '_snippets/' + s.id; },
    formatRelativeDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const diff = new Date() - date;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return date.toLocaleDateString();
    },
    formatTimeLeft(expiryTs) {
      if (!expiryTs || expiryTs === 0) return '∞';
      const diff = expiryTs - Date.now();
      if (diff <= 0) return 'Expired';
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return minutes + 'm';
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + 'h';
      return Math.floor(hours / 24) + 'd';
    },
    isExpiringSoon(expiryTs) {
      return expiryTs && (expiryTs - Date.now() < 3600000);
    },
  }
};

const Sidebar = {
  template: `
    <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
      <!-- Section Switcher (Top) -->
      <div class="p-2 flex items-center justify-around border-b" style="border-color: hsl(var(--border))">
        <button
          @click="setTab('wiki')"
          class="nav-btn"
          :class="{ active: activeTab === 'wiki' }"
          title="Wiki"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
        </button>
        <button
          @click="setTab('snippets')"
          class="nav-btn"
          :class="{ active: activeTab === 'snippets' }"
          title="Snippets"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
        </button>
        <button
          @click="setTab('assets')"
          class="nav-btn"
          :class="{ active: activeTab === 'assets' }"
          title="Assets"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        </button>
      </div>

      <!-- Search & Refresh -->
      <div v-if="!isCollapsed" class="p-3 pb-2">
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="'Search ' + activeTab + '...'"
            class="flex-1 px-2 py-1 text-xs rounded border bg-background"
            style="border-color: hsl(var(--border))"
          />
          <button @click="$emit('refresh')" class="p-1 opacity-50 hover:opacity-100"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
        </div>
      </div>

      <!-- Items List (Lower) -->
      <div v-if="!isCollapsed" class="flex-1 flex flex-col overflow-hidden">
        <sidebar-tree
          v-if="activeTab === 'wiki' && rootId"
          :folder-id="rootId"
          base-path=""
          :current-path="currentPath"
          :expand-path="expandPath"
          :search-query="searchQuery"
        ></sidebar-tree>
        <snippet-list
          v-else-if="activeTab === 'snippets'"
          :current-path="currentPath"
          :search-query="searchQuery"
          :snippets-version="snippetsVersion"
        ></snippet-list>
        <div v-else-if="activeTab === 'assets'" class="p-3 flex flex-col gap-3">
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
          <label class="sidebar-asset-upload-btn">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload
            <input type="file" multiple class="hidden" @change="onAssetFileInput" />
          </label>
        </div>
      </div>

      <!-- Collapse Toggle -->
      <button @click="$emit('toggle-collapse')" class="collapse-toggle">
        <svg class="w-4 h-4" :class="{ 'rotate-180': isCollapsed }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
      </button>
    </aside>
  `,
  props: ['rootId', 'currentPath', 'expandPath', 'snippetsVersion', 'assetsFolderId', 'isCollapsed'],
  emits: ['refresh', 'toggle-collapse', 'toast', 'assets-uploaded'],
  data() {
    return {
      searchQuery: '',
      activeTab: 'wiki',
      assetDragging: false,
      assetUploading: false,
      assetUploadCount: 0,
    };
  },
  watch: {
    currentPath: {
      handler(path) {
        if (path.startsWith('_snippets')) this.activeTab = 'snippets';
        else if (path.startsWith('_assets')) this.activeTab = 'assets';
        else this.activeTab = 'wiki';
      },
      immediate: true
    }
  },
  methods: {
    setTab(tab) {
      this.activeTab = tab;
      if (tab === 'assets') window.location.hash = '#/_assets';
      else if (tab === 'snippets' && !this.currentPath.startsWith('_snippets')) window.location.hash = '#/_snippets';
      else if (tab === 'wiki' && (this.currentPath.startsWith('_snippets') || this.currentPath.startsWith('_assets'))) window.location.hash = '#/';
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
        const folderId = this.assetsFolderId || await DriveService.getAssetsFolderId();
        for (const file of files) {
          try {
            let name = file.name;
            if (!name || name === 'image.png') {
              const ext = file.type.split('/')[1] || 'bin';
              name = 'pasted-' + Date.now() + '.' + ext;
            }
            await DriveService.uploadBinary(name, folderId, file, file.type || 'application/octet-stream');
            success++;
          } catch (e) {
            this.$emit('toast', 'Failed to upload ' + file.name + ': ' + e.message, 'error');
          }
        }
        if (success > 0) {
          CacheService.remove('listing:' + folderId);
          this.$emit('toast', success + ' file(s) uploaded', 'success');
          this.$emit('assets-uploaded');
        }
      } catch (e) {
        this.$emit('toast', 'Upload failed: ' + e.message, 'error');
      }
      this.assetUploading = false;
      this.assetUploadCount = 0;
    }
  },
  components: { 'sidebar-tree': SidebarTree, 'snippet-list': SnippetList }
};
