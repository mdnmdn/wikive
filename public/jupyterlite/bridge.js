(function () {
  'use strict';

  // Wait for JupyterLab application to be fully ready
  async function waitForApp() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        // JupyterLab exposes itself on window._JUPYTERLAB after bootstrap
        if (window._JUPYTERLAB && window._JUPYTERLAB['@jupyterlab/application:ILabShell']) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });
  }

  async function getContentsManager() {
    // The ServiceManager singleton is available after app init
    const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
    return app?.serviceManager?.contents;
  }

  window.addEventListener('message', async (event) => {
    // Always verify origin — replace with your actual wiki origin
    const allowedOrigin = window.location.origin; // same-origin case
    if (event.origin !== allowedOrigin && allowedOrigin !== '*') return;

    const { type, payload } = event.data || {};

    if (type === 'LOAD_NOTEBOOK') {
      await waitForApp();
      const contents = await getContentsManager();
      if (!contents) return;

      const { name, content } = payload;

      // Check if content changed to avoid redundant saves and reloads
      try {
        const existing = await contents.get(name, { content: true });
        if (JSON.stringify(existing.content) === JSON.stringify(content)) {
          return;
        }
      } catch (e) {
        // File doesn't exist, proceed to save
      }

      // Write the notebook into JupyterLite's virtual FS
      await contents.save(name, {
        type: 'notebook',
        format: 'json',
        content: content, // parsed nbformat JSON object
      });

      // Open it in the Lab shell only if it's not already the current widget
      const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
      const shell = window._JUPYTERLAB?.['@jupyterlab/application:ILabShell'];
      const currentWidget = shell?.currentWidget;
      if (currentWidget?.context?.path !== name) {
        await app?.commands.execute('docmanager:open', { path: name });
      }

      // Notify parent that load succeeded
      event.source.postMessage({ type: 'NOTEBOOK_LOADED', payload: { name } }, event.origin);
    }

    if (type === 'GET_NOTEBOOK') {
      await waitForApp();
      const contents = await getContentsManager();
      if (!contents) return;
      const { name } = payload;
      try {
        const model = await contents.get(name, { content: true });
        event.source.postMessage({
          type: 'NOTEBOOK_CONTENT',
          payload: { name, content: model.content },
        }, event.origin);
      } catch (e) {
        event.source.postMessage({ type: 'NOTEBOOK_ERROR', payload: { error: e.message } }, event.origin);
      }
    }
  });

  // Forward auto-save events to the parent
  async function setupSaveListener() {
    await waitForApp();
    const contents = await getContentsManager();
    if (!contents) return;

    contents.fileChanged.connect((_, change) => {
      if (change.type === 'save' && change.newValue?.type === 'notebook') {
        window.parent.postMessage({
          type: 'NOTEBOOK_SAVED',
          payload: {
            name: change.newValue.name,
            content: change.newValue.content,
          },
        }, window.location.origin);
      }
    });
  }

  setupSaveListener();
})();
