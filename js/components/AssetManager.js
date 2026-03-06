const AssetManager = {
  template: `
    <div class="asset-manager">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold" style="color: hsl(var(--foreground))">Assets</h1>
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            type="text"
            placeholder="Search assets..."
            class="px-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-primary"
            style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))"
          />
          <button @click="refreshAssets" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="Refresh assets">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <label class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors cursor-pointer" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload
            <input type="file" multiple class="hidden" @change="onFileInput" ref="fileInput" />
          </label>
          <button @click="createSubfolder" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color: hsl(var(--border)); background-color: hsl(var(--muted))" title="New subfolder">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </button>
        </div>
      </div>

      <!-- Breadcrumb for assets subfolders -->
      <nav class="flex items-center gap-1 text-sm text-slate-500 mb-4" v-if="folderStack.length > 0">
        <a href="#" @click.prevent="navigateToRoot" class="hover:text-slate-800">_assets</a>
        <template v-for="(f, i) in folderStack" :key="f.id">
          <span class="text-slate-300">/</span>
          <a href="#" @click.prevent="navigateToFolder(i)" class="hover:text-slate-800">{{ f.name }}</a>
        </template>
      </nav>

      <!-- Drop zone -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
        @paste="onPaste"
        tabindex="0"
      >
        <div v-if="uploading" class="flex flex-col items-center gap-2">
          <div class="spinner"></div>
          <span class="text-sm text-slate-500">Uploading {{ uploadCount }} file(s)...</span>
        </div>
        <div v-else class="flex flex-col items-center gap-2 pointer-events-none">
          <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          <span class="text-sm text-slate-500">Drop files here, paste from clipboard, or click Upload</span>
        </div>
      </div>

      <!-- File list -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="spinner"></div>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-8" style="color: hsl(var(--muted-foreground))">
        No assets yet. Upload files to get started.
      </div>
      <div v-else-if="filteredItems.length === 0" class="text-center py-8" style="color: hsl(var(--muted-foreground))">
        No assets match your search.
      </div>
      <div v-else class="asset-grid">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="asset-card"
          :class="{ 'asset-card-folder': item.isFolder }"
        >
          <!-- Folder -->
          <template v-if="item.isFolder">
            <div class="asset-preview cursor-pointer" @click="openFolder(item)">
              <svg class="w-12 h-12 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </div>
            <div class="asset-info">
              <div class="asset-name" :title="item.name">{{ item.name }}</div>
              <div class="asset-actions">
                <button @click="renameItem(item)" class="asset-btn" title="Rename">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button @click="deleteItem(item)" class="asset-btn asset-btn-danger" title="Delete">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </template>

          <!-- File -->
          <template v-else>
            <div class="asset-preview cursor-pointer" @click="previewItem(item)">
              <img v-if="isImage(item)" :src="thumbnailUrl(item)" class="asset-thumb" @error="$event.target.style.display='none'" />
              <div v-else class="flex flex-col items-center gap-1">
                <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                <span class="text-xs text-slate-400">{{ fileExt(item) }}</span>
              </div>
            </div>
            <div class="asset-info">
              <div class="asset-name" :title="item.name">{{ item.name }}</div>
              <div class="asset-actions">
                <button @click="copyWikiPath(item)" class="asset-btn" title="Copy wiki path">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                </button>
                <button @click="downloadItem(item)" class="asset-btn" title="Download">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
                <button @click="renameItem(item)" class="asset-btn" title="Rename">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button @click="deleteItem(item)" class="asset-btn asset-btn-danger" title="Delete">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
              <div class="asset-wiki-path" @click="copyWikiPath(item)" title="Click to copy">
                {{ wikiPath(item) }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Preview modal -->
      <div v-if="previewing" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="previewing = null">
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b" style="border-color: hsl(var(--border))">
            <span class="font-medium text-sm truncate">{{ previewing.name }}</span>
            <div class="flex items-center gap-2">
              <button v-if="isTextFile(previewing) && previewEditing" @click="savePreviewContent" class="px-3 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800">Save</button>
              <button v-if="isTextFile(previewing) && !previewEditing" @click="previewEditing = true" class="px-3 py-1 text-xs rounded-md border hover:bg-slate-50" style="border-color: hsl(var(--border))">Edit</button>
              <button @click="previewing = null" class="text-slate-400 hover:text-slate-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <!-- Image preview -->
            <div v-if="isImage(previewing)" class="flex justify-center">
              <img :src="previewSrc" class="max-w-full max-h-[70vh] object-contain rounded" />
            </div>
            <!-- Video preview -->
            <div v-else-if="isVideo(previewing)" class="flex justify-center">
              <video :src="previewSrc" controls class="max-w-full max-h-[70vh] rounded"></video>
            </div>
            <!-- Audio preview -->
            <div v-else-if="isAudio(previewing)" class="flex justify-center py-8">
              <audio :src="previewSrc" controls></audio>
            </div>
            <!-- PDF preview -->
            <div v-else-if="isPdf(previewing)" class="h-[70vh]">
              <iframe :src="previewSrc" class="w-full h-full border-0 rounded"></iframe>
            </div>
            <!-- Text/code/markdown file preview & edit -->
            <div v-else-if="isTextFile(previewing)">
              <div v-if="previewLoading" class="flex justify-center py-8"><div class="spinner"></div></div>
              <template v-else>
                <textarea
                  v-if="previewEditing"
                  v-model="previewText"
                  class="w-full h-[65vh] font-mono text-sm p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
                  style="border-color: hsl(var(--border))"
                  spellcheck="false"
                ></textarea>
                <div v-else-if="isMarkdownFile(previewing)" class="prose" v-html="renderedPreviewMd"></div>
                <pre v-else class="text-sm font-mono bg-slate-50 p-4 rounded-lg overflow-auto max-h-[65vh] whitespace-pre-wrap">{{ previewText }}</pre>
              </template>
            </div>
            <!-- Unknown type -->
            <div v-else class="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg class="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              <p>Preview not available for this file type.</p>
              <button @click="downloadItem(previewing)" class="mt-3 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800">Download</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Rename dialog -->
      <div v-if="renaming" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="renaming = null">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
          <h3 class="text-lg font-semibold mb-4">Rename</h3>
          <input
            v-model="renameValue"
            @keyup.enter="confirmRename"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            style="border-color: hsl(var(--border))"
            ref="renameInput"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button @click="renaming = null" class="px-4 py-2 text-sm rounded-lg border hover:bg-slate-50" style="border-color: hsl(var(--border))">Cancel</button>
            <button @click="confirmRename" class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">Rename</button>
          </div>
        </div>
      </div>

      <!-- Delete confirm dialog -->
      <div v-if="deleting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="deleting = null">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
          <h3 class="text-lg font-semibold mb-2">Delete "{{ deleting.name }}"?</h3>
          <p class="text-sm text-slate-500 mb-4">This will move the file to trash in Google Drive.</p>
          <div class="flex justify-end gap-2">
            <button @click="deleting = null" class="px-4 py-2 text-sm rounded-lg border hover:bg-slate-50" style="border-color: hsl(var(--border))">Cancel</button>
            <button @click="confirmDelete" class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `,
  props: ['assetsFolderId'],
  emits: ['toast'],
  data() {
    return {
      items: [],
      loading: false,
      dragging: false,
      uploading: false,
      uploadCount: 0,
      currentFolderId: null,
      folderStack: [], // { id, name }
      previewing: null,
      previewSrc: '',
      previewText: '',
      previewLoading: false,
      previewEditing: false,
      renaming: null,
      renameValue: '',
      deleting: null,
      searchQuery: '',
      searchTimeout: null,
    };
  },
  computed: {
    renderedPreviewMd() {
      if (!this.previewText) return '';
      return marked.parse(this.previewText);
    },
    filteredItems() {
      if (!this.searchQuery.trim()) return this.items;
      const query = this.searchQuery.toLowerCase();
      return this.items.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    },
  },
  watch: {
    assetsFolderId: {
      handler(id) {
        if (id) {
          this.currentFolderId = id;
          this.folderStack = [];
          this.loadItems();
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
      try {
        const all = await DriveService.listFolder(this.currentFolderId);
        this.items = all;
      } catch (e) {
        this.$emit('toast', 'Failed to load assets: ' + e.message, 'error');
        this.items = [];
      }
      this.loading = false;
    },

    currentWikiPrefix() {
      let prefix = '_assets';
      for (const f of this.folderStack) {
        prefix += '/' + f.name;
      }
      return prefix;
    },

    wikiPath(item) {
      return '/' + this.currentWikiPrefix() + '/' + item.name;
    },

    async copyWikiPath(item) {
      const path = this.wikiPath(item);
      try {
        await navigator.clipboard.writeText(path);
        this.$emit('toast', 'Copied: ' + path, 'success');
      } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = path;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.$emit('toast', 'Copied: ' + path, 'success');
      }
    },

    // Upload handling
    onFileInput(e) {
      const files = e.target.files;
      if (files.length) this.uploadFiles(Array.from(files));
      e.target.value = '';
    },

    onDrop(e) {
      this.dragging = false;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) this.uploadFiles(files);
    },

    onPaste(e) {
      // Only handle paste when asset manager is visible
      if (!this.currentFolderId) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        this.uploadFiles(files);
      }
    },

    async uploadFiles(files) {
      this.uploading = true;
      this.uploadCount = files.length;
      let success = 0;

      for (const file of files) {
        try {
          let name = file.name;
          // For pasted files that have no real name
          if (!name || name === 'image.png') {
            const ext = file.type.split('/')[1] || 'bin';
            name = 'pasted-' + Date.now() + '.' + ext;
          }
          await DriveService.uploadBinary(name, this.currentFolderId, file, file.type || 'application/octet-stream');
          success++;
        } catch (e) {
          this.$emit('toast', 'Failed to upload ' + file.name + ': ' + e.message, 'error');
        }
      }

      this.uploading = false;
      if (success > 0) {
        this.$emit('toast', success + ' file(s) uploaded', 'success');
        CacheService.remove('listing:' + this.currentFolderId);
        await this.loadItems();
      }
    },

    // Subfolder navigation
    openFolder(item) {
      this.folderStack.push({ id: item.id, name: item.name });
      this.currentFolderId = item.id;
      this.loadItems();
    },

    navigateToRoot() {
      this.folderStack = [];
      this.currentFolderId = this.assetsFolderId;
      this.loadItems();
    },

    navigateToFolder(index) {
      this.folderStack = this.folderStack.slice(0, index + 1);
      this.currentFolderId = this.folderStack[index].id;
      this.loadItems();
    },

    async createSubfolder() {
      const name = prompt('Folder name:');
      if (!name) return;
      try {
        await DriveService._createFolder(name, this.currentFolderId);
        CacheService.remove('listing:' + this.currentFolderId);
        await this.loadItems();
        this.$emit('toast', 'Folder created', 'success');
      } catch (e) {
        this.$emit('toast', 'Failed to create folder: ' + e.message, 'error');
      }
    },

    // File type checks
    isImage(item) {
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(item.name);
    },
    isVideo(item) {
      return /\.(mp4|webm|ogg|mov|avi)$/i.test(item.name);
    },
    isAudio(item) {
      return /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(item.name);
    },
    isPdf(item) {
      return /\.pdf$/i.test(item.name);
    },
    isTextFile(item) {
      return /\.(txt|md|markdown|json|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|cs|swift|kt|sql|graphql|env|log|csv|tsv)$/i.test(item.name);
    },
    isMarkdownFile(item) {
      return /\.(md|markdown)$/i.test(item.name);
    },
    fileExt(item) {
      const m = item.name.match(/\.([^.]+)$/);
      return m ? m[1].toUpperCase() : '';
    },

    thumbnailUrl(item) {
      const url = DriveService.getDownloadUrl(item.id);
      const headers = DriveService.getAuthHeaders();
      // Use a proxy approach: create object URL via fetch
      // For thumbnails, we'll lazy-load
      if (!item._thumbUrl) {
        item._thumbUrl = '';
        fetch(url, { headers }).then(r => r.blob()).then(blob => {
          item._thumbUrl = URL.createObjectURL(blob);
          // Force reactivity
          const idx = this.items.indexOf(item);
          if (idx >= 0) this.items.splice(idx, 1, { ...item });
        }).catch(() => {});
      }
      return item._thumbUrl;
    },

    // Preview
    async previewItem(item) {
      this.previewing = item;
      this.previewEditing = false;
      this.previewText = '';

      if (this.isTextFile(item)) {
        this.previewLoading = true;
        try {
          this.previewText = await DriveService.getFileContent(item.id);
        } catch (e) {
          this.previewText = 'Error loading file: ' + e.message;
        }
        this.previewLoading = false;
        this.previewSrc = '';
      } else {
        // For media files, fetch blob and create object URL
        this.previewSrc = '';
        try {
          const url = DriveService.getDownloadUrl(item.id);
          const headers = DriveService.getAuthHeaders();
          const res = await fetch(url, { headers });
          const blob = await res.blob();
          this.previewSrc = URL.createObjectURL(blob);
        } catch (e) {
          this.$emit('toast', 'Failed to load preview: ' + e.message, 'error');
        }
      }
    },

    async savePreviewContent() {
      if (!this.previewing) return;
      try {
        await DriveService.updateFile(this.previewing.id, this.previewText);
        this.previewEditing = false;
        this.$emit('toast', 'File saved', 'success');
      } catch (e) {
        this.$emit('toast', 'Failed to save: ' + e.message, 'error');
      }
    },

    // Download
    async downloadItem(item) {
      try {
        const url = DriveService.getDownloadUrl(item.id);
        const headers = DriveService.getAuthHeaders();
        const res = await fetch(url, { headers });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        this.$emit('toast', 'Download failed: ' + e.message, 'error');
      }
    },

    // Rename
    renameItem(item) {
      this.renaming = item;
      this.renameValue = item.name;
      this.$nextTick(() => {
        this.$refs.renameInput?.focus();
        // Select name without extension for files
        if (!item.isFolder) {
          const dot = this.renameValue.lastIndexOf('.');
          if (dot > 0) this.$refs.renameInput?.setSelectionRange(0, dot);
        }
      });
    },

    async confirmRename() {
      if (!this.renaming || !this.renameValue.trim()) return;
      const item = this.renaming;
      const newName = this.renameValue.trim();
      this.renaming = null;

      if (newName === item.name) return;

      try {
        await DriveService.renameFile(item.id, newName, this.currentFolderId);
        this.$emit('toast', 'Renamed to ' + newName, 'success');
        CacheService.remove('listing:' + this.currentFolderId);
        await this.loadItems();
      } catch (e) {
        this.$emit('toast', 'Rename failed: ' + e.message, 'error');
      }
    },

    // Delete
    deleteItem(item) {
      this.deleting = item;
    },

    async confirmDelete() {
      if (!this.deleting) return;
      const item = this.deleting;
      this.deleting = null;

      try {
        await DriveService.deleteFile(item.id, this.currentFolderId);
        this.$emit('toast', item.name + ' deleted', 'success');
        CacheService.remove('listing:' + this.currentFolderId);
        await this.loadItems();
      } catch (e) {
        this.$emit('toast', 'Delete failed: ' + e.message, 'error');
      }
    },

    // Search with debounce
    onSearchInput() {
      // Debounce is handled by Vue reactivity - filtering is instant
      // This method exists for future enhancements like backend search
    },

    // Refresh assets
    async refreshAssets() {
      CacheService.remove('listing:' + this.currentFolderId);
      await this.loadItems();
      this.$emit('toast', 'Assets refreshed', 'success');
    },
  },
};
