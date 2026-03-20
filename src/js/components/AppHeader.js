const AppHeader = {
  template: `
    <header class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))">
      <div class="flex items-center gap-3">
        <a href="#/" class="flex items-center gap-2 hover:opacity-80" style="color: hsl(var(--foreground))">
          <img src="/assets/logo-base.png" alt="Wiki Logo" class="h-8 w-auto rounded" />
        </a>
        <breadcrumb :path="currentPath" :document="document"></breadcrumb>
        <!-- Presence: users on same page -->
        <div v-if="samePageUsers.length" class="flex items-center -space-x-1.5 ml-2">
          <img
            v-for="u in samePageUsers.slice(0, 5)"
            :key="u.email"
            :src="u.picture"
            :title="u.name + ' is viewing this page'"
            class="w-6 h-6 rounded-full ring-2 ring-background"
            referrerpolicy="no-referrer"
          />
          <span v-if="samePageUsers.length > 5" class="text-xs ml-2" style="color: hsl(var(--muted-foreground))">+{{ samePageUsers.length - 5 }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Refresh button: always visible in view mode -->
        <button v-if="mode === 'view' && document" @click="$emit('refresh-page')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Refresh">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
        <!-- Rename/Move: markdown pages only -->
        <button v-if="mode === 'view' && document && document.docType === 'markdown'" @click="$emit('rename-move')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Rename / Move">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        </button>
        <!-- Clone: markdown, snippet, drawing -->
        <button v-if="mode === 'view' && document && ['markdown','snippet','drawing'].includes(document.docType)" @click="$emit('clone')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Clone">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>
        <!-- Edit/Delete: only for editable file types -->
        <template v-if="mode === 'view' && document && document.type === 'file' && canEdit">
          <button @click="$emit('edit')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>
          <button @click="$emit('delete-page')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border text-red-500 hover:bg-red-50 transition-colors" style="border-color: hsl(var(--border))" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </template>
        <!-- Edit mode buttons (not for drawings — they manage their own toolbar) -->
        <template v-if="mode === 'edit' && document?.docType !== 'drawing'">
          <button @click="$emit('save')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-white hover:opacity-90 transition-colors" style="background-color: hsl(var(--primary))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Save
          </button>
          <button @click="$emit('cancel')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">
            Cancel
          </button>
        </template>
        <!-- Create new (dropdown) -->
        <div class="relative" ref="createDropdown">
          <button @click="showCreateMenu = !showCreateMenu" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Create new...">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
          <div v-if="showCreateMenu" class="absolute right-0 mt-1 w-44 rounded-lg border shadow-lg z-50 py-1" style="background-color: hsl(var(--background)); border-color: hsl(var(--border))">
            <button @click="createAction('page')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color: hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              New Page
            </button>
            <button @click="createAction('snippet')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color: hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
              New Snippet
            </button>
            <button @click="createAction('drawing')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color: hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v12H4zM8 20h8"/></svg>
              New Drawing
            </button>
          </div>
        </div>
        <!-- Notification bell -->
        <div class="relative" ref="notifDropdown">
          <button @click="$emit('toggle-notifications')" class="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Notifications">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <span v-if="notifications.length" class="notif-badge">{{ notifications.length > 99 ? '99+' : notifications.length }}</span>
          </button>
          <!-- Notification dropdown -->
          <div v-if="showNotifications" class="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border shadow-lg z-50" style="background-color: hsl(var(--background)); border-color: hsl(var(--border))">
            <div class="flex items-center justify-between px-3 py-2 border-b" style="border-color: hsl(var(--border))">
              <span class="text-sm font-medium">Notifications</span>
              <button v-if="notifications.length" @click="$emit('clear-notifications')" class="text-xs hover:opacity-80" style="color: hsl(var(--primary))">Clear all</button>
            </div>
            <div v-if="!notifications.length" class="px-3 py-6 text-center text-sm" style="color: hsl(var(--muted-foreground))">No notifications</div>
            <button
              v-for="(n, i) in notifications.slice(0, 20)"
              :key="i"
              @click="$emit('navigate', n.path); $emit('toggle-notifications')"
              class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
              style="border-color: hsl(var(--border)); color: hsl(var(--foreground))"
            >
              <img v-if="n.user.picture" :src="n.user.picture" class="w-6 h-6 rounded-full flex-shrink-0" referrerpolicy="no-referrer" />
              <div class="min-w-0 flex-1">
                <span class="font-medium">{{ n.user.name }}</span>
                <span> {{ n.action === 'save' ? 'updated' : n.action === 'create' ? 'created' : 'deleted' }} </span>
                <span class="font-medium truncate">{{ n.path }}</span>
                <div class="text-xs mt-0.5" style="color: hsl(var(--muted-foreground))">{{ timeAgo(n.ts) }}</div>
              </div>
            </button>
          </div>
        </div>
        <!-- Online users count -->
        <div v-if="presenceUsers.length" class="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style="background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground))" :title="presenceUsers.map(u => u.name).join(', ')">
          <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          {{ presenceUsers.length }}
        </div>
        <!-- Dark mode toggle -->
        <button @click="$emit('toggle-dark')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Toggle dark mode">
          <template v-if="darkMode">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </template>
          <template v-else>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          </template>
        </button>
        <!-- User -->
        <div class="flex items-center gap-2 ml-2 pl-2 border-l" style="border-color: hsl(var(--border))">
          <img v-if="user?.picture" :src="user.picture" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
          <span class="text-sm">{{ user?.name }}</span>
          <button @click="logout" class="text-sm hover:opacity-80 transition-colors" title="Sign out">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </header>
  `,
  props: ['currentPath', 'mode', 'user', 'document', 'darkMode', 'notifications', 'showNotifications', 'presenceUsers'],
  emits: ['edit', 'save', 'cancel', 'new-page', 'new-snippet', 'new-drawing', 'delete-page', 'toggle-dark', 'refresh-page', 'rename-move', 'clone', 'toggle-notifications', 'clear-notifications', 'navigate'],
  data() {
    return { showCreateMenu: false };
  },
  computed: {
    canEdit() {
      return this.document ? RendererService.canEdit(this.document.docType) : false;
    },
    samePageUsers() {
      if (!this.presenceUsers || !this.currentPath) return [];
      return this.presenceUsers.filter(u => u.path === this.currentPath);
    },
  },
  mounted() {
    document.addEventListener('click', this._clickOutside = (e) => {
      if (this.$refs.createDropdown && !this.$refs.createDropdown.contains(e.target)) {
        this.showCreateMenu = false;
      }
      if (this.$refs.notifDropdown && !this.$refs.notifDropdown.contains(e.target) && this.showNotifications) {
        this.$emit('toggle-notifications');
      }
    });
  },
  beforeUnmount() {
    document.removeEventListener('click', this._clickOutside);
  },
  methods: {
    logout() {
      if (typeof RealtimeService !== 'undefined') RealtimeService.disconnect();
      AuthService.logout();
    },
    createAction(type) {
      this.showCreateMenu = false;
      if (type === 'page') this.$emit('new-page');
      else if (type === 'snippet') this.$emit('new-snippet');
      else if (type === 'drawing') this.$emit('new-drawing');
    },
    timeAgo(ts) {
      const diff = Date.now() - ts;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return Math.floor(diff / 86400000) + 'd ago';
    },
  },
};
