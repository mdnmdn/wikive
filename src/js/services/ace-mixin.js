// Shared Ace editor lifecycle mixin for SnippetViewer and SnippetEditor
const AceMixin = {
  data() {
    return { _aceEditor: null, _aceLoadedModes: new Set(['markdown']), _aceDarkObserver: null };
  },
  mounted() {
    this._aceDarkObserver = new MutationObserver(() => this._aceUpdateTheme());
    this._aceDarkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  },
  beforeUnmount() {
    if (this._aceEditor) { this._aceEditor.destroy(); this._aceEditor.container.remove(); }
    if (this._aceDarkObserver) this._aceDarkObserver.disconnect();
  },
  methods: {
    _aceEnsure(refEl) {
      if (!refEl || this._aceEditor) return;
      this._aceEditor = ace.edit(refEl);
      this._aceUpdateTheme();
      this._aceEditor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true });
    },
    async _aceSetMode(mode) {
      if (!this._aceEditor) return;
      const aceMode = mode === 'text' ? 'text' : mode;
      if (aceMode !== 'text' && !this._aceLoadedModes.has(aceMode)) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.2/mode-' + aceMode + '.min.js';
            s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
          });
          this._aceLoadedModes.add(aceMode);
        } catch { this._aceEditor.session.setMode('ace/mode/text'); return; }
      }
      this._aceEditor.session.setMode('ace/mode/' + aceMode);
    },
    _aceUpdateTheme() {
      if (!this._aceEditor) return;
      this._aceEditor.setTheme(
        document.documentElement.classList.contains('dark') ? 'ace/theme/monokai' : 'ace/theme/github'
      );
    },
    _aceGetValue() {
      return this._aceEditor ? this._aceEditor.getValue() : '';
    },
  },
};
