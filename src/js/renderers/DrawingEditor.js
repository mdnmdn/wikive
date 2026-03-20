const DrawingEditor = {
  template: `
    <div class="h-full flex flex-col" :class="{ 'fixed inset-0 z-[100] bg-background': isFullscreen }">
      <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
        <div class="flex items-center gap-3 flex-1 min-width-0">
          <input v-model="editName" class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded w-full max-w-xs" placeholder="Diagram name..." />
          <span class="text-[10px] uppercase tracking-wide opacity-60">.excalidraw</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Autosave status -->
          <span v-if="autosave" class="text-xs transition-opacity" :class="autosaveStatus ? 'opacity-60' : 'opacity-0'">
            <span v-if="autosaveStatus === 'saving'">Saving…</span>
            <span v-else-if="autosaveStatus === 'saved'">Saved</span>
          </span>
          <!-- Autosave toggle -->
          <button
            @click="autosave = !autosave"
            class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition-colors"
            :style="autosave ? 'border-color: hsl(var(--primary)); color: hsl(var(--primary)); background-color: hsl(var(--primary) / 0.08)' : 'border-color: hsl(var(--border)); background-color: hsl(var(--muted))'"
            title="Toggle autosave (every 12s)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            Auto
          </button>
          <button @click="isFullscreen = !isFullscreen" class="p-1.5 rounded-md hover:bg-muted" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
            <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5m11-5l-5 5m-11 11l5-5m11 5l-5-5"/></svg>
          </button>
          <button @click="saveDrawing()" :disabled="saving" class="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            <span v-if="saving" class="spinner" style="width:0.75rem;height:0.75rem;border-width:1px;border-top-color:white"></span>
            <span>{{ document?.id ? 'Save' : 'Create' }}</span>
          </button>
        </div>
      </div>
      <div class="flex-1 relative" style="width:100%;height:100%;min-height:0;">
        <excalidraw-component ref="excalidraw" class="w-full h-full" :theme="darkMode ? 'dark' : 'light'"></excalidraw-component>
      </div>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'toast'],
  data() {
    return {
      editName: '',
      saving: false,
      isFullscreen: false,
      autosave: false,
      autosaveStatus: '',
      lastSavedContent: '',
      _autosaveTimer: null,
      _autosaveStatusTimer: null,
    };
  },
  watch: {
    document: {
      handler(doc) { this.editName = (doc?.name || '').replace(/\.excalidraw$/, ''); },
      immediate: true,
    },
    content: {
      handler(val) {
        this.lastSavedContent = val || '';
        this.loadContent();
      },
      immediate: true,
    },
    autosave(enabled) {
      clearInterval(this._autosaveTimer);
      this._autosaveTimer = null;
      if (enabled) {
        this._autosaveTimer = setInterval(() => this._doAutosave(), 12000);
      }
    },
  },
  beforeUnmount() {
    clearInterval(this._autosaveTimer);
    clearTimeout(this._autosaveStatusTimer);
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
    async _doAutosave() {
      if (!this.document?.id || this.saving) return;
      const current = this.getContent();
      if (!current || current === this.lastSavedContent) return;
      await this.saveDrawing(true);
    },
    async saveDrawing(isAuto = false) {
      const jsonContent = this.getContent();
      const name = (this.editName || 'Untitled').trim();
      this.saving = true;
      if (isAuto) this._setAutosaveStatus('saving');
      try {
        if (this.document?.id) {
          await DriveService.updateFile(this.document.id, jsonContent, { name: name + '.excalidraw' });
          this.lastSavedContent = jsonContent;
          if (!isAuto) this.$emit('toast', 'Drawing saved', 'success');
          if (isAuto) this._setAutosaveStatus('saved');
          this.$emit('save', { name: name + '.excalidraw' });
        } else {
          const folderId = await DriveService.getDrawingsFolderId();
          const data = await DriveService.createDrawing(name, jsonContent, folderId);
          this.lastSavedContent = jsonContent;
          this.$emit('toast', 'Drawing created', 'success');
          this.$emit('save', { id: data.id, name: name + '.excalidraw' });
          window.location.hash = '#/_drawings/' + data.id;
        }
      } catch (e) {
        this.$emit('toast', 'Failed to save: ' + e.message, 'error');
        if (isAuto) this._setAutosaveStatus('');
      }
      this.saving = false;
    },
    _setAutosaveStatus(status) {
      clearTimeout(this._autosaveStatusTimer);
      this.autosaveStatus = status;
      if (status === 'saved') {
        this._autosaveStatusTimer = setTimeout(() => { this.autosaveStatus = ''; }, 2000);
      }
    },
  },
};
