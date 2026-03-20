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
      @save="$emit('save', $event)"
      @delete="$emit('delete')"
      @toast="(msg, type) => $emit('toast', msg, type)"
      @mode-change="$emit('mode-change', $event)"
      @navigate="$emit('navigate', $event)"
      ref="renderer"
    ></component>
    <div v-else class="flex items-center justify-center py-12 text-sm opacity-60">
      Unknown document type
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save', 'delete', 'toast', 'mode-change', 'navigate'],
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
  },
};
