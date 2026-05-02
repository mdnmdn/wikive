const AiSettingsPanel = {
  name: 'AiSettingsPanel',
  props: {
    providers: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
    encryptionKey: { type: String, default: null },
    customPrompt: { type: String, default: '' },
  },
  emits: ['save', 'back', 'save-prompt'],
  data() {
    return {
      list: [],
      editing: null,
      encrypting: false,
      encryptError: null,
      // Test connection state
      testStatus: null,   // null | 'testing' | 'ok' | 'error'
      testError: null,
      // Model discovery state
      discoverStatus: null,  // null | 'discovering' | 'ok' | 'error'
      discoverError: null,
      // Custom prompt
      promptDraft: '',
      promptSaving: false,
    };
  },
  created() {
    this.list = JSON.parse(JSON.stringify(this.providers));
    this.promptDraft = this.customPrompt || '';
  },
  watch: {
    providers(v) {
      if (!this.editing) this.list = JSON.parse(JSON.stringify(v));
    },
    customPrompt(v) {
      this.promptDraft = v || '';
    },
  },
  computed: {
    isNew() {
      return this.editing && !this.list.find(p => p.id === this.editing.id);
    },
    existingProvider() {
      if (!this.editing) return null;
      return this.list.find(p => p.id === this.editing.id) || null;
    },
    editValid() {
      if (!this.editing?.name?.trim() || !this.editing?.type || !this.editing?.models?.trim()) return false;
      const hasKey = !!this.editing.apiKey?.trim();
      if (this.isNew) return hasKey;
      return hasKey || !!this.existingProvider?.apiKeyEncrypted;
    },
    canEncrypt() {
      const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
      return !!(this.encryptionKey && config?.AI_URL && typeof window.encryptProviderKeys === 'function');
    },
    canTestOrDiscover() {
      const config = typeof CONFIG !== 'undefined' ? CONFIG : window.CONFIG;
      if (!config?.AI_URL || !this.editing?.type) return false;
      const hasKey = !!this.editing?.apiKey?.trim() || !!this.existingProvider?.apiKeyEncrypted;
      return hasKey;
    },
    providerTypeLabel() {
      const map = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini' };
      return (type) => map[type] || type;
    },
    promptChanged() {
      return this.promptDraft !== (this.customPrompt || '');
    },
  },
  methods: {
    startAdd() {
      this.encryptError = null;
      this._resetActionState();
      this.editing = { id: String(Date.now()), name: '', type: 'openai', apiKey: '', url: '', models: '' };
    },
    startEdit(provider) {
      this.encryptError = null;
      this._resetActionState();
      this.editing = {
        ...provider,
        models: (provider.models || []).join('\n'),
        apiKey: provider.apiKeyEncrypted ? '' : (provider.apiKey || ''),
      };
    },
    cancelEdit() {
      this.editing = null;
      this.encryptError = null;
      this._resetActionState();
    },
    _resetActionState() {
      this.testStatus = null;
      this.testError = null;
      this.discoverStatus = null;
      this.discoverError = null;
    },
    _buildProviderForAction() {
      const apiKey = this.editing.apiKey.trim();
      const encrypted = !apiKey && !!this.existingProvider?.apiKeyEncrypted;
      return {
        type: this.editing.type,
        apiKey: encrypted ? this.existingProvider.apiKey : apiKey,
        apiKeyEncrypted: encrypted,
        url: this.editing.url.trim(),
      };
    },
    async testConnection() {
      if (!this.canTestOrDiscover || this.testStatus === 'testing') return;
      this.testStatus = 'testing';
      this.testError = null;
      const firstModel = this.editing.models.split('\n').map(m => m.trim()).filter(Boolean)[0] || '';
      try {
        const result = await window.testAiProvider(
          { ...this._buildProviderForAction(), model: firstModel },
          this.encryptionKey
        );
        if (result.ok) {
          this.testStatus = 'ok';
        } else {
          this.testStatus = 'error';
          this.testError = result.error || 'Test failed';
        }
      } catch (e) {
        this.testStatus = 'error';
        this.testError = e.message;
      }
    },
    async discoverModels() {
      if (!this.canTestOrDiscover || this.discoverStatus === 'discovering') return;
      this.discoverStatus = 'discovering';
      this.discoverError = null;
      try {
        const result = await window.discoverProviderModels(
          this._buildProviderForAction(),
          this.encryptionKey
        );
        if (result.models?.length) {
          this.editing.models = result.models.join('\n');
          this.discoverStatus = 'ok';
        } else if (result.error) {
          this.discoverStatus = 'error';
          this.discoverError = result.error;
        } else {
          this.discoverStatus = 'error';
          this.discoverError = 'No models returned';
        }
      } catch (e) {
        this.discoverStatus = 'error';
        this.discoverError = e.message;
      }
    },
    async commitEdit() {
      if (!this.editValid || this.encrypting) return;
      this.encrypting = true;
      this.encryptError = null;

      let apiKey = this.editing.apiKey.trim();
      let apiKeyEncrypted = false;

      if (!apiKey && this.existingProvider?.apiKeyEncrypted) {
        apiKey = this.existingProvider.apiKey;
        apiKeyEncrypted = true;
      } else if (apiKey && this.canEncrypt) {
        try {
          const result = await window.encryptProviderKeys(this.encryptionKey, [apiKey]);
          apiKey = result[0];
          apiKeyEncrypted = true;
        } catch (e) {
          this.encryptError = e.message;
          this.encrypting = false;
          return;
        }
      }

      const models = this.editing.models.split('\n').map(m => m.trim()).filter(Boolean);
      const provider = {
        id: this.editing.id,
        name: this.editing.name.trim(),
        type: this.editing.type,
        apiKey,
        apiKeyEncrypted,
        url: this.editing.url.trim(),
        models,
      };
      const idx = this.list.findIndex(p => p.id === provider.id);
      if (idx >= 0) this.list.splice(idx, 1, provider);
      else this.list.push(provider);
      this.editing = null;
      this.encrypting = false;
      this._resetActionState();
      this.$emit('save', JSON.parse(JSON.stringify(this.list)));
    },
    remove(id) {
      if (!confirm('Remove this provider?')) return;
      this.list = this.list.filter(p => p.id !== id);
      this.$emit('save', JSON.parse(JSON.stringify(this.list)));
    },
    savePrompt() {
      this.$emit('save-prompt', this.promptDraft);
    },
  },
  template: `
    <div class="ai-settings-panel">
      <!-- Header -->
      <div class="ai-settings-header">
        <button class="nav-btn" @click="$emit('back')" title="Back to chat">
          <span class="ms" style="font-size:1rem">arrow_back</span>
        </button>
        <span class="ai-settings-title">AI Settings</span>
        <span v-if="saving" class="ml-auto text-xs" style="color:hsl(var(--muted-foreground))">Saving…</span>
        <button v-if="!editing && !saving" class="nav-btn ml-auto" @click="startAdd" title="Add provider">
          <span class="ms" style="font-size:1rem">add</span>
        </button>
      </div>

      <!-- Edit / Add Provider Form -->
      <div v-if="editing" class="ai-settings-form">
        <div class="ai-settings-form-title">{{ isNew ? 'Add Provider' : 'Edit Provider' }}</div>

        <label class="ai-settings-label">Name</label>
        <input v-model="editing.name" class="ai-settings-input" placeholder="e.g. My Anthropic" />

        <label class="ai-settings-label">Type</label>
        <select v-model="editing.type" class="ai-settings-input">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Gemini</option>
        </select>

        <label class="ai-settings-label">
          API Key
          <span v-if="existingProvider?.apiKeyEncrypted" style="opacity:0.6;font-weight:400"> (currently encrypted)</span>
          <span v-else-if="canEncrypt" style="opacity:0.6;font-weight:400"> (will be encrypted)</span>
        </label>
        <input
          v-model="editing.apiKey"
          class="ai-settings-input"
          type="password"
          :placeholder="existingProvider?.apiKeyEncrypted ? 'Leave empty to keep existing key' : 'sk-…'"
          autocomplete="off"
        />

        <label class="ai-settings-label">Base URL <span style="opacity:0.5">(optional)</span></label>
        <input v-model="editing.url" class="ai-settings-input" placeholder="https://api.example.com" />

        <label class="ai-settings-label">
          Models <span style="opacity:0.5">(one per line)</span>
        </label>
        <!-- Discover models row -->
        <div class="ai-settings-action-row" style="margin-bottom:0.4rem">
          <button
            class="ai-settings-action-btn"
            :disabled="!canTestOrDiscover || discoverStatus === 'discovering'"
            @click="discoverModels"
            title="Fetch available models from this provider"
          >
            <span class="ms" style="font-size:0.875rem;vertical-align:middle">auto_awesome</span>
            <span v-if="discoverStatus === 'discovering'">Discovering…</span>
            <span v-else>Discover models</span>
          </button>
          <span v-if="discoverStatus === 'ok'" class="ai-action-status ai-action-status--ok">
            <span class="ms" style="font-size:0.8rem">check_circle</span> Updated
          </span>
          <span v-if="discoverStatus === 'error'" class="ai-action-status ai-action-status--error" :title="discoverError">
            <span class="ms" style="font-size:0.8rem">error</span> {{ discoverError }}
          </span>
        </div>
        <textarea v-model="editing.models" class="ai-settings-input ai-settings-textarea" rows="4" placeholder="gpt-4o&#10;gpt-4o-mini"></textarea>

        <div v-if="encryptError" class="ai-settings-encrypt-error">
          <span class="ms" style="font-size:0.875rem;vertical-align:middle">error</span>
          {{ encryptError }}
        </div>

        <!-- Test connection row -->
        <div class="ai-settings-action-row" style="margin-top:0.75rem">
          <button
            class="ai-settings-action-btn"
            :disabled="!canTestOrDiscover || testStatus === 'testing'"
            @click="testConnection"
            title="Send a minimal request to verify the provider works"
          >
            <span class="ms" style="font-size:0.875rem;vertical-align:middle">wifi_tethering</span>
            <span v-if="testStatus === 'testing'">Testing…</span>
            <span v-else>Test connection</span>
          </button>
          <span v-if="testStatus === 'ok'" class="ai-action-status ai-action-status--ok">
            <span class="ms" style="font-size:0.8rem">check_circle</span> Connected
          </span>
          <span v-if="testStatus === 'error'" class="ai-action-status ai-action-status--error" :title="testError">
            <span class="ms" style="font-size:0.8rem">error</span> {{ testError }}
          </span>
        </div>

        <div class="ai-settings-form-actions">
          <button class="ai-settings-btn-secondary" :disabled="encrypting" @click="cancelEdit">Cancel</button>
          <button class="ai-settings-btn-primary" :disabled="!editValid || encrypting" @click="commitEdit">
            <span v-if="encrypting">Encrypting…</span>
            <span v-else>Save</span>
          </button>
        </div>
      </div>

      <!-- List view: wiki prompt + provider list -->
      <div v-else class="ai-settings-list">

        <!-- Wiki custom prompt -->
        <div class="ai-settings-section">
          <div class="ai-settings-section-title">
            <span class="ms" style="font-size:0.875rem;vertical-align:middle;margin-right:0.3rem">tune</span>
            Wiki Prompt
          </div>
          <p class="ai-settings-section-desc">
            Extra instructions appended to the system prompt for this wiki. Takes effect when the chat is reopened.
          </p>
          <textarea
            v-model="promptDraft"
            class="ai-settings-input ai-settings-textarea"
            rows="4"
            placeholder="e.g. Always reply in Italian. Use a formal tone."
          ></textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:0.4rem">
            <button
              class="ai-settings-btn-primary"
              :disabled="!promptChanged || saving"
              @click="savePrompt"
              style="font-size:0.8rem;padding:0.3rem 0.8rem"
            >Save prompt</button>
          </div>
        </div>

        <!-- Providers -->
        <div class="ai-settings-section-title" style="margin-top:0.75rem">
          <span class="ms" style="font-size:0.875rem;vertical-align:middle;margin-right:0.3rem">cloud</span>
          AI Providers
        </div>
        <div v-if="list.length === 0" class="ai-settings-empty">
          No providers configured.<br>
          <span style="opacity:0.7">Add one to use your own AI keys.</span>
        </div>
        <div v-for="p in list" :key="p.id" class="ai-settings-item">
          <div class="ai-settings-item-info">
            <div class="ai-settings-item-name">{{ p.name }}</div>
            <div class="ai-settings-item-meta">
              {{ providerTypeLabel(p.type) }} · {{ (p.models || []).length }} model{{ (p.models || []).length !== 1 ? 's' : '' }}
              <span v-if="p.apiKeyEncrypted" style="margin-left:4px;opacity:0.7">· 🔒 encrypted</span>
            </div>
          </div>
          <div class="ai-settings-item-actions">
            <button class="nav-btn" @click="startEdit(p)" title="Edit">
              <span class="ms" style="font-size:0.875rem">edit</span>
            </button>
            <button class="nav-btn" @click="remove(p.id)" title="Delete" style="color:hsl(var(--destructive))">
              <span class="ms" style="font-size:0.875rem">delete</span>
            </button>
          </div>
        </div>
        <div v-if="!canEncrypt && list.length > 0" class="ai-settings-encrypt-note">
          <span class="ms" style="font-size:0.875rem;vertical-align:middle;opacity:0.5">info</span>
          API keys are stored as plain text. Configure a worker with ENCRYPTION_SECRET to enable encryption.
        </div>
      </div>
    </div>
  `,
};
