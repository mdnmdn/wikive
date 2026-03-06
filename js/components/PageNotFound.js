const PageNotFound = {
  template: `
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="text-5xl mb-4">&#128196;</div>
      <h2 class="text-xl font-semibold text-slate-900 mb-2">Page not found</h2>
      <p class="text-slate-500 mb-6">
        <code class="text-sm bg-slate-100 px-2 py-1 rounded">{{ path }}</code> doesn't exist yet.
      </p>
      <button
        @click="$emit('create', path)"
        class="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Create this page
      </button>
    </div>
  `,
  props: ['path'],
  emits: ['create'],
};
