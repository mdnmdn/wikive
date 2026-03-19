const DrawingManager = {
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted) / 0.2)">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold">Drawings</h2>
            <span class="text-[10px] uppercase tracking-wide opacity-60">Excalidraw JSON in _drawings</span>
          </div>
          <p class="text-xs opacity-70">Create and manage .excalidraw JSON files stored in Google Drive.</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="createNewDrawing" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            New diagram
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- LIST MODE: cards in main pane, sidebar handled by global Sidebar -->
        <div class="flex-1 flex flex-col" v-show="!selectedDrawing && !isCreating">
            <div class="px-4 py-3 flex items-center justify-between gap-3 border-b" style="border-color: hsl(var(--border))">
              <div class="flex items-center gap-2 flex-1">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search drawings..."
                  class="w-full px-3 py-1.5 text-xs rounded border bg-background"
                  style="border-color: hsl(var(--border))"
                />
              </div>
              <button @click="createNewDrawing" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                New diagram
              </button>
            </div>
            <div class="flex-1 overflow-auto p-4">
              <div v-if="loading" class="flex justify-center py-8">
                <div class="spinner"></div>
              </div>
              <div v-else-if="filteredDrawings.length === 0" class="text-center py-16 text-sm opacity-70">
                No drawings yet. Click <span class="font-semibold">New diagram</span> to create your first Excalidraw.
              </div>
              <div v-else class="asset-grid">
                <div
                  v-for="d in filteredDrawings"
                  :key="d.id"
                  class="asset-card cursor-pointer"
                  @click="openDrawingFromList(d)"
                >
                  <div class="asset-preview flex items-center justify-center">
                    <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4h16v12H4zM8 20h8"/>
                    </svg>
                  </div>
                  <div class="asset-info">
                    <div class="asset-name" :title="d.name">{{ d.name }}</div>
                    <div class="flex items-center justify-between text-[10px] uppercase tracking-wide opacity-60 mt-1">
                      <span>{{ formatRelativeDate(d.modifiedTime) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>

        <!-- EDIT MODE: editor in main pane, list in global sidebar -->
        <div class="flex-1 flex flex-col" v-show="!!selectedDrawing || isCreating">
          <!-- Excalidraw editor -->
          <div class="flex-1 flex flex-col">
            <div class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border))">
              <div class="flex items-center gap-2">
                <input
                  v-model="editName"
                  class="bg-transparent font-medium text-sm focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1 rounded"
                  placeholder="Diagram name..."
                />
                <span class="text-[10px] uppercase tracking-wide opacity-60">.excalidraw</span>
              </div>
              <div class="flex items-center gap-2">
                <button @click="downloadDrawing" class="px-2 py-1 text-xs rounded-md border hover:bg-muted">
                  Download
                </button>
                <button @click="saveDrawing" :disabled="saving" class="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                  <span v-if="saving" class="spinner" style="width:0.75rem;height:0.75rem;border-width:1px;border-top-color:white"></span>
                  <span>{{ selectedDrawing ? 'Save' : 'Create' }}</span>
                </button>
                <button v-if="selectedDrawing" @click="deleteDrawing" class="px-2 py-1 text-xs rounded-md border border-red-500 text-red-500 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
            <div class="flex-1 relative" v-show="excalidrawReady" style="width: 100%; height: 100%; min-height: 0;">
              <excalidraw-component ref="excalidraw" class="w-full h-full"></excalidraw-component>
            </div>
            <div v-if="!excalidrawReady" class="flex-1 flex items-center justify-center text-sm opacity-70">
              Loading Excalidraw…
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  props: ['drawingsFolderId', 'drawingId'],
  emits: ['toast'],
  data() {
    return {
      drawings: [],
      loading: false,
      selectedDrawing: null,
      selectedId: null,
      isCreating: false,
      editName: '',
      jsonContent: '',
      saving: false,
      searchQuery: '',
      excalidrawReady: false,
    };
  },
  computed: {
    filteredDrawings() {
      const q = this.searchQuery.toLowerCase().trim();
      if (!q) return this.drawings;
      return this.drawings.filter(d => d.name.toLowerCase().includes(q));
    },
  },
  watch: {
    drawingsFolderId: {
      handler(id) {
        if (id) this.loadDrawings();
      },
      immediate: true,
    },
    drawingId: {
      handler(id) {
        if (!id) return;
        const existing = this.drawings.find(d => d.id === id);
        if (existing) {
          this.selectDrawing(existing);
        } else {
          this.loadAndSelectDrawing(id);
        }
      },
      immediate: true,
    },
    // When we enter edit/create mode, ensure we set excalidrawReady
    isCreating(val) { if (val) this.excalidrawReady = true; },
    selectedDrawing(val) { if (val) this.excalidrawReady = true; },
  },
  methods: {
    async loadDrawings() {
      if (!this.drawingsFolderId) return;
      this.loading = true;
      try {
        const q = `'${this.drawingsFolderId}' in parents and trashed=false`;
        const fields = 'files(id,name,mimeType,modifiedTime)';
        const res = await DriveService._fetch(
          `${CONFIG.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=modifiedTime desc`
        );
        const data = await res.json();
        this.drawings = (data.files || []).map(f => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
        }));
      } catch (e) {
        this.$emit('toast', 'Failed to load drawings: ' + e.message, 'error');
      }
      this.loading = false;
    },

    async loadAndSelectDrawing(id) {
      try {
        const meta = await DriveService.getFileMetadata(id);
        const entry = {
          id: meta.id,
          name: meta.name,
          modifiedTime: meta.modifiedTime,
        };
        this.drawings = [entry, ...this.drawings.filter(d => d.id !== id)];
        this.selectDrawing(entry);
      } catch (e) {
        this.$emit('toast', 'Failed to open drawing: ' + e.message, 'error');
      }
    },

    async selectDrawing(d) {
      this.selectedDrawing = d;
      this.selectedId = d.id;
      this.isCreating = false;
      this.editName = d.name.replace(/\.excalidraw$/, '');
      this.excalidrawReady = true;
      try {
        this.jsonContent = await DriveService.getFileContent(d.id);
        this.$nextTick(() => {
          if (this.$refs.excalidraw) {
            this.$refs.excalidraw.load(this.jsonContent);
          }
        });
      } catch (e) {
        this.jsonContent = '';
        this.$emit('toast', 'Failed to load drawing content: ' + e.message, 'error');
      }
    },

    createNewDrawing() {
      this.selectedDrawing = null;
      this.selectedId = null;
      this.isCreating = true;
      this.editName = '';
      this.excalidrawReady = true;
      this.jsonContent = JSON.stringify({
        type: 'excalidraw',
        version: 2,
        source: 'google-wiki',
        elements: [],
        appState: { theme: 'dark' },
        files: {},
      });
      this.$nextTick(() => {
        if (this.$refs.excalidraw) {
          this.$refs.excalidraw.load(this.jsonContent);
        }
      });
    },

    async saveDrawing() {
      if (!this.drawingsFolderId) {
        this.$emit('toast', 'Drawings folder missing', 'error');
        return;
      }
      
      if (this.$refs.excalidraw) {
        this.jsonContent = this.$refs.excalidraw.save();
      }

      const name = (this.editName || 'Untitled').trim() + '.excalidraw';
      this.saving = true;
      try {
        if (this.selectedDrawing) {
          await DriveService.updateFile(this.selectedDrawing.id, this.jsonContent);
          this.selectedDrawing.name = name;
          this.editName = name.replace(/\.excalidraw$/, '');
          this.$emit('toast', 'Drawing saved', 'success');
          await this.loadDrawings();
        } else {
          const metadata = {
            name,
            parents: [this.drawingsFolderId],
            mimeType: 'application/json',
          };
          const boundary = 'wiki_boundary_' + Date.now();
          const body = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(metadata),
            `--${boundary}`,
            'Content-Type: application/json',
            '',
            this.jsonContent,
            `--${boundary}--`,
          ].join('\r\n');
          const res = await DriveService._fetch(`${CONFIG.DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
            method: 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
          });
          const data = await res.json();
          this.$emit('toast', 'Drawing created', 'success');
          await this.loadDrawings();
          const created = this.drawings.find(d => d.id === data.id) || { id: data.id, name, modifiedTime: data.modifiedTime };
          this.selectDrawing(created);
          window.location.hash = '#/_drawings/' + data.id;
        }
      } catch (e) {
        this.$emit('toast', 'Failed to save drawing: ' + e.message, 'error');
      }
      this.saving = false;
    },

    async deleteDrawing() {
      if (!this.selectedDrawing) return;
      if (!confirm('Delete this drawing?')) return;
      try {
        await DriveService.deleteFile(this.selectedDrawing.id, this.drawingsFolderId);
        this.$emit('toast', 'Drawing deleted', 'success');
        this.selectedDrawing = null;
        this.selectedId = null;
        this.isCreating = false;
        this.jsonContent = '';
        await this.loadDrawings();
        window.location.hash = '#/_drawings';
      } catch (e) {
        this.$emit('toast', 'Failed to delete drawing: ' + e.message, 'error');
      }
    },

    async downloadDrawing() {
      if (!this.selectedDrawing) return;
      try {
        const url = DriveService.getDownloadUrl(this.selectedDrawing.id);
        const headers = DriveService.getAuthHeaders();
        const res = await fetch(url, { headers });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.selectedDrawing.name;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        this.$emit('toast', 'Failed to download drawing: ' + e.message, 'error');
      }
    },

    formatRelativeDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const diff = Date.now() - date.getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return date.toLocaleDateString();
    },

    openDrawingFromList(d) {
      this.selectDrawing(d);
      window.location.hash = '#/_drawings/' + d.id;
    },
  },
};

