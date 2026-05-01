// AiChatPanel — floating chat panel for AI assistant
const AiChatPanel = {
  name: 'AiChatPanel',

  props: {
    chat: { type: Object, required: true },
    model: { type: String, default: 'gemini:gemini-2.0-flash' },
    pageContext: { type: String, default: '' },
    aiProviders: { type: Array, default: () => [] },
    providersSaving: { type: Boolean, default: false },
  },

  emits: ['close', 'page-refresh', 'model-change', 'providers-change'],

  data() {
    return {
      input: '',
      messages: [],
      isGenerating: false,
      isRunningToolCalls: false,
      error: null,
      availableModels: [],
      tools: [],
      _unsubs: [],
      showSettings: false,
    };
  },

  mounted() {
    this.availableModels = window.AI_MODELS || [];
    if (typeof window.getWikiTools === 'function') {
      window.getWikiTools().then(t => { this.tools = t; });
    }
    const { chat } = this.chat;
    this._unsubs = [
      chat.messages.subscribe(v => { this.messages = v; this.scrollToBottom(); }),
      chat.isGenerating.subscribe(v => { this.isGenerating = v; }),
      chat.isRunningToolCalls.subscribe(v => { this.isRunningToolCalls = v; }),
      chat.error.subscribe(v => { this.error = v ?? null; }),
    ];
  },

  beforeUnmount() {
    this._unsubs.forEach(fn => fn());
  },

  computed: {
    // When providers are configured use their models; otherwise fall back to AI_MODELS from backend
    effectiveModels() {
      if (this.aiProviders && this.aiProviders.length > 0) {
        return this.aiProviders.flatMap(p =>
          (p.models || []).map(m => ({
            label: `${p.name} › ${m}`,
            value: `${p.id}::${m}`,
          }))
        );
      }
      return this.availableModels;
    },

    visibleMessages() {
      return this.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    },

    toolCallStatuses() {
      const toolResultsByCallId = Object.fromEntries(
        this.messages
          .filter(m => m.role === 'tool')
          .map(m => [m.toolCallId, m.content])
      );

      const lastAssistant = [...this.messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant?.toolCalls?.length) return [];

      return lastAssistant.toolCalls.map(tc => ({
        id: tc.id,
        name: tc.function?.name ?? 'tool',
        args: safeParseJson(tc.function?.arguments),
        result: toolResultsByCallId[tc.id],
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

    modelLabel() {
      return (this.effectiveModels.find(m => m.value === this.model) ?? {}).label ?? this.model;
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
      const tool = this.tools.find(t => t.name === tc.name);
      return tool?.label?.(tc.args) ?? tc.name;
    },

    onModelChange(e) {
      const newModel = e.target.value;
      this.$emit('model-change', newModel);
    },

    onProvidersSave(providers) {
      this.$emit('providers-change', providers);
    },

    renderContent(content) {
      if (!content) return '';
      if (typeof marked !== 'undefined') {
        return marked.parse(content);
      }
      return content.replace(/\n/g, '<br>');
    },
  },

  components: { 'ai-settings-panel': AiSettingsPanel },

  template: `
    <div class="ai-panel">
      <div class="ai-panel-header">
        <span class="ai-panel-title">AI Assistant</span>
        <select
          v-if="!showSettings"
          class="ai-panel-model-select"
          :value="model"
          @change="onModelChange"
        >
          <option v-for="m in effectiveModels" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <button class="nav-btn" @click="showSettings = !showSettings" :title="showSettings ? 'Back to chat' : 'AI settings'">
          <span class="ms" style="font-size:1rem">{{ showSettings ? 'chat' : 'settings' }}</span>
        </button>
        <button v-if="!showSettings" class="nav-btn" @click="clear" title="Clear history">
          <span class="ms" style="font-size:1rem">delete_sweep</span>
        </button>
        <button class="nav-btn" @click="$emit('close')" title="Close">
          <span class="ms" style="font-size:1rem">close</span>
        </button>
      </div>

      <!-- Settings panel replaces message area -->
      <ai-settings-panel
        v-if="showSettings"
        :providers="aiProviders"
        :saving="providersSaving"
        @save="onProvidersSave"
        @back="showSettings = false"
      ></ai-settings-panel>

      <template v-else>
        <div class="ai-panel-messages" ref="messageList">
          <div v-if="visibleMessages.length === 0" class="ai-panel-empty">
            Ask me anything about your wiki.
          </div>

          <template v-for="(msg, i) in visibleMessages" :key="i">
            <div :class="['ai-message', 'ai-message--' + msg.role]">
              <div class="ai-message-role">{{ msg.role === 'user' ? 'You' : 'AI' }}</div>

              <div
                v-if="msg.content"
                class="ai-message-content prose"
                v-html="renderContent(msg.content)"
              ></div>

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
          >
            <span class="ms" style="font-size:1.125rem">arrow_upward</span>
          </button>
        </div>
      </template>
    </div>
  `,
};

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
