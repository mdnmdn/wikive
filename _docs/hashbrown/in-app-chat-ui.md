# In-App Chat UI

## Ready-made components — assessment

| Option | Verdict |
|--------|---------|
| `@hashbrownai/react`, `@hashbrownai/angular` | React/Angular only — not usable here |
| Generic Vue chat libraries (vue-advanced-chat, etc.) | Provide message layout but have no Hashbrown integration; bridging cost equals writing from scratch |
| Headless UI / Radix Vue | Primitives only (dialogs, popovers) — no chat layout |
| **Conclusion** | **Build from scratch.** The component is ~150 lines and must be wired directly to Hashbrown's `StateSignal` API. |

The upside: a purpose-built component is small, has no extra dependencies, and
can be styled to match the existing wiki theme exactly.

## Component map

```
AiChatPanel.js           ← slide-in panel, message list, input bar
  ├─ AiMessage            ← assistant bubble (streaming + tool calls)
  └─ AiToolCallBadge      ← per-tool-call status badge (running / done / error)

js/services/ai-chat.js   ← fryHashbrown() wrapper (see vanilla-js-client.md)
js/services/ai-tools.js  ← readPage / writePage / etc. (see tools.md)
js/services/ai-prompt.js ← system prompt constant
```

## AiChatPanel.js

