const PageNotFound = {
  template: `
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="text-5xl mb-4">&#128196;</div>
      <h2 class="text-xl font-semibold mb-2" style="color: hsl(var(--foreground))">Page not found</h2>
      <p class="mb-6" style="color: hsl(var(--muted-foreground))">
        <code class="text-sm px-2 py-1 rounded" style="background: hsl(var(--muted))">{{ path }}</code> doesn't exist yet.
      </p>
      <button
        @click="$emit('create', path)"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
        style="background: hsl(var(--primary)); color: hsl(var(--primary-foreground))"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Create this page
      </button>
    </div>
  `,
  props: ['path'],
  emits: ['create'],
};
