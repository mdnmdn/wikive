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
      jupyterUrl: '/jupyterlite/lab/index.html'
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
        const baseUrl = '/jupyterlite/lab/index.html';
        const params = new URLSearchParams({
            theme: this.darkMode ? 'JupyterLab Dark' : 'JupyterLab Light'
        });

        this.jupyterUrl = `${baseUrl}?${params.toString()}`;
    },
    async loadNotebookContent() {
      if (!this.content || !this.document?.name) return;
      const frame = this.$refs.notebookFrame;
      if (!frame?.contentWindow) return;

      let parsedContent;
      try {
        parsedContent = typeof this.content === 'string'
          ? JSON.parse(this.content)
          : this.content;
      } catch {
        this.$emit('toast', { message: 'Invalid notebook JSON', type: 'error' });
        return;
      }

      // Wait for iframe to load before posting
      if (frame.contentDocument?.readyState !== 'complete') {
        await new Promise(r => frame.addEventListener('load', r, { once: true }));
      }

      frame.contentWindow.postMessage({
        type: 'LOAD_NOTEBOOK',
        payload: {
          name: this.document.name.endsWith('.ipynb')
            ? this.document.name
            : this.document.name + '.ipynb',
          content: parsedContent,
        },
      }, window.location.origin);
    },
    getContent() {
        return this.content;
    },
    triggerSave() {
      const frame = this.$refs.notebookFrame;
      if (!frame?.contentWindow) return;

      const notebookName = this.document.name.endsWith('.ipynb')
        ? this.document.name
        : this.document.name + '.ipynb';

      frame.contentWindow.postMessage({
        type: 'GET_NOTEBOOK',
        payload: { name: notebookName },
      }, window.location.origin);
    },
    setupMessageListener() {
      this._messageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        const { type, payload } = event.data || {};

        if (type === 'NOTEBOOK_CONTENT') {
          this.$emit('save', {
            name: this.document.name,
            content: JSON.stringify(payload.content, null, 2),
          });
        }

        if (type === 'NOTEBOOK_SAVED') {
          this.$emit('save', {
            name: this.document.name,
            content: JSON.stringify(payload.content, null, 2),
            silent: true,
          });
        }

        if (type === 'NOTEBOOK_LOADED') {
          // this.$emit('toast', { message: 'Notebook loaded from Drive', type: 'success' });
        }
      };
      window.addEventListener('message', this._messageHandler);
    },
  },
  mounted() {
    this.setupMessageListener();
  },
  beforeUnmount() {
    window.removeEventListener('message', this._messageHandler);
  },
  watch: {
    content: {
      handler(newContent, oldContent) {
        if (newContent !== oldContent) {
          this.loadNotebookContent();
        }
      },
      immediate: true,
    },
  },
};
