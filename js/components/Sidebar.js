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
              style="width: 1.25rem; height: 1.25rem; transition: transform 0.2s; flex-shrink: 0; cursor: pointer"
              @click.stop="toggleExpand(item)"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </template>
          <svg
            class="icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style="width: 1.25rem; height: 1.25rem; flex-shrink: 0"
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
      <div v-if="loading" class="tree-item" style="color: hsl(var(--muted-foreground))">
        <div class="spinner icon"></div>
        <span>Loading...</span>
      </div>
      <div v-if="!loading && filteredItems.length === 0 && items.length === 0" class="tree-item italic text-xs" style="color: hsl(var(--muted-foreground))">
        Empty
      </div>
      <div v-if="!loading && filteredItems.length === 0 && items.length > 0" class="tree-item italic text-xs" style="color: hsl(var(--muted-foreground))">
        No matches
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
      if (!this.searchQuery || !this.searchQuery.trim()) {
        return this.items;
      }
      const query = this.searchQuery.toLowerCase();
      return this.items.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    },
  },
  async mounted() {
    await this.loadItems();
  },
  watch: {
    folderId() {
      this.loadItems();
    },
  },
  methods: {
    async loadItems() {
      if (!this.folderId) return;
      this.loading = true;
      try {
        const all = await DriveService.listFolder(this.folderId);
        // Hide _assets folder from root tree (it has its own sidebar link)
        let items = this.basePath === '' ? all.filter(f => f.name !== '_assets') : all;

        // Deduplicate: if both a folder and a file with the same name exist, keep only the folder
        const deduped = {};
        for (const item of items) {
          const baseName = item.isFolder ? item.name : item.name.replace(/\.md$/, '');
          if (!deduped[baseName]) {
            deduped[baseName] = item;
          } else {
            // Prefer folder over file
            if (item.isFolder && !deduped[baseName].isFolder) {
              deduped[baseName] = item;
            }
          }
        }
        this.items = Object.values(deduped);

        // Auto-expand if expandPath is set
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
      } catch (e) {
        console.error('Failed to load folder:', e);
        this.items = [];
      }
      this.loading = false;
    },
    displayName(item) {
      return item.name.replace(/\.md$/, '');
    },
    itemPath(item) {
      const base = this.basePath ? this.basePath + '/' : '';
      return base + (item.isFolder ? item.name : item.name.replace(/\.md$/, ''));
    },
    navigateDocument(item) {
      // Navigate to document path (works for both files and folders)
      window.location.hash = '#/' + this.itemPath(item);
    },
    toggleExpand(item) {
      // Expand/collapse folder without navigating
      this.expanded[item.id] = !this.expanded[item.id];
    },
    isActive(item) {
      return this.currentPath === this.itemPath(item);
    },
  },
};

const Sidebar = {
  template: `
    <aside class="sidebar" style="background-color: hsl(var(--muted) / 0.3)">
      <div class="p-3 pb-2 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-semibold uppercase tracking-wider px-2" style="color: hsl(var(--muted-foreground))">Pages</div>
          <button
            @click="$emit('refresh')"
            class="p-1 rounded hover:opacity-80 transition-colors"
            style="color: hsl(var(--muted-foreground))"
            title="Refresh pages"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          type="text"
          placeholder="Search pages..."
          class="px-2 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-2 focus:ring-primary"
          style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))"
        />
      </div>
      <sidebar-tree
        v-if="rootId"
        :folder-id="rootId"
        base-path=""
        :current-path="currentPath"
        :expand-path="expandPath"
        :search-query="searchQuery"
      ></sidebar-tree>
      <div v-else class="flex justify-center p-4">
        <div class="spinner"></div>
      </div>
      <div class="border-t mx-3 my-2" style="border-color: hsl(var(--border))"></div>
      <a
        href="#/_assets"
        class="tree-item"
        :class="{ active: currentPath === '_assets' || currentPath.startsWith('_assets/') }"
      >
        <svg
          class="icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style="width: 1.25rem; height: 1.25rem; flex-shrink: 0"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>
        <span>Assets</span>
      </a>
    </aside>
  `,
  props: ['rootId', 'currentPath', 'expandPath'],
  emits: ['refresh'],
  data() {
    return {
      searchQuery: '',
      searchTimeout: null,
    };
  },
  methods: {
    onSearchInput() {
      // Debounce is handled by Vue reactivity - filtering is instant
      // This method exists for future enhancements like backend search
    },
  },
};
