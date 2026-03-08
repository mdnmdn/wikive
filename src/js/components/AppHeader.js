const AppHeader = {
  template: `
    <header class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))">
      <div class="flex items-center gap-3">
        <a href="#/" class="flex items-center gap-2 hover:opacity-80" style="color: hsl(var(--foreground))">
          <img src="/assets/logo-base.png" alt="Wiki Logo" class="h-8 w-auto rounded" />
        </a>
        <breadcrumb :path="currentPath" :snippet-name="snippetName"></breadcrumb>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="mode === 'view' && resolved && resolved.type === 'file'">
          <button @click="$emit('refresh-page')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Refresh page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <button @click="$emit('edit')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>
          <button @click="$emit('delete-page')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border text-red-500 hover:bg-red-50 transition-colors" style="border-color: hsl(var(--border))" title="Delete page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </template>
        <template v-if="mode === 'edit'">
          <button @click="$emit('save')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-white hover:opacity-90 transition-colors" style="background-color: hsl(var(--primary))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Save
          </button>
          <button @click="$emit('cancel')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">
            Cancel
          </button>
        </template>
        <button @click="handleNewAction" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" :title="isSnippetsRoute ? 'New snippet' : 'New page'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </button>
        <button @click="$emit('toggle-dark')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Toggle dark mode">
          <template v-if="darkMode">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </template>
          <template v-else>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          </template>
        </button>
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
  props: ['currentPath', 'mode', 'user', 'resolved', 'darkMode', 'isSnippetsRoute', 'snippetName'],
  emits: ['edit', 'save', 'cancel', 'new-page', 'new-snippet', 'delete-page', 'toggle-dark', 'refresh-page'],
  methods: {
    logout() {
      AuthService.logout();
    },
    handleNewAction() {
      if (this.isSnippetsRoute) {
        this.$emit('new-snippet');
      } else {
        this.$emit('new-page');
      }
    }
  },
};
