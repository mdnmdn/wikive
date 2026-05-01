const DrawingEditor = {
  template: `
    <div class="h-full flex flex-col" :class="{ 'fixed inset-0 z-[100] bg-background': isFullscreen }">
      <div class="flex-1 relative" style="width:100%;height:100%;min-height:0;">
        <excalidraw-component ref="excalidraw" class="w-full h-full" :theme="darkMode ? 'dark' : 'light'"></excalidraw-component>
        <button
          v-if="isFullscreen"
          @click="toggleFullscreen()"
          class="absolute top-0 right-0 z-10 p-1.5 rounded-bl-md border-b border-l shadow-sm hover:opacity-90 transition-colors"
          style="background-color:hsl(var(--background));border-color:hsl(var(--border));color:hsl(var(--foreground))"
          title="Exit fullscreen"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5m11-5l-5 5m-11 11l5-5m11 5l-5-5"/></svg>
        </button>
      </div>
    </div>
  `,
  inject: ['rendererState'],
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'delete', 'toast'],
  data() {
    return {
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
    document: { handler() {}, immediate: false },
    content: {
      handler(val) {
        this.lastSavedContent = val || '';
        this.loadContent();
      },
      immediate: true,
    },
    isFullscreen(v) {
      if (this.rendererState) this.rendererState.drawingFullscreen = v;
    },
    autosave(enabled) {
      clearInterval(this._autosaveTimer);
      this._autosaveTimer = null;
      if (enabled) {
        this._autosaveTimer = setInterval(() => this._doAutosave(), 12000);
      }
      if (this.rendererState) this.rendererState.drawingAutosave = enabled;
    },
  },
  mounted() {
    if (this.rendererState) {
      this.rendererState.drawingAutosave = false;
      this.rendererState.drawingAutosaveStatus = '';
      this.rendererState.drawingSaving = false;
      this.rendererState.drawingFullscreen = false;
    }
  },
  beforeUnmount() {
    clearInterval(this._autosaveTimer);
    clearTimeout(this._autosaveStatusTimer);
    if (this.rendererState) {
      this.rendererState.drawingSaving = false;
      this.rendererState.drawingAutosaveStatus = '';
    }
  },
  methods: {
    toggleAutosave() {
      this.autosave = !this.autosave;
    },
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
    },
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
      const name = (this.document?.name?.replace(/\.excalidraw$/, '') || 'Untitled').trim();
      this.saving = true;
      if (this.rendererState) this.rendererState.drawingSaving = true;
      if (isAuto) this._setAutosaveStatus('saving');
      try {
        if (this.document?.id) {
          await StorageService.updateFile(this.document.id, jsonContent, { name: name + '.excalidraw' });
          this.lastSavedContent = jsonContent;
          if (!isAuto) this.$emit('toast', 'Drawing saved', 'success');
          if (isAuto) this._setAutosaveStatus('saved');
          this.$emit('save', { name: name + '.excalidraw' });
        } else {
          const folderId = await StorageService.getDrawingsFolderId();
          const data = await StorageService.createDrawing(name, jsonContent, folderId);
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
      if (this.rendererState) this.rendererState.drawingSaving = false;
    },
    _setAutosaveStatus(status) {
      clearTimeout(this._autosaveStatusTimer);
      this.autosaveStatus = status;
      if (this.rendererState) this.rendererState.drawingAutosaveStatus = status;
      if (status === 'saved') {
        this._autosaveStatusTimer = setTimeout(() => {
          this.autosaveStatus = '';
          if (this.rendererState) this.rendererState.drawingAutosaveStatus = '';
        }, 2000);
      }
    },
  },
};
