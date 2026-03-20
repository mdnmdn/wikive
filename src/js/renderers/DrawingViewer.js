const DrawingViewer = {
  template: `
    <div class="h-full flex flex-col" :class="{ 'fixed inset-0 z-[100] bg-background': isFullscreen }">
      <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
        <div class="flex items-center gap-3">
          <div class="font-medium text-sm truncate">{{ displayName }}</div>
          <span class="text-[10px] uppercase tracking-wide opacity-60">.excalidraw</span>
        </div>
        <div class="flex items-center gap-2">
          <button @click="isFullscreen = !isFullscreen" class="p-1.5 rounded-md hover:bg-muted" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
            <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5m11-5l-5 5m-11 11l5-5m11 5l-5-5"/></svg>
          </button>
          <button @click="downloadDrawing" class="p-1.5 rounded-md hover:bg-muted" title="Download">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          </button>
        </div>
      </div>
      <div class="flex-1 relative" style="width:100%;height:100%;min-height:0;">
        <excalidraw-component ref="excalidraw" class="w-full h-full" :theme="darkMode ? 'dark' : 'light'" view-mode="true"></excalidraw-component>
      </div>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['toast'],
  data() {
    return { isFullscreen: false };
  },
  computed: {
    displayName() {
      return (this.document?.name || '').replace(/\.excalidraw$/, '') || 'Untitled';
    },
  },
  watch: {
    content: { handler() { this.loadContent(); }, immediate: true },
  },
  methods: {
    loadContent() {
      if (!this.content) return;
      this.$nextTick(() => {
        if (this.$refs.excalidraw) this.$refs.excalidraw.load(this.content);
      });
    },
    async downloadDrawing() {
      if (!this.document) return;
      try {
        const url = DriveService.getDownloadUrl(this.document.id);
        const headers = DriveService.getAuthHeaders();
        const res = await fetch(url, { headers });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.document.name;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        this.$emit('toast', 'Download failed: ' + e.message, 'error');
      }
    },
  },
};
