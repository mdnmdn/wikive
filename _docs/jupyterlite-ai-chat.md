# JupyterLite — AI Chat Integration

## Overview

There are three complementary ways to bring AI capabilities to notebooks in wikive:

| Approach | Where AI runs | What it adds | Complexity |
|----------|--------------|--------------|------------|
| **A — `jupyter-ai` extension** | Inside JupyterLab (in-notebook) | `/ai` chat panel, `%%ai` cell magic, inline completions | Medium (labextension build) |
| **B — wiki AI panel bridge** | Parent wikive app (Hashbrown) | Wiki's existing AI chat accesses notebook content | Low (postMessage) |
| **C — in-cell LLM via `piplite`** | Pyodide kernel (Python) | Direct API calls inside cells with `anthropic`, `openai`, etc. | Low (pip install) |

These approaches are independent and can be combined.

---

## Approach A — `jupyter-ai` labextension

[`jupyter-ai`](https://github.com/jupyterlab/jupyter-ai) is the official JupyterLab AI extension. It
provides:
- `/ai` slash-command in a chat panel within the notebook
- `%%ai` cell magic that sends cell content to an LLM and renders the response inline
- Inline completions (ghost text) as you type
- Support for Anthropic Claude, Google Gemini, OpenAI, Ollama, and many others

### Availability in JupyterLite

As of 2025, `jupyter-ai` supports JupyterLite with the following constraints:
- **Chat panel** (`/ai`): Supported with backends that allow CORS requests from the browser.
- **`%%ai` magic**: Supported in Pyodide kernel.
- **Inline completions**: Supported.
- **Model router**: Requires a running `jupyter-ai` server — not applicable to pure JupyterLite.
  Browser-direct mode (calling LLM APIs directly from JS) is the supported JupyterLite mode.

The recommended provider for JupyterLite is **browser-native fetch** to an OpenAI-compatible API
endpoint, which is what the wiki's existing `AI_URL` Cloudflare Worker exposes.

### Installing jupyter-ai into the JupyterLite bundle

Since the wiki avoids a build step, the cleanest path is to run `jupyter lite build` once:

```bash
pip install jupyterlite-core jupyterlite-pyodide-kernel jupyter-ai

# Build with jupyter-ai included
jupyter lite build \
  --output-dir public/jupyterlite \
  --apps lab repl

# This produces a remoteEntry.js for jupyter-ai in:
# public/jupyterlite/extensions/@jupyter-ai/core/static/remoteEntry.HASH.js
```

After building, commit the updated `public/jupyterlite/` directory.

If you prefer to install manually (without a build step):

1. Download the jupyter-ai labextension tarball from npm:
   ```bash
   npm pack @jupyter-ai/core
   ```
2. Extract and place the `labextension/` contents under
   `public/jupyterlite/extensions/@jupyter-ai/core/`
3. Add to `jupyter-lite.json`:
   ```json
   {
     "jupyter-config-data": {
       "federated_extensions": [
         {
           "extension": "./extension",
           "load": "static/remoteEntry.HASH.js",
           "name": "@jupyter-ai/core",
           "style": "./style"
         }
       ]
     }
   }
   ```

> **Deep dive**:  
> - jupyter-ai GitHub: https://github.com/jupyterlab/jupyter-ai  
> - jupyter-ai docs: https://jupyter-ai.readthedocs.io/  
> - jupyter-ai JupyterLite support: https://jupyter-ai.readthedocs.io/en/latest/users/index.html#jupyterlite

### Configuring the AI provider for browser mode

`jupyter-ai` uses provider configuration stored in JupyterLab settings. To pre-configure it to use the
wiki's existing Cloudflare Worker (which exposes a Gemini/Claude-compatible endpoint), set defaults in
`public/jupyterlite/overrides.json`:

```json
{
  "@jupyter-ai/core:plugin": {
    "providers": {
      "openai-chat": {
        "apiKey": "",
        "baseUrl": "https://wiki-realtime.mdn.workers.dev/v1"
      }
    },
    "defaultModel": "openai-chat:gpt-3.5-turbo"
  }
}
```

The wiki's Cloudflare Worker (`worker/`) would need to expose an OpenAI-compatible `/v1/chat/completions`
endpoint that proxies to Gemini or Claude — the same endpoint used by Hashbrown. See
[`_docs/ai-chat.md`](ai-chat.md) and [`_docs/cloudflare-integration.md`](cloudflare-integration.md) for the
Worker architecture.

### `%%ai` cell magic usage

Once `jupyter-ai` is installed, notebook cells can use the `%%ai` magic:

```python
%%ai anthropic:claude-opus-4-7
Explain what the following Python code does and suggest improvements:

def fib(n):
    return n if n < 2 else fib(n-1) + fib(n-2)
```

Output is rendered inline as markdown below the cell.

Available model strings (depends on configured providers):
- `anthropic:claude-sonnet-4-6`
- `openai:gpt-4o`
- `google-genai:gemini-1.5-pro`
- `ollama:llama3.2` (if Ollama is accessible from the browser)

### API key security

API keys must **not** be hardcoded in `overrides.json` or `jupyter-lite.json` if the wiki is publicly
hosted. Two safe patterns:

1. **Wiki AI proxy** (recommended): Route all LLM calls through the wiki's Cloudflare Worker, which holds
   the API key server-side. Configure `jupyter-ai` to use the Worker URL with no key.

2. **User-entered key**: `jupyter-ai` stores the key in JupyterLab settings (IndexedDB, local to the
   browser). The key is never sent to a server other than the LLM provider directly. This is acceptable
   for personal wikis.

---

## Approach B — wiki AI panel bridge (postMessage)

The wiki already has a full AI chat panel (`AiChatPanel.js`) powered by Hashbrown. By extending the
postMessage bridge (described in [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md)),
the AI chat can:
- Read the currently active notebook cell content
- Insert AI-generated code into a cell
- Answer questions about the notebook's outputs

This requires no additional extensions in JupyterLite — only changes to the bridge script and the wiki's
`AiChatPanel.js` / `ai-tools.js`.

### Bridge messages for AI integration

Add these message types to `public/jupyterlite/bridge.js`:

```js
// In the message listener in bridge.js:

if (type === 'GET_ACTIVE_CELL') {
  await waitForApp();
  const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
  const notebookTracker = app?.shell?.currentWidget;
  const activeCell = notebookTracker?.content?.activeCell;
  event.source.postMessage({
    type: 'ACTIVE_CELL_CONTENT',
    payload: {
      source: activeCell?.model?.sharedModel?.source ?? '',
      outputs: activeCell?.model?.outputs?.toJSON?.() ?? [],
      cellType: activeCell?.model?.type ?? 'code',
    },
  }, event.origin);
}

if (type === 'INSERT_CELL') {
  await waitForApp();
  const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
  const { source, position } = payload;
  await app?.commands.execute('notebook:insert-cell-below');
  const activeCell = app?.shell?.currentWidget?.content?.activeCell;
  if (activeCell) {
    activeCell.model.sharedModel.setSource(source);
  }
}

if (type === 'GET_ALL_CELLS') {
  await waitForApp();
  const app = window._JUPYTERLAB?.['@jupyterlab/application:JupyterLab'];
  const notebook = app?.shell?.currentWidget?.content;
  const cells = notebook?.model?.cells?.map(cell => ({
    source: cell.sharedModel.source,
    outputs: cell.outputs?.toJSON?.() ?? [],
    type: cell.type,
  })) ?? [];
  event.source.postMessage({
    type: 'ALL_CELLS_CONTENT',
    payload: { cells },
  }, event.origin);
}
```

### AI tools for notebooks

Add a `readNotebookCells` tool to `js/services/ai-tools.js` (analogous to the existing `readPage` tool):

```js
// In ai-tools.js — add to the tools array:
{
  name: 'readNotebookCells',
  description: 'Read the cells from the currently open notebook in the editor',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler(_input, context) {
    const notebookEditor = context?.notebookEditorRef;
    if (!notebookEditor) return { error: 'No notebook currently open' };

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data?.type === 'ALL_CELLS_CONTENT') {
          window.removeEventListener('message', handler);
          resolve({ cells: event.data.payload.cells });
        }
      };
      window.addEventListener('message', handler);
      notebookEditor.$refs.notebookFrame?.contentWindow?.postMessage(
        { type: 'GET_ALL_CELLS' }, window.location.origin
      );
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ error: 'Timeout reading notebook cells' });
      }, 5000);
    });
  }
},
{
  name: 'insertNotebookCell',
  description: 'Insert a new code cell into the currently open notebook',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Python code to insert' },
    },
    required: ['source'],
  },
  async handler({ source }, context) {
    context?.notebookEditorRef?.$refs.notebookFrame?.contentWindow?.postMessage(
      { type: 'INSERT_CELL', payload: { source } },
      window.location.origin
    );
    return { success: true };
  }
},
```

To provide `notebookEditorRef` to tools, pass the active renderer ref through the Hashbrown tool context.
The `rendererState` inject/provide system in `app.js` is the cleanest channel for this.

> **Deep dive**:  
> - Hashbrown tools: [`_docs/hashbrown/tools.md`](hashbrown/tools.md)  
> - AI chat architecture: [`_docs/ai-chat.md`](ai-chat.md)  
> - rendererState pattern: [`AGENTS.md`](../AGENTS.md) §Shared reactive state

---

## Approach C — in-cell LLM calls via piplite

The simplest integration: install AI SDK libraries directly in the Pyodide kernel at runtime.

```python
# Cell 1 — install SDK
import piplite
await piplite.install(['anthropic'])

# Cell 2 — use Claude API directly
import anthropic, os

client = anthropic.Anthropic(api_key="YOUR_KEY_HERE")  # or from environment

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain this data briefly: " + str(df.describe())}
    ]
)
print(message.content[0].text)
```

**Security note**: Never hardcode API keys in notebook cells if the notebook is stored in a shared Google
Drive folder. Use environment variables injected by the wiki or user-local secrets storage.

For the wiki's AI proxy pattern, call the Cloudflare Worker endpoint instead of the LLM directly:

```python
import piplite
await piplite.install(['httpx'])

import httpx, json

response = httpx.post(
    "https://wiki-realtime.mdn.workers.dev/v1/chat/completions",
    headers={"Content-Type": "application/json"},
    json={
        "model": "gemini-flash-lite-latest",
        "messages": [{"role": "user", "content": "Your question here"}]
    }
)
print(response.json()["choices"][0]["message"]["content"])
```

> **Deep dive**:
> - Anthropic Python SDK: https://github.com/anthropics/anthropic-sdk-python
> - Pyodide network access: https://pyodide.org/en/stable/usage/faq.html#how-do-i-make-xmlhttprequest-or-fetch-requests-from-pyodide
> - micropip: https://micropip.pyodide.org/en/stable/

---

## Inline completions (Copilot-style ghost text)

`jupyter-ai` 2.x supports inline completions that show ghost text suggestions as you type in code cells.
This uses the `InlineCompleter` JupyterLab API and can be configured to use any LLM backend.

Configuration in `overrides.json`:

```json
{
  "@jupyter-ai/core:inline-completer": {
    "providers": {
      "openai-chat": {
        "model_id": "gpt-4o-mini",
        "num_completions": 1
      }
    },
    "enabled": true
  }
}
```

Performance note: inline completions fire on every keypress with a configurable debounce delay. For
latency-sensitive users, set a longer debounce or disable completions and rely on `%%ai` magic instead.

---

## Choosing a strategy

For the wikive project, the recommended progression is:

1. **Start with Approach C** (no build step, immediate value for technical users who want to experiment
   with LLMs in notebooks). Provide a starter notebook template with the wiki's Worker URL pre-filled.

2. **Add Approach B** (postMessage bridge to Hashbrown) once the Drive sync bridge from
   [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) is in place. This unlocks "ask AI
   about this notebook" from the existing chat panel without touching the JupyterLite bundle.

3. **Add Approach A** (`jupyter-ai` extension) when users want the in-notebook chat panel and `%%ai` magic.
   This requires a one-time `jupyter lite build` run.

---

## Provider configuration reference

The wiki's existing AI providers (from [`_docs/ai-chat.md`](ai-chat.md)) can be reused:

| Wiki config | jupyter-ai provider | Notes |
|-------------|---------------------|-------|
| `AI_MODEL = "gemini-flash-lite-latest"` | `google-genai:gemini-1.5-flash` | Needs `GOOGLE_API_KEY` |
| `AI_URL` (Cloudflare Worker) | `openai-chat` with custom `base_url` | Proxy avoids CORS and hides key |
| Claude via Hashbrown | `anthropic:claude-sonnet-4-6` | Needs `ANTHROPIC_API_KEY` |

---

## References

| Resource | URL |
|----------|-----|
| jupyter-ai GitHub | https://github.com/jupyterlab/jupyter-ai |
| jupyter-ai docs | https://jupyter-ai.readthedocs.io/ |
| jupyter-ai JupyterLite support | https://jupyter-ai.readthedocs.io/en/latest/users/index.html#jupyterlite |
| `%%ai` magic reference | https://jupyter-ai.readthedocs.io/en/latest/users/index.html#the-ai-magic-command |
| Inline completions | https://jupyter-ai.readthedocs.io/en/latest/users/index.html#inline-completions |
| JupyterLab InlineCompleter API | https://jupyterlab.readthedocs.io/en/stable/api/modules/completer.html |
| Anthropic Python SDK | https://github.com/anthropics/anthropic-sdk-python |
| Pyodide network FAQ | https://pyodide.org/en/stable/usage/faq.html |
| micropip | https://micropip.pyodide.org/en/stable/ |
| OpenAI Python SDK | https://github.com/openai/openai-python |
| Google GenerativeAI SDK | https://github.com/google-gemini/generative-ai-python |
| Hashbrown tools reference | _docs/hashbrown/tools.md |
| Wiki AI chat architecture | _docs/ai-chat.md |
