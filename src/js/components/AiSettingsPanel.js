const AiSettingsPanel = {
  name: 'AiSettingsPanel',
  props: {
    providers: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
  },
  emits: ['save', 'back'],
  data() {
    return {
      list: [],
      editing: null,
    };
  },
  created() {
    this.list = JSON.parse(JSON.stringify(this.providers));
  },
  watch: {
    providers(v) {
      if (!this.editing) this.list = JSON.parse(JSON.stringify(v));
    },
  },
  computed: {
    isNew() {
      return this.editing && !this.list.find(p => p.id === this.editing.id);
    },
    editValid() {
      return !!(this.editing?.name?.trim() && this.editing?.type && this.editing?.apiKey?.trim() && this.editing?.models?.trim());
    },
    providerTypeLabel() {
      const map = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini' };
      return (type) => map[type] || type;
    },
  },
  methods: {
    startAdd() {
      this.editing = { id: String(Date.now()), name: '', type: 'openai', apiKey: '', url: '', models: '' };
    },
    startEdit(provider) {
      this.editing = { ...provider, models: (provider.models || []).join('\n') };
    },
    cancelEdit() {
      this.editing = null;
    },
    commitEdit() {
      if (!this.editValid) return;
      const models = this.editing.models.split('\n').map(m => m.trim()).filter(Boolean);
      const provider = {
        id: this.editing.id,
        name: this.editing.name.trim(),
        type: this.editing.type,
        apiKey: this.editing.apiKey.trim(),
        url: this.editing.url.trim(),
        models,
      };
      const idx = this.list.findIndex(p => p.id === provider.id);
      if (idx >= 0) this.list.splice(idx, 1, provider);
      else this.list.push(provider);
      this.editing = null;
      this.$emit('save', JSON.parse(JSON.stringify(this.list)));
    },
    remove(id) {
      if (!confirm('Remove this provider?')) return;
      this.list = this.list.filter(p => p.id !== id);
      this.$emit('save', JSON.parse(JSON.stringify(this.list)));
    },
  },
  template: `
    <div class="ai-settings-panel">
      <!-- Header -->
      <div class="ai-settings-header">
        <button class="nav-btn" @click="$emit('back')" title="Back to chat">
          <span class="ms" style="font-size:1rem">arrow_back</span>
        </button>
        <span class="ai-settings-title">AI Providers</span>
        <span v-if="saving" class="ml-auto text-xs" style="color:hsl(var(--muted-foreground))">Saving…</span>
        <button v-if="!editing && !saving" class="nav-btn ml-auto" @click="startAdd" title="Add provider">
          <span class="ms" style="font-size:1rem">add</span>
        </button>
      </div>

      <!-- Edit / Add Form -->
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

        <label class="ai-settings-label">API Key</label>
        <input v-model="editing.apiKey" class="ai-settings-input" type="password" placeholder="sk-…" autocomplete="off" />

        <label class="ai-settings-label">Base URL <span style="opacity:0.5">(optional)</span></label>
        <input v-model="editing.url" class="ai-settings-input" placeholder="https://api.example.com" />

        <label class="ai-settings-label">Models <span style="opacity:0.5">(one per line)</span></label>
        <textarea v-model="editing.models" class="ai-settings-input ai-settings-textarea" rows="4" placeholder="gpt-4o&#10;gpt-4o-mini"></textarea>

        <div class="ai-settings-form-actions">
          <button class="ai-settings-btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="ai-settings-btn-primary" :disabled="!editValid" @click="commitEdit">Save</button>
        </div>
      </div>

      <!-- Provider List -->
      <div v-else class="ai-settings-list">
        <div v-if="list.length === 0" class="ai-settings-empty">
          No providers configured.<br>
          <span style="opacity:0.7">Add one to use your own AI keys.</span>
        </div>
        <div v-for="p in list" :key="p.id" class="ai-settings-item">
          <div class="ai-settings-item-info">
            <div class="ai-settings-item-name">{{ p.name }}</div>
            <div class="ai-settings-item-meta">{{ providerTypeLabel(p.type) }} · {{ (p.models || []).length }} model{{ (p.models || []).length !== 1 ? 's' : '' }}</div>
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
      </div>
    </div>
  `,
};
