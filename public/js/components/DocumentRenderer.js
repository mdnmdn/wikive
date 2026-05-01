// Dispatcher: renders the appropriate viewer/editor based on document type + mode
const DocumentRenderer = {
  template: `
    <component
      v-if="componentName"
      :is="componentName"
      :document="document"
      :content="content"
      :dark-mode="darkMode"
      :mode="mode"
      :is-shared-view="isSharedView"
      @save="$emit('save', $event)"
      @delete="$emit('delete')"
      @toast="(msg, type) => $emit('toast', msg, type)"
      @mode-change="$emit('mode-change', $event)"
      @navigate="$emit('navigate', $event)"
      @create-snippet="$emit('create-snippet')"
      @create-drawing="$emit('create-drawing')"
      ref="renderer"
    ></component>
    <div v-else class="flex items-center justify-center py-12 text-sm opacity-60">
      Unknown document type
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode', 'isSharedView'],
  emits: ['save', 'delete', 'toast', 'mode-change', 'navigate', 'create-snippet', 'create-drawing'],
  computed: {
    componentName() {
      if (!this.document) return null;
      return RendererService.getRenderer(this.document.docType, this.mode);
    },
  },
  methods: {
    getContent() {
      return this.$refs.renderer?.getContent?.() || this.content;
    },
    triggerSave() {
      const docType = this.document?.docType;
      if (docType === 'snippet') return this.$refs.renderer?.saveSnippet?.();
      if (docType === 'drawing') return this.$refs.renderer?.saveDrawing?.();
    },
    triggerCopy() { return this.$refs.renderer?.copyToClipboard?.(); },
    triggerRefreshAssets() { return this.$refs.renderer?.refreshAssets?.(); },
    triggerUpload() { return this.$refs.renderer?.triggerUpload?.(); },
    triggerCreateSubfolder() { return this.$refs.renderer?.createSubfolder?.(); },
    triggerToggleAutosave() { return this.$refs.renderer?.toggleAutosave?.(); },
    triggerToggleFullscreen() { return this.$refs.renderer?.toggleFullscreen?.(); },
  },
};
