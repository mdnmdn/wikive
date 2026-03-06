const PageEditor = {
  template: `
    <div class="page-editor">
      <div ref="editorEl"></div>
    </div>
  `,
  props: ['content', 'resolved'],
  emits: ['save'],
  data() {
    return {
      editor: null,
    };
  },
  mounted() {
    this.initEditor();
  },
  beforeUnmount() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  },
  methods: {
    initEditor() {
      const { Editor } = toastui;
      this.editor = new Editor({
        el: this.$refs.editorEl,
        initialEditType: 'wysiwyg',
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
    },
    getContent() {
      return this.editor ? this.editor.getMarkdown() : this.content;
    },
  },
};
