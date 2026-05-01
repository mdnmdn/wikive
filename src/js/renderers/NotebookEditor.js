const NotebookEditor = {
  template: `
    <div class="flex flex-col h-full w-full overflow-hidden bg-background">
      <div v-if="loading" class="flex items-center justify-center py-12"><div class="spinner"></div></div>
      <div v-else-if="error" class="text-red-500 py-4 px-10">{{ error }}</div>
      <iframe
        v-else
        ref="notebookFrame"
        :src="jupyterUrl"
        class="flex-1 w-full border-none"
        allow="clipboard-read; clipboard-write; notebook"
      ></iframe>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode', 'isSharedView'],
  emits: ['navigate', 'toast', 'save'],
  data() {
    return {
      loading: false,
      error: null,
      jupyterUrl: 'https://jupyterlite.github.io/demo/lab/index.html'
    };
  },
  watch: {
    document: {
      handler(newDoc) {
        if (newDoc && newDoc.docType === 'notebook') {
          this.updateJupyterUrl();
        }
      },
      immediate: true
    },
    darkMode() {
        this.updateJupyterUrl();
    }
  },
  methods: {
    updateJupyterUrl() {
        // JupyterLab full interface
        const baseUrl = 'https://jupyterlite.github.io/demo/lab/index.html';
        const params = new URLSearchParams({
            theme: this.darkMode ? 'JupyterLab Dark' : 'JupyterLab Light'
        });

        this.jupyterUrl = `${baseUrl}?${params.toString()}`;
    },
    getContent() {
        // Since it's an iframe to an external site, we can't easily get the content
        // unless we implement a custom JupyterLite host or use postMessage if supported.
        return this.content;
    },
    triggerSave() {
        this.$emit('toast', { message: 'Notebooks are currently local to the JupyterLite session.', type: 'info' });
        this.$emit('save', { name: this.document.name });
    }
  }
};
