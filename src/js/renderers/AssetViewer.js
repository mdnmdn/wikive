const AssetViewer = {
  template: `
    <div class="asset-manager px-10 py-8">
      <nav v-if="folderStack.length > 0" class="flex items-center gap-1 text-sm mb-4" style="color: hsl(var(--muted-foreground))">
        <a href="#" @click.prevent="navigateToRoot" class="hover:opacity-80">_assets</a>
        <template v-for="(f, i) in folderStack" :key="f.id">
          <span class="opacity-40">/</span>
          <a href="#" @click.prevent="navigateToFolder(i)" class="hover:opacity-80">{{ f.name }}</a>
        </template>
      </nav>
      <!-- hidden file input for upload triggered from header -->
      <input type="file" multiple class="hidden" @change="onFileInput" ref="fileInput" />
      <div v-if="loading" class="flex justify-center py-8"><div class="spinner"></div></div>
      <div v-else-if="items.length === 0" class="text-center py-8" style="color: hsl(var(--muted-foreground))">No assets yet. Upload files to get started.</div>
      <div v-else-if="filteredItems.length === 0" class="text-center py-8" style="color: hsl(var(--muted-foreground))">No assets match your search.</div>
      <div v-else class="doc-grid">

        <!-- Folder card -->
        <div v-for="item in filteredItems" :key="item.id" class="doc-card">
          <template v-if="item.isFolder">
            <div class="doc-card-preview cursor-pointer" @click="openFolder(item)">
              <svg class="w-12 h-12" style="color: hsl(var(--border))" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </div>
            <div class="asset-info">
              <div class="asset-name" :title="item.name">{{ item.name }}</div>
              <div class="asset-actions">
                <button @click="renameItem(item)" class="asset-btn" title="Rename"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button @click="deleteItem(item)" class="asset-btn asset-btn-danger" title="Delete"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
            </div>
          </template>

          <!-- Image card — thumbnail on top -->
          <template v-else-if="isImage(item)">
            <div class="doc-card-preview cursor-pointer" @click="previewItem(item)">
              <img :src="thumbnailUrl(item)" class="asset-thumb" @error="$event.target.style.display='none'" />
            </div>
            <div class="asset-info">
              <div class="asset-name" :title="item.name">{{ item.name }}</div>
              <div class="asset-actions">
                <button @click="copyWikiPath(item)" class="asset-btn" title="Copy wiki path"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                <button @click="downloadItem(item)" class="asset-btn" title="Download"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                <button @click="renameItem(item)" class="asset-btn" title="Rename"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button @click="deleteItem(item)" class="asset-btn asset-btn-danger" title="Delete"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
              <div class="asset-wiki-path" @click="copyWikiPath(item)" title="Click to copy">{{ wikiPath(item) }}</div>
            </div>
          </template>

          <!-- Non-image file card — icon layout matching folder cards -->
          <template v-else>
            <div class="p-4 cursor-pointer" @click="previewItem(item)">
              <div class="flex items-center gap-3 mb-2">
                <svg class="w-5 h-5 flex-shrink-0" style="color: hsl(var(--primary))" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                <span class="font-medium text-sm truncate" :title="item.name">{{ item.name }}</span>
              </div>
              <div class="text-xs font-mono" style="color: hsl(var(--muted-foreground))">{{ fileExt(item) }}</div>
            </div>
            <div class="asset-info" style="border-top: 1px solid hsl(var(--border))">
              <div class="asset-actions">
                <button @click="copyWikiPath(item)" class="asset-btn" title="Copy wiki path"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                <button @click="downloadItem(item)" class="asset-btn" title="Download"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                <button @click="renameItem(item)" class="asset-btn" title="Rename"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button @click="deleteItem(item)" class="asset-btn asset-btn-danger" title="Delete"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
              <div class="asset-wiki-path" @click="copyWikiPath(item)" title="Click to copy">{{ wikiPath(item) }}</div>
            </div>
          </template>
        </div>

      </div>
      <!-- Preview modal -->
      <div v-if="previewing" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="previewing = null">
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <div class="flex items-center justify-between px-4 py-3 border-b" style="border-color: hsl(var(--border))">
            <span class="font-medium text-sm truncate">{{ previewing.name }}</span>
            <div class="flex items-center gap-2">
              <button v-if="isTextFile(previewing) && previewEditing" @click="savePreviewContent" class="px-3 py-1 text-xs rounded-md" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">Save</button>
              <button v-if="isTextFile(previewing) && !previewEditing" @click="previewEditing = true" class="px-3 py-1 text-xs rounded-md border hover:opacity-80" style="border-color: hsl(var(--border))">Edit</button>
              <button @click="previewing = null" style="color: hsl(var(--muted-foreground))">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <div v-if="isImage(previewing)" class="flex justify-center"><img :src="previewSrc" class="max-w-full max-h-[70vh] object-contain rounded" /></div>
            <div v-else-if="isVideo(previewing)" class="flex justify-center"><video :src="previewSrc" controls class="max-w-full max-h-[70vh] rounded"></video></div>
            <div v-else-if="isAudio(previewing)" class="flex justify-center py-8"><audio :src="previewSrc" controls></audio></div>
            <div v-else-if="isPdf(previewing)" class="h-[70vh]"><iframe :src="previewSrc" class="w-full h-full border-0 rounded"></iframe></div>
            <div v-else-if="isTextFile(previewing)">
              <div v-if="previewLoading" class="flex justify-center py-8"><div class="spinner"></div></div>
              <template v-else>
                <textarea v-if="previewEditing" v-model="previewText" class="w-full h-[65vh] font-mono text-sm p-3 border rounded-lg resize-none focus:outline-none focus:ring-2" style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))" spellcheck="false"></textarea>
                <div v-else-if="isMarkdownFile(previewing)" class="prose" v-html="renderedPreviewMd"></div>
                <pre v-else class="text-sm font-mono p-4 rounded-lg overflow-auto max-h-[65vh] whitespace-pre-wrap" style="background: hsl(var(--muted))">{{ previewText }}</pre>
              </template>
            </div>
            <div v-else class="flex flex-col items-center justify-center py-12" style="color: hsl(var(--muted-foreground))">
              <svg class="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              <p>Preview not available.</p>
              <button @click="downloadItem(previewing)" class="mt-3 px-4 py-2 text-sm rounded-lg" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">Download</button>
            </div>
          </div>
        </div>
      </div>
      <!-- Rename / New Folder dialog -->
      <div v-if="renaming" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="renaming = null">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-4">{{ renaming._newFolder ? 'New Folder' : 'Rename' }}</h3>
          <input v-model="renameValue" @keyup.enter="confirmRename" class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2" style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))" ref="renameInput" />
          <div class="flex justify-end gap-2 mt-4">
            <button @click="renaming = null" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border))">Cancel</button>
            <button @click="confirmRename" class="px-4 py-2 text-sm rounded-lg" style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground))">{{ renaming._newFolder ? 'Create' : 'Rename' }}</button>
          </div>
        </div>
      </div>
      <!-- Delete dialog -->
      <div v-if="deleting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="deleting = null">
        <div class="rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" style="background-color: hsl(var(--background)); color: hsl(var(--foreground))">
          <h3 class="text-lg font-semibold mb-2">Delete "{{ deleting.name }}"?</h3>
          <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">This will move the file to trash in Google Drive.</p>
          <div class="flex justify-end gap-2">
            <button @click="deleting = null" class="px-4 py-2 text-sm rounded-lg border hover:opacity-80" style="border-color: hsl(var(--border))">Cancel</button>
            <button @click="confirmDelete" class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `,
  inject: ['rendererState'],
  props: ['document', 'content', 'mode', 'darkMode'],
  emits: ['toast', 'save'],
  data() {
    return {
      items: [], loading: false, currentFolderId: null, folderStack: [],
      previewing: null, previewSrc: '', previewText: '', previewLoading: false, previewEditing: false,
      renaming: null, renameValue: '', deleting: null,
    };
  },
  computed: {
    renderedPreviewMd() { return this.previewText ? marked.parse(this.previewText) : ''; },
    filteredItems() {
      const q = this.rendererState?.assetSearch?.trim()?.toLowerCase();
      if (!q) return this.items;
      return this.items.filter(i => i.name.toLowerCase().includes(q));
    },
  },
  watch: {
    document: {
      async handler(doc) {
        if (!doc) return;
        // For asset viewer, the document is always the _assets folder (or a subfolder)
        // doc.type === 'folder' means it IS the folder; 'file' means a specific asset was linked
        let folderId = doc.id;
        if (doc.type !== 'folder') {
          folderId = doc.parentId;
        }
        if (folderId) {
          this.currentFolderId = folderId;
          this.folderStack = [];
          await this.loadItems();
        }
      },
      immediate: true,
    },
  },
  mounted() {
    document.addEventListener('paste', this._pasteHandler = (e) => this.onPaste(e));
  },
  beforeUnmount() {
    document.removeEventListener('paste', this._pasteHandler);
  },
  methods: {
    async loadItems() {
      if (!this.currentFolderId) return;
      this.loading = true;
      try { this.items = await StorageService.listFolder(this.currentFolderId); }
      catch (e) { this.$emit('toast', 'Failed to load assets: ' + e.message, 'error'); this.items = []; }
      this.loading = false;
    },
    currentWikiPrefix() {
      let prefix = '_assets';
      for (const f of this.folderStack) prefix += '/' + f.name;
      return prefix;
    },
    wikiPath(item) { return '/' + this.currentWikiPrefix() + '/' + item.name; },
    async copyWikiPath(item) {
      const path = this.wikiPath(item);
      try { await navigator.clipboard.writeText(path); this.$emit('toast', 'Copied: ' + path, 'success'); }
      catch { const ta = document.createElement('textarea'); ta.value = path; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); this.$emit('toast', 'Copied: ' + path, 'success'); }
    },
    triggerUpload() { this.$refs.fileInput?.click(); },
    onFileInput(e) { const files = e.target.files; if (files.length) this.uploadFiles(Array.from(files)); e.target.value = ''; },
    onPaste(e) {
      if (e.defaultPrevented || !this.currentFolderId) return;
      const items = e.clipboardData?.items; if (!items) return;
      const files = [];
      for (const item of items) { if (item.kind === 'file') { const f = item.getAsFile(); if (f) files.push(f); } }
      if (files.length) { e.preventDefault(); e.stopPropagation(); this.uploadFiles(files); }
    },
    async uploadFiles(files) {
      let success = 0;
      for (const file of files) {
        try {
          let name = file.name;
          if (!name || name === 'image.png') { const ext = file.type.split('/')[1] || 'bin'; name = 'pasted-' + Date.now() + '.' + ext; }
          await StorageService.uploadBinary(name, this.currentFolderId, file, file.type || 'application/octet-stream');
          success++;
        } catch (e) { this.$emit('toast', 'Failed to upload ' + file.name + ': ' + e.message, 'error'); }
      }
      if (success > 0) { this.$emit('toast', success + ' file(s) uploaded', 'success'); CacheService.remove('listing:' + this.currentFolderId); await this.loadItems(); }
    },
    openFolder(item) { this.folderStack.push({ id: item.id, name: item.name }); this.currentFolderId = item.id; this.loadItems(); },
    navigateToRoot() { this.folderStack = []; this.currentFolderId = this.document?.id || this.document?.parentId; this.loadItems(); },
    navigateToFolder(index) { this.folderStack = this.folderStack.slice(0, index + 1); this.currentFolderId = this.folderStack[index].id; this.loadItems(); },
    createSubfolder() {
      this.renaming = { _newFolder: true };
      this.renameValue = '';
      this.$nextTick(() => this.$refs.renameInput?.focus());
    },
    isImage(item) { return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(item.name); },
    isVideo(item) { return /\.(mp4|webm|ogg|mov|avi)$/i.test(item.name); },
    isAudio(item) { return /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(item.name); },
    isPdf(item) { return /\.pdf$/i.test(item.name); },
    isTextFile(item) { return /\.(txt|md|markdown|json|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|cs|swift|kt|sql|graphql|env|log|csv|tsv)$/i.test(item.name); },
    isMarkdownFile(item) { return /\.(md|markdown)$/i.test(item.name); },
    fileExt(item) { const m = item.name.match(/\.([^.]+)$/); return m ? m[1].toUpperCase() : ''; },
    thumbnailUrl(item) {
      const url = StorageService.getDownloadUrl(item.id);
      const headers = StorageService.getAuthHeaders();
      if (!item._thumbUrl) {
        item._thumbUrl = '';
        fetch(url, { headers }).then(r => r.blob()).then(blob => {
          item._thumbUrl = URL.createObjectURL(blob);
          const idx = this.items.indexOf(item);
          if (idx >= 0) this.items.splice(idx, 1, { ...item });
        }).catch(() => {});
      }
      return item._thumbUrl;
    },
    async previewItem(item) {
      this.previewing = item; this.previewEditing = false; this.previewText = '';
      if (this.isTextFile(item)) {
        this.previewLoading = true;
        try { this.previewText = await StorageService.getFileContent(item.id); } catch (e) { this.previewText = 'Error: ' + e.message; }
        this.previewLoading = false; this.previewSrc = '';
      } else {
        this.previewSrc = '';
        try { const url = StorageService.getDownloadUrl(item.id); const headers = StorageService.getAuthHeaders(); const res = await fetch(url, { headers }); const blob = await res.blob(); this.previewSrc = URL.createObjectURL(blob); }
        catch (e) { this.$emit('toast', 'Preview failed: ' + e.message, 'error'); }
      }
    },
    async savePreviewContent() {
      if (!this.previewing) return;
      try { await StorageService.updateFile(this.previewing.id, this.previewText); this.previewEditing = false; this.$emit('toast', 'File saved', 'success'); }
      catch (e) { this.$emit('toast', 'Save failed: ' + e.message, 'error'); }
    },
    async downloadItem(item) {
      try { const url = StorageService.getDownloadUrl(item.id); const headers = StorageService.getAuthHeaders(); const res = await fetch(url, { headers }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = item.name; a.click(); URL.revokeObjectURL(a.href); }
      catch (e) { this.$emit('toast', 'Download failed: ' + e.message, 'error'); }
    },
    renameItem(item) {
      this.renaming = item; this.renameValue = item.name;
      this.$nextTick(() => { this.$refs.renameInput?.focus(); if (!item.isFolder) { const dot = this.renameValue.lastIndexOf('.'); if (dot > 0) this.$refs.renameInput?.setSelectionRange(0, dot); } });
    },
    async confirmRename() {
      if (!this.renaming || !this.renameValue.trim()) return;
      const item = this.renaming; const newName = this.renameValue.trim(); this.renaming = null;
      if (item._newFolder) {
        try { await StorageService.createFolder(newName, this.currentFolderId); CacheService.remove('listing:' + this.currentFolderId); await this.loadItems(); this.$emit('toast', 'Folder created', 'success'); }
        catch (e) { this.$emit('toast', 'Failed: ' + e.message, 'error'); }
        return;
      }
      if (newName === item.name) return;
      try { await StorageService.renameFile(item.id, newName, this.currentFolderId); this.$emit('toast', 'Renamed to ' + newName, 'success'); CacheService.remove('listing:' + this.currentFolderId); await this.loadItems(); }
      catch (e) { this.$emit('toast', 'Rename failed: ' + e.message, 'error'); }
    },
    deleteItem(item) { this.deleting = item; },
    async confirmDelete() {
      if (!this.deleting) return;
      const item = this.deleting; this.deleting = null;
      try { await StorageService.deleteFile(item.id, this.currentFolderId); this.$emit('toast', item.name + ' deleted', 'success'); CacheService.remove('listing:' + this.currentFolderId); await this.loadItems(); }
      catch (e) { this.$emit('toast', 'Delete failed: ' + e.message, 'error'); }
    },
    async refreshAssets() { CacheService.remove('listing:' + this.currentFolderId); await this.loadItems(); this.$emit('toast', 'Assets refreshed', 'success'); },
  },
};
