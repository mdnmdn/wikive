const AppHeader = {
  template: `
    <header class="flex items-center justify-between px-4 py-2 border-b bg-white" style="border-color: hsl(var(--border))">
      <div class="flex items-center gap-3">
        <a href="#/" class="flex items-center gap-2 text-lg font-semibold text-slate-900 hover:opacity-80">
          <span>&#128218;</span>
          <span>Wiki</span>
        </a>
        <breadcrumb :path="currentPath"></breadcrumb>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="mode === 'view' && resolved && resolved.type === 'file'">
          <button @click="$emit('edit')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50 transition-colors" style="border-color: hsl(var(--border))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>
        </template>
        <template v-if="mode === 'edit'">
          <button @click="$emit('save')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Save
          </button>
          <button @click="$emit('cancel')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50 transition-colors" style="border-color: hsl(var(--border))">
            Cancel
          </button>
        </template>
        <button @click="$emit('new-page')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50 transition-colors" style="border-color: hsl(var(--border))" title="New page">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </button>
        <div class="flex items-center gap-2 ml-2 pl-2 border-l" style="border-color: hsl(var(--border))">
          <img v-if="user?.picture" :src="user.picture" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
          <span class="text-sm text-slate-600">{{ user?.name }}</span>
          <button @click="logout" class="text-sm text-slate-400 hover:text-slate-600 transition-colors" title="Sign out">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </header>
  `,
  props: ['currentPath', 'mode', 'user', 'resolved'],
  emits: ['edit', 'save', 'cancel', 'new-page'],
  methods: {
    logout() {
      AuthService.logout();
    },
  },
};