```js
// js/components/AiChatPanel.js

const AiChatPanel = {
  name: 'AiChatPanel',

  props: {
    chat:      { type: Object,  required: true }, // { chat: Hashbrown, destroy: fn }
    model:     { type: String,  default: 'gemini-2.0-flash' },
    pageContext:{ type: String, default: '' },  // current page path for context
  },

  emits: ['close', 'page-refresh'],

  data() {
    return {
      input: '',
      messages: [],
      isGenerating: false,
      isRunningToolCalls: false,
      error: null,
      _unsubs: [],
    };
  },

  mounted() {
    const { chat } = this.chat;
    this._unsubs = [
      chat.messages.subscribe(v          => { this.messages = v; this.scrollToBottom(); }),
      chat.isGenerating.subscribe(v      => { this.isGenerating = v; }),
      chat.isRunningToolCalls.subscribe(v=> { this.isRunningToolCalls = v; }),
      chat.error.subscribe(v             => { this.error = v ?? null; }),
    ];
  },

  beforeUnmount() {
    this._unsubs.forEach(fn => fn());
  },

  computed: {
    // Only user and assistant turns are shown.
    // Tool messages exist in the history but are internal LLM context.
    visibleMessages() {
      return this.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    },

    // The last assistant message may contain in-progress tool calls.
    // Pair each call with its result (tool message) so we know if it completed.
    toolCallStatuses() {
      const toolResultsByCallId = Object.fromEntries(
        this.messages
          .filter(m => m.role === 'tool')
          .map(m => [m.toolCallId, m.content])
      );

      const lastAssistant = [...this.messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant?.toolCalls?.length) return [];

      return lastAssistant.toolCalls.map(tc => ({
        id:     tc.id,
        name:   tc.function?.name ?? 'tool',
        args:   safeParseJson(tc.function?.arguments),
        result: toolResultsByCallId[tc.id], // PromiseSettledResult or undefined
        status: toolResultsByCallId[tc.id]
          ? (toolResultsByCallId[tc.id].status === 'rejected' ? 'error' : 'done')
          : 'running',
      }));
    },

    showTypingIndicator() {
      return this.isGenerating && !this.isRunningToolCalls &&
        (this.visibleMessages.at(-1)?.role !== 'assistant' ||
         !this.visibleMessages.at(-1)?.content);
    },
  },

  methods: {
    send() {
      const text = this.input.trim();
      if (!text || this.isGenerating) return;
      this.input = '';
      this.chat.chat.sendMessage({ role: 'user', content: text });
    },

    clear() {
      this.chat.chat.setMessages([]);
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.messageList;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    formatToolLabel(tc) {
      const labels = {
        readPage:   `Reading "${tc.args?.path ?? ''}"`,
        writePage:  `Writing "${tc.args?.path ?? ''}"`,
        listPages:  'Listing pages',
        deletePage: `Deleting "${tc.args?.path ?? ''}"`,
      };
      return labels[tc.name] ?? tc.name;
    },
  },

  template: `
    <div class="ai-panel">
      <div class="ai-panel-header">
        <span class="ai-panel-title">AI Assistant</span>
        <span class="ai-panel-model">{{ model }}</span>
        <button class="nav-btn" @click="clear" title="Clear history">↺</button>
        <button class="nav-btn" @click="$emit('close')" title="Close">✕</button>
      </div>

      <div class="ai-panel-messages" ref="messageList">
        <div v-if="visibleMessages.length === 0" class="ai-panel-empty">
          Ask me anything about your wiki.
        </div>

        <template v-for="(msg, i) in visibleMessages" :key="i">
          <div :class="['ai-message', 'ai-message--' + msg.role]">
            <div class="ai-message-role">{{ msg.role === 'user' ? 'You' : 'AI' }}</div>

            <!-- Streaming or complete text content -->
            <div
              v-if="msg.content"
              class="ai-message-content prose"
              v-html="renderMd(msg.content)"
            ></div>

            <!-- Tool call badges — shown on the last assistant message -->
            <div
              v-if="msg.role === 'assistant' && i === visibleMessages.length - 1 && toolCallStatuses.length"
              class="ai-tool-calls"
            >
              <div
                v-for="tc in toolCallStatuses"
                :key="tc.id"
                :class="['ai-tool-badge', 'ai-tool-badge--' + tc.status]"
              >
                <span class="ai-tool-icon">
                  {{ tc.status === 'running' ? '⏳' : tc.status === 'error' ? '✗' : '✓' }}
                </span>
                <span class="ai-tool-label">{{ formatToolLabel(tc) }}</span>
                <span v-if="tc.status === 'error'" class="ai-tool-error">
                  {{ tc.result?.reason?.message ?? 'failed' }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- Typing indicator: AI is thinking but no text yet -->
        <div v-if="showTypingIndicator" class="ai-typing">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div v-if="error" class="ai-panel-error">
        ⚠ {{ error.message }}
        <button class="nav-btn" @click="chat.chat.resendMessages()">Retry</button>
      </div>

      <div class="ai-panel-input-row">
        <textarea
          v-model="input"
          class="ai-panel-input"
          placeholder="Ask the AI…"
          rows="2"
          :disabled="isGenerating"
          @keydown.enter.exact.prevent="send"
          @keydown.enter.shift.exact.prevent="input += '\\n'"
        ></textarea>
        <button
          class="ai-panel-send"
          :disabled="!input.trim() || isGenerating"
          @click="send"
        >↑</button>
      </div>
    </div>
  `,
};

// Reuse the app's existing marked instance if available, else plain text
function renderMd(content) {
  if (!content) return '';
  return typeof marked !== 'undefined' ? marked.parse(content) : content;
}

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
```

## Wiring into app.js

```js
// js/app.js

import { createAiChat }   from './services/ai-chat.js';
import { readPageTool, writePageTool, listPagesTool } from './services/ai-tools.js';
import { WIKI_ASSISTANT_SYSTEM } from './services/ai-prompt.js';

// Register component
app.component('AiChatPanel', AiChatPanel);

// In data():
aiChat: null,
aiPanelOpen: false,
aiModel: 'gemini-2.0-flash',  // user-selectable, see below

// After login (createAiChat lazily — only when the panel is first opened):
openAiPanel() {
  this.aiPanelOpen = true;
  if (!this.aiChat) {
    this.aiChat = createAiChat({
      model: this.aiModel,
      system: WIKI_ASSISTANT_SYSTEM,
      tools: [readPageTool, writePageTool, listPagesTool],
    });
    // When the AI writes a page that is currently open, refresh it
    window.addEventListener('ai:page-written', ({ detail }) => {
      if (this.currentPath === detail.path) this.refreshPage();
    });
  }
},

// In template:
// <button @click="openAiPanel">✦</button>
// <AiChatPanel
//   v-if="aiPanelOpen"
//   :chat="aiChat"
//   :model="aiModel"
//   :page-context="currentPath"
//   @close="aiPanelOpen = false"
// />

// Cleanup
beforeUnmount() {
  this.aiChat?.destroy();
}
```

## Model selector (optional)

Let the user pick the provider from the header:

```js
// In data():
AI_MODELS: [
  { label: 'Gemini 2.0 Flash',      value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Pro',        value: 'gemini-1.5-pro' },
  { label: 'Claude 3.5 Sonnet',     value: 'claude-3-5-sonnet-20241022' },
  { label: 'Claude 3.5 Haiku',      value: 'claude-3-5-haiku-20241022' },
  { label: 'GPT-4o',                value: 'gpt-4o' },
  { label: 'GPT-4o mini',           value: 'gpt-4o-mini' },
],

// In template (inside the AI panel header or a settings dropdown):
// <select v-model="aiModel" @change="onModelChange">
//   <option v-for="m in AI_MODELS" :key="m.value" :value="m.value">{{ m.label }}</option>
// </select>

// Method to apply the change:
onModelChange() {
  this.aiChat?.chat.updateOptions({ model: this.aiModel });
  localStorage.setItem('wiki:ai-model', this.aiModel);
},

// Restore on mount:
mounted() {
  this.aiModel = localStorage.getItem('wiki:ai-model') ?? 'gemini-2.0-flash';
}
```

## CSS (css/app.css additions)

```css
/* ── AI panel ────────────────────────────────────────────── */
.ai-panel {
  display: flex; flex-direction: column;
  width: 360px; min-width: 280px;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  position: fixed; right: 0; top: 0; bottom: 0;
  z-index: 200;
  box-shadow: -6px 0 24px rgba(0,0,0,.1);
  font-size: .875rem;
}

.ai-panel-header {
  display: flex; align-items: center; gap: .5rem;
  padding: .65rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}
.ai-panel-title { font-weight: 600; flex: 1; }
.ai-panel-model { font-size: .7rem; opacity: .5; }

/* ── Messages ────────────────────────────────────────────── */
.ai-panel-messages {
  flex: 1; overflow-y: auto;
  padding: 1rem; display: flex; flex-direction: column; gap: .75rem;
  scroll-behavior: smooth;
}
.ai-panel-empty { text-align: center; opacity: .4; margin-top: 2rem; }

.ai-message { display: flex; flex-direction: column; gap: .2rem; max-width: 100%; }
.ai-message-role { font-size: .65rem; font-weight: 700; text-transform: uppercase;
  opacity: .4; letter-spacing: .05em; }

.ai-message--user .ai-message-content {
  background: hsl(var(--primary) / .08);
  border: 1px solid hsl(var(--primary) / .15);
  border-radius: 8px; padding: .5rem .75rem;
}
.ai-message--assistant .ai-message-content { padding: .25rem 0; }
.ai-message-content .prose p:last-child { margin-bottom: 0; }

/* ── Tool call badges ─────────────────────────────────────── */
.ai-tool-calls { display: flex; flex-direction: column; gap: .3rem; margin-top: .4rem; }

.ai-tool-badge {
  display: flex; align-items: center; gap: .4rem;
  font-size: .75rem; padding: .3rem .6rem;
  border-radius: 6px; border: 1px solid;
}
.ai-tool-badge--running {
  background: hsl(45 90% 96%); border-color: hsl(45 80% 80%); color: hsl(35 70% 35%);
}
.ai-tool-badge--done {
  background: hsl(140 60% 96%); border-color: hsl(140 50% 75%); color: hsl(140 50% 30%);
}
.ai-tool-badge--error {
  background: hsl(0 80% 97%); border-color: hsl(0 70% 80%); color: hsl(0 60% 40%);
}
.ai-tool-icon { flex-shrink: 0; }
.ai-tool-label { font-weight: 500; }
.ai-tool-error { opacity: .7; font-size: .7rem; }

/* ── Typing indicator ────────────────────────────────────── */
.ai-typing {
  display: flex; gap: 4px; align-items: center; padding: .25rem 0;
}
.ai-typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: hsl(var(--primary) / .5);
  animation: ai-bounce .7s infinite alternate ease-in-out;
}
.ai-typing span:nth-child(2) { animation-delay: .15s; }
.ai-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes ai-bounce {
  from { transform: translateY(0); opacity: .4; }
  to   { transform: translateY(-5px); opacity: 1; }
}

/* ── Error bar ───────────────────────────────────────────── */
.ai-panel-error {
  display: flex; align-items: center; gap: .5rem;
  background: hsl(0 80% 97%); color: hsl(0 60% 40%);
  padding: .5rem 1rem; font-size: .8rem; flex-shrink: 0;
}
.ai-panel-error .nav-btn { margin-left: auto; }

/* ── Input bar ───────────────────────────────────────────── */
.ai-panel-input-row {
  display: flex; align-items: flex-end; gap: .5rem;
  padding: .75rem; border-top: 1px solid hsl(var(--border)); flex-shrink: 0;
}
.ai-panel-input {
  flex: 1; resize: none;
  border: 1px solid hsl(var(--border)); border-radius: 8px;
  padding: .5rem .75rem; font-size: .875rem;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  font-family: inherit; line-height: 1.5;
  transition: border-color .15s;
}
.ai-panel-input:focus { outline: none; border-color: hsl(var(--primary)); }
.ai-panel-input:disabled { opacity: .5; }

.ai-panel-send {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
  background: hsl(var(--primary)); color: white; border: none;
  font-size: 1.1rem; cursor: pointer; transition: opacity .15s;
}
.ai-panel-send:disabled { opacity: .4; cursor: not-allowed; }
.ai-panel-send:hover:not(:disabled) { opacity: .85; }
```

## Tool writing indication — how it works

Hashbrown surfaces tool call state through two mechanisms:

| Signal / data | When set | Use |
|---------------|----------|-----|
| `isRunningToolCalls` | True while any tool handler is executing | Show a general "working" state |
| `messages` (tool entries) | Added after each tool call completes | Determine per-call done/error state |
| `lastAssistantMessage.toolCalls` | Present when the LLM decided to call tools | List which tools were invoked |

The `toolCallStatuses` computed property in the component above pairs each
`toolCalls` entry from the last assistant message with its corresponding `tool`
message (matched by `toolCallId`) to derive `running` / `done` / `error` per
tool call. This gives fine-grained status badges rather than a single spinner.

### Tool call lifecycle in the message array

```
messages = [
  { role: 'user',      content: 'Summarize the home page' },
  { role: 'assistant', content: null,  toolCalls: [{ id: 'tc_1', function: { name: 'readPage', arguments: '{"path":"home"}' } }] },
                        ↑ badge shows "⏳ Reading home" while tool runs
  { role: 'tool',      toolCallId: 'tc_1', toolName: 'readPage', content: { status: 'fulfilled', value: '# Home\n...' } },
                        ↑ badge updates to "✓ Reading home" once this arrives
  { role: 'assistant', content: 'The home page introduces...' },
]
```

## References

| Resource | URL |
|----------|-----|
| `Chat.Api.AssistantMessage` / `ToolCall` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/models/api.models.ts |
| `Hashbrown` instance signals source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/hashbrown.ts |
| Frame types (tool call lifecycle) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/frames/frame-types.ts |
| Tool effects source (dispatch lifecycle) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/effects/tools.effects.ts |
| Message reducer source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/reducers/messages.reducer.ts |
| `updateAssistantMessage` source (streaming merge) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/utils/assistant-message.ts |
| Recipe: UI chatbot | https://hashbrown.dev/docs/react/recipes/ui-chatbot |
| Concepts: generative UI components | https://hashbrown.dev/docs/react/concept/components |
| Concepts: magic text renderer | https://hashbrown.dev/docs/react/recipes/magic-text |
| Concepts: streaming | https://hashbrown.dev/docs/react/concept/streaming |
