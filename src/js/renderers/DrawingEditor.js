const DrawingEditor = {
  template: `
    <div class="h-full flex flex-col" :class="{ 'fixed inset-0 z-[100] bg-background': isFullscreen }">
      <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
        <div class="flex items-center gap-3 flex-1 min-width-0">
          <input v-model="editName" class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded w-full max-w-xs" placeholder="Diagram name..." />
          <span class="text-[10px] uppercase tracking-wide opacity-60">.excalidraw</span>
        </div>
        <div class="flex items-center gap-2">
          <button @click="isFullscreen = !isFullscreen" class="p-1.5 rounded-md hover:bg-muted" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
            <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5m11-5l-5 5m-11 11l5-5m11 5l-5-5"/></svg>
          </button>
          <button @click="saveDrawing" :disabled="saving" class="ml-2 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            <span v-if="saving" class="spinner" style="width:0.75rem;height:0.75rem;border-width:1px;border-top-color:white"></span>
            <span>{{ document?.id ? 'Save' : 'Create' }}</span>
          </button>
          <button @click="$emit('mode-change', 'view')" class="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted">Cancel</button>
        </div>
      </div>
      <div class="flex-1 relative" style="width:100%;height:100%;min-height:0;">
        <excalidraw-component ref="excalidraw" class="w-full h-full" :theme="darkMode ? 'dark' : 'light'"></excalidraw-component>
      </div>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'mode-change', 'toast'],
  data() {
    return {
      editName: '',
      saving: false,
      isFullscreen: false,
    };
  },
  watch: {
    document: {
      handler(doc) { this.editName = (doc?.name || '').replace(/\.excalidraw$/, ''); },
      immediate: true,
    },
    content: {
      handler() { this.loadContent(); },
      immediate: true,
    },
  },
  methods: {
    loadContent() {
      if (!this.content) return;
      this.$nextTick(() => {
        if (this.$refs.excalidraw) this.$refs.excalidraw.load(this.content);
      });
    },
    getContent() {
      if (this.$refs.excalidraw) return this.$refs.excalidraw.save();
      return this.content;
    },
    async saveDrawing() {
      const jsonContent = this.getContent();
      const name = (this.editName || 'Untitled').trim();
      this.saving = true;
      try {
        if (this.document?.id) {
          await DriveService.updateFile(this.document.id, jsonContent, { name: name + '.excalidraw' });
          this.$emit('toast', 'Drawing saved', 'success');
          this.$emit('save', { name: name + '.excalidraw' });
        } else {
          const folderId = await DriveService.getDrawingsFolderId();
          const data = await DriveService.createDrawing(name, jsonContent, folderId);
          this.$emit('toast', 'Drawing created', 'success');
          this.$emit('save', { id: data.id, name: name + '.excalidraw' });
          window.location.hash = '#/_drawings/' + data.id;
        }
      } catch (e) {
        this.$emit('toast', 'Failed to save: ' + e.message, 'error');
      }
      this.saving = false;
    },
  },
};
