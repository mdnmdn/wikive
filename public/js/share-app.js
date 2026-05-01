const shareApp = Vue.createApp({
  template: `
    <main class="min-h-screen">
      <div v-if="loading" class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>
      <div v-else-if="error" class="min-h-screen flex items-center justify-center px-6">
        <div class="max-w-lg text-center">
          <h1 class="text-xl font-semibold mb-2">Unable to open shared document</h1>
          <p class="text-sm" style="color: hsl(var(--muted-foreground))">{{ error }}</p>
        </div>
      </div>
      <document-renderer
        v-else-if="document"
        :document="document"
        :content="content"
        mode="view"
        :dark-mode="false"
        :is-shared-view="true"
      ></document-renderer>
    </main>
  `,
  data() {
    return {
      loading: true,
      error: '',
      document: null,
      content: '',
    };
  },
  async mounted() {
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const fileId = params.get('file');
      const docType = params.get('type');
      const name = params.get('name') || 'Untitled';
      const resourceKey = params.get('resourceKey') || '';
      const proxyUrl = params.get('proxy') || '';
      const anonymousShareUrl = params.get('url') || (fileId ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download` : '');

      if (!fileId || !docType || !anonymousShareUrl) {
        throw new Error('Missing share parameters.');
      }

      const targetUrl = proxyUrl || anonymousShareUrl;
      const headers = proxyUrl ? {} : (resourceKey ? {
        'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}`,
      } : {});

      const res = await fetch(targetUrl, { headers });
      if (!res.ok) {
        throw new Error('The shared file is unavailable or no longer public.');
      }

      this.content = await res.text();
      this.document = {
        id: fileId,
        name,
        type: 'file',
        docType,
        parentId: null,
        path: '',
        meta: {
          syntaxType: params.get('syntax') || null,
          expiryTs: params.get('expiry') ? parseInt(params.get('expiry'), 10) : null,
          duration: 0,
          mimeType: null,
          size: null,
          modifiedTime: null,
          createdTime: null,
          anonymousShareUrl,
          resourceKey,
        },
      };
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },
});

shareApp.component('document-renderer', DocumentRenderer);
shareApp.component('markdown-viewer', MarkdownViewer);
shareApp.component('snippet-viewer', SnippetViewer);
shareApp.component('drawing-viewer', DrawingViewer);

shareApp.mount('#app');
