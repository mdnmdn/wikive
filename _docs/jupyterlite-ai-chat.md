# JupyterLite — AI Chat Integration

## Overview

> **Important distinction**: `jupyter-ai` (the popular JupyterLab AI extension) requires a running Python
> server and is **NOT compatible with JupyterLite**. The browser-native equivalent is **`jupyterlite-ai`**,
> a separate package maintained by the JupyterLite project.

There are three complementary ways to bring AI capabilities to notebooks in wikive:

| Approach | Where AI runs | What it adds | Complexity |
|----------|--------------|--------------|------------|
| **A — `jupyterlite-ai` extension** | Inside JupyterLab (in-notebook) | Chat panel, inline completions, WebLLM (offline), OpenAI/Anthropic | Medium (labextension build) |
| **B — wiki AI panel bridge** | Parent wikive app (Hashbrown) | Wiki's existing AI chat accesses notebook content | Low (postMessage) |
| **C — in-cell LLM via `piplite`** | Pyodide kernel (Python) | Direct API calls inside cells with `anthropic`, `openai`, etc. | Low (pip install) |

These approaches are independent and can be combined.

---

## Approach A — `jupyterlite-ai` extension

[`jupyterlite-ai`](https://github.com/jupyterlite/ai) is the browser-native AI extension for JupyterLite
maintained by the JupyterLite project itself. It provides:

- **Inline completions** — ghost text suggestions as you type in code cells
- **Chat panel** — sidebar AI chat inside the notebook environment
- **WebLLM support** — run LLMs locally in-browser via WebGPU (fully offline, no API key needed)
- **Ollama support** — connect to a local Ollama instance
- **Cloud providers** — OpenAI, Anthropic, any OpenAI-compatible endpoint

Live demo: https://jupyterlite.github.io/ai/lab/index.html

> **Do not confuse with `jupyter-ai`**: The `jupyter-ai` package (https://github.com/jupyterlab/jupyter-ai)
> requires a Python server backend and is **incompatible with JupyterLite**. Always use `jupyterlite-ai`
> for browser-only deployments.

### Installing jupyterlite-ai into the JupyterLite bundle

Since the wiki avoids a build step, the cleanest path is to run `jupyter lite build` once:

```bash
pip install jupyterlite-core jupyterlite-pyodide-kernel jupyterlite-ai

# Build with jupyterlite-ai included
jupyter lite build \
  --output-dir public/jupyterlite \
  --apps lab repl

# Commit the output
git add public/jupyterlite && git commit -m "add jupyterlite-ai extension"
```

> **Deep dive**:
> - jupyterlite-ai GitHub: https://github.com/jupyterlite/ai
> - jupyterlite-ai docs: https://jupyterlite-ai.readthedocs.io/
> - Live demo: https://jupyterlite.github.io/ai/lab/index.html

### Supported providers

| Provider | Requires | Notes |
|----------|----------|-------|
| **WebLLM** | WebGPU-capable browser | Runs Llama, Phi, Gemma, Mistral, Qwen etc. fully offline; no API key |
| **Ollama** | Local Ollama running at `localhost:11434` | User must run `ollama serve` locally |
| **OpenAI** | API key (user-entered in settings) | Direct browser → OpenAI calls |
| **Anthropic** | API key (user-entered in settings) | Direct browser → Anthropic calls |
| **any-llm-gateway** | OpenAI-compatible endpoint URL | Routes to 100+ providers via a proxy |

### Configuring the wiki's Cloudflare Worker as provider

The wiki's existing `AI_URL` Cloudflare Worker can serve as an `any-llm-gateway`-compatible endpoint.
Pre-configure it in `public/jupyterlite/overrides.json`:

```json
{
  "@jupyterlite/ai:completions": {
    "provider": "openai-chat",
    "baseUrl": "https://wiki-realtime.mdn.workers.dev/v1",
    "apiKey": "",
    "model": "gemini-flash-lite-latest"
  },
  "@jupyterlite/ai:chat": {
    "provider": "openai-chat",
    "baseUrl": "https://wiki-realtime.mdn.workers.dev/v1",
    "apiKey": "",
    "model": "gemini-flash-lite-latest"
  }
}
```

The Cloudflare Worker (`worker/`) must expose a `/v1/chat/completions` route. See
[`_docs/ai-chat.md`](ai-chat.md) and [`_docs/cloudflare-integration.md`](cloudflare-integration.md) for the
Worker architecture.

### WebLLM (fully offline AI)

WebLLM uses WebGPU to run quantized LLMs directly in the browser — no server, no API key:

```json
{
  "@jupyterlite/ai:chat": {
    "provider": "webllm",
    "model": "Llama-3.2-3B-Instruct-q4f16_1-MLC"
  }
}
```

Available WebLLM models: https://mlc.ai/mlc-llm/docs/prebuilt_models.html

First run downloads the model (~2-4 GB) to the browser cache. Subsequent runs are instant.
Requires Chrome 113+ or Firefox 121+ with WebGPU enabled.

### API key security

API keys must **not** be hardcoded in `overrides.json` if the wiki is publicly hosted. Two safe patterns:

1. **Wiki AI proxy** (recommended): Route all LLM calls through the wiki's Cloudflare Worker, which holds
   the API key server-side. Configure `jupyterlite-ai` to use the Worker URL with an empty key.

2. **User-entered key**: `jupyterlite-ai` stores the key in JupyterLab settings (IndexedDB, local to the
   browser). The key is never sent anywhere except the LLM provider. Acceptable for personal wikis.

3. **WebLLM** (most secure): No key needed at all — model runs entirely on the user's GPU.

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

`jupyterlite-ai` supports inline completions that show ghost text suggestions as you type in code cells.
This uses the JupyterLab `InlineCompleter` API.

Configuration in `overrides.json`:

```json
{
  "@jupyterlite/ai:completions": {
    "provider": "openai-chat",
    "baseUrl": "https://wiki-realtime.mdn.workers.dev/v1",
    "model": "gemini-flash-lite-latest",
    "enabled": true,
    "debouncerDelay": 250
  }
}
```

Performance note: inline completions fire on every keypress after the debounce delay. For
latency-sensitive users, increase `debouncerDelay` to 500–1000 ms or disable completions entirely and
rely on the chat panel instead.

---

## Choosing a strategy

For the wikive project, the recommended progression is:

1. **Start with Approach C** (no build step, immediate value for technical users who want to experiment
   with LLMs in notebooks). Provide a starter notebook template with the wiki's Worker URL pre-filled.

2. **Add Approach B** (postMessage bridge to Hashbrown) once the Drive sync bridge from
   [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md) is in place. This unlocks "ask AI
   about this notebook" from the existing chat panel without touching the JupyterLite bundle.

3. **Add Approach A** (`jupyterlite-ai` extension) when users want the in-notebook chat panel and inline
   completions. This requires a one-time `jupyter lite build` run. Consider offering WebLLM as the default
   provider for privacy-conscious users.

---

## Provider configuration reference

The wiki's existing AI providers (from [`_docs/ai-chat.md`](ai-chat.md)) can be reused with `jupyterlite-ai`:

| Wiki config | jupyterlite-ai provider | Notes |
|-------------|-------------------------|-------|
| `AI_MODEL = "gemini-flash-lite-latest"` | `openai-chat` + Worker proxy | Worker converts to Gemini API |
| `AI_URL` (Cloudflare Worker) | `openai-chat` with custom `baseUrl` | Proxy avoids CORS and hides key |
| Claude via Hashbrown | `anthropic` with API key | Needs `ANTHROPIC_API_KEY` in settings |
| No server | `webllm` | Runs local model, no key needed |

---

## References

| Resource | URL |
|----------|-----|
| jupyterlite-ai GitHub | https://github.com/jupyterlite/ai |
| jupyterlite-ai docs | https://jupyterlite-ai.readthedocs.io/ |
| jupyterlite-ai live demo | https://jupyterlite.github.io/ai/lab/index.html |
| any-llm-gateway integration | https://jupyterlite-ai.readthedocs.io/en/latest/any-llm-gateway/ |
| WebLLM (in-browser LLM) | https://mlc.ai/mlc-llm/ |
| WebLLM prebuilt models | https://mlc.ai/mlc-llm/docs/prebuilt_models.html |
| JupyterLab InlineCompleter API | https://jupyterlab.readthedocs.io/en/stable/api/modules/completer.html |
| jupyter-ai (server only, NOT for JupyterLite) | https://github.com/jupyterlab/jupyter-ai |
| Anthropic Python SDK | https://github.com/anthropics/anthropic-sdk-python |
| Pyodide network FAQ | https://pyodide.org/en/stable/usage/faq.html |
| micropip | https://micropip.pyodide.org/en/stable/ |
| OpenAI Python SDK | https://github.com/openai/openai-python |
| Hashbrown tools reference | _docs/hashbrown/tools.md |
| Wiki AI chat architecture | _docs/ai-chat.md |
