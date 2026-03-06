const SidebarTree = {
  name: 'sidebar-tree',
  template: `
    <div class="tree-children">
      <div v-for="item in items" :key="item.id">
        <div
          class="tree-item"
          :class="{ active: isActive(item) }"
          @click="navigate(item)"
        >
          <span class="icon">{{ item.isFolder ? (expanded[item.id] ? '&#128194;' : '&#128193;') : '&#128196;' }}</span>
          <span class="truncate">{{ displayName(item) }}</span>
        </div>
        <sidebar-tree
          v-if="item.isFolder && expanded[item.id]"
          :folder-id="item.id"
          :base-path="itemPath(item)"
          :current-path="currentPath"
        ></sidebar-tree>
      </div>
      <div v-if="loading" class="tree-item text-slate-400">
        <div class="spinner icon"></div>
        <span>Loading...</span>
      </div>
      <div v-if="!loading && items.length === 0" class="tree-item text-slate-400 italic text-xs">
        Empty
      </div>
    </div>
  `,
  props: ['folderId', 'basePath', 'currentPath'],
  data() {
    return {
      items: [],
      loading: false,
      expanded: {},
    };
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
        this.items = this.basePath === '' ? all.filter(f => f.name !== '_assets') : all;
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
    navigate(item) {
      if (item.isFolder) {
        this.expanded[item.id] = !this.expanded[item.id];
      }
      window.location.hash = '#/' + this.itemPath(item);
    },
    isActive(item) {
      return this.currentPath === this.itemPath(item);
    },
  },
};

const Sidebar = {
  template: `
    <aside class="sidebar">
      <div class="p-3 pb-1">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Pages</div>
      </div>
      <sidebar-tree
        v-if="rootId"
        :folder-id="rootId"
        base-path=""
        :current-path="currentPath"
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
        <span class="icon">&#128230;</span>
        <span>Assets</span>
      </a>
    </aside>
  `,
  props: ['rootId', 'currentPath'],
};
