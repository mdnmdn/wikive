// Shared markdown rendering utilities used by MarkdownViewer and FolderViewer
const MarkdownService = {
  render(md) {
    const renderer = new marked.Renderer();
    renderer.code = function ({ text, lang }) {
      if (lang === 'mermaid') return '<pre class="mermaid">' + text + '</pre>';
      const highlighted = hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
      return '<pre><code class="hljs language-' + (lang || 'plaintext') + '">' + highlighted + '</code></pre>';
    };
    marked.setOptions({ renderer, gfm: true, breaks: false });
    return marked.parse(md);
  },

  renderMermaid(el) {
    if (!el) return;
    const nodes = el.querySelectorAll('.mermaid');
    if (nodes.length > 0 && typeof mermaid !== 'undefined') mermaid.run({ nodes });
  },

  interceptLinks(el, currentDocPath, emitNavigate) {
    if (!el) return;
    el.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const base = currentDocPath ? currentDocPath.split('/').slice(0, -1).join('/') : '';
          const resolved = base ? base + '/' + href : href;
          emitNavigate(resolved.replace(/\.md$/, ''));
        });
      }
    });
  },
};
