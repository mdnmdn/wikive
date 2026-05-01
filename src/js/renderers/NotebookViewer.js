const NotebookViewer = {
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
  emits: ['navigate', 'toast'],
  data() {
    return {
      loading: false,
      error: null,
      jupyterUrl: '/jupyterlite/repl/index.html?kernel=python&toolbar=1'
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
    }
  },
  methods: {
    updateJupyterUrl() {
        const baseUrl = '/jupyterlite/repl/index.html';
        const params = new URLSearchParams({
            kernel: 'python',
            toolbar: '1',
            theme: this.darkMode ? 'JupyterLab Dark' : 'JupyterLab Light'
        });
        this.jupyterUrl = `${baseUrl}?${params.toString()}`;
    }
  }
};
