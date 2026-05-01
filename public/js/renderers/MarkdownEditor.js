const MarkdownEditor = {
  template: `
    <div class="page-editor">
      <div ref="editorEl"></div>
    </div>
  `,
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['save'],
  data() {
    return { editor: null };
  },
  mounted() {
    this.initEditor();
  },
  beforeUnmount() {
    if (this.editor) { this.editor.destroy(); this.editor = null; }
  },
  methods: {
    initEditor() {
      const { Editor } = toastui;
      const savedMode = localStorage.getItem('editorMode') || 'wysiwyg';
      this.editor = new Editor({
        el: this.$refs.editorEl,
        initialEditType: savedMode,
        previewStyle: 'vertical',
        height: '100%',
        initialValue: this.content || '',
        usageStatistics: false,
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task', 'indent', 'outdent'],
          ['table', 'link'],
          ['code', 'codeblock'],
        ],
      });
      this.editor.on('changeMode', (mode) => {
        localStorage.setItem('editorMode', mode);
      });
    },
    getContent() {
      return this.editor ? this.editor.getMarkdown() : this.content;
    },
  },
};
