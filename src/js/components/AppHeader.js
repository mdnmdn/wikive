const AppHeader = {
  template: `
    <header class="flex items-center justify-between px-4 py-2 border-b" style="border-color: hsl(var(--border)); background-color: hsl(var(--background)); color: hsl(var(--foreground))">
      <div class="flex items-center gap-3">
        <a href="#/" class="flex items-center gap-2 hover:opacity-80" style="color: hsl(var(--foreground))">
          <img src="/assets/logo-base.png" alt="Wiki Logo" class="h-8 w-auto rounded" />
        </a>
        <breadcrumb :path="currentPath" :document="document"></breadcrumb>
        <div v-if="samePageUsers.length" class="flex items-center -space-x-1.5 ml-2">
          <img
            v-for="u in samePageUsers.slice(0, 5)"
            :key="u.email"
            :src="u.picture"
            :title="u.name + ' is viewing this page'"
            class="w-6 h-6 rounded-full ring-2 ring-background"
            referrerpolicy="no-referrer"
          />
          <span v-if="samePageUsers.length > 5" class="text-xs ml-2" style="color: hsl(var(--muted-foreground))">+{{ samePageUsers.length - 5 }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">

        <!-- ═══ DRAWING-SPECIFIC CONTROLS (always in edit mode) ═══ -->
        <template v-if="document?.docType === 'drawing'">
          <span v-if="rendererState.drawingAutosaveStatus" class="text-xs transition-opacity" :class="rendererState.drawingAutosaveStatus === 'saved' ? 'text-green-500 opacity-80' : 'opacity-60'">
            <span v-if="rendererState.drawingAutosaveStatus === 'saving'">Saving…</span>
            <span v-else>Saved</span>
          </span>
          <button
            @click="$emit('drawing-toggle-autosave')"
            class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition-colors"
            :style="rendererState.drawingAutosave ? 'border-color:hsl(var(--primary));color:hsl(var(--primary));background-color:hsl(var(--primary)/0.08)' : 'border-color:hsl(var(--border));background-color:hsl(var(--muted))'"
            title="Toggle autosave"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            Auto
          </button>
          <button @click="$emit('drawing-toggle-fullscreen')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" :title="rendererState.drawingFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
            <svg v-if="!rendererState.drawingFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5m11-5l-5 5m-11 11l5-5m11 5l-5-5"/></svg>
          </button>
        </template>

        <!-- ═══ SNIPPET TYPE + EXPIRY (edit mode only) ═══ -->
        <template v-if="mode === 'edit' && document?.docType === 'snippet'">
          <select v-model="rendererState.snippetType" class="text-xs bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" style="border-color:hsl(var(--border))">
            <optgroup label="Common">
              <option value="markdown">Markdown</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="sh">Bash/Shell</option>
            </optgroup>
            <optgroup label="Languages">
              <option value="c_cpp">C / C++</option>
              <option value="csharp">C#</option>
              <option value="golang">Go</option>
              <option value="java">Java</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
              <option value="rust">Rust</option>
              <option value="typescript">TypeScript</option>
              <option value="dart">Dart</option>
              <option value="kotlin">Kotlin</option>
              <option value="swift">Swift</option>
              <option value="clojure">Clojure</option>
              <option value="elixir">Elixir</option>
              <option value="haskell">Haskell</option>
              <option value="lua">Lua</option>
              <option value="perl">Perl</option>
              <option value="r">R</option>
              <option value="scala">Scala</option>
            </optgroup>
            <optgroup label="Markup & Config">
              <option value="xml">XML</option>
              <option value="powershell">PowerShell</option>
              <option value="sql">SQL</option>
              <option value="latex">LaTeX</option>
              <option value="dockerfile">Dockerfile</option>
              <option value="nginx">Nginx</option>
              <option value="toml">TOML</option>
              <option value="ini">INI</option>
              <option value="text">Plain Text</option>
            </optgroup>
          </select>
          <select v-model="rendererState.snippetExpiry" class="text-xs bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" style="border-color:hsl(var(--border))">
            <option :value="5">5 min</option>
            <option :value="20">20 min</option>
            <option :value="60">1 hour</option>
            <option :value="1440">1 day</option>
            <option :value="10080">1 week</option>
            <option :value="0">No expiry</option>
          </select>
        </template>

        <!-- ═══ ASSET CONTROLS ═══ -->
        <template v-if="document?.docType === 'asset'">
          <input v-model="rendererState.assetSearch" type="text" placeholder="Search assets…" class="px-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-primary" style="border-color:hsl(var(--border));background-color:hsl(var(--background));color:hsl(var(--foreground));width:180px" />
          <button @click="$emit('asset-refresh')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Refresh">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <button @click="$emit('asset-upload')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Upload files">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload
          </button>
          <button @click="$emit('asset-create-subfolder')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="New subfolder">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </button>
        </template>

        <!-- ═══ COMMON DOCUMENT ACTIONS ═══ -->
        <template v-if="document && document.docType !== 'asset'">

          <!-- Refresh: non-drawing view mode -->
          <button v-if="mode === 'view' && document.docType !== 'drawing'" @click="$emit('refresh-page')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Refresh">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>

          <!-- Share: saved files only -->
          <button v-if="canAnonymousShare" @click="$emit('share-anonymous')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Anonymous share">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C7.649 12.988 7 12.231 7 11.4c0-1.1 1.119-2 2.5-2 .781 0 1.478.288 1.936.738m1.88 3.123c1.035.354 1.684 1.111 1.684 1.94 0 1.1-1.119 2-2.5 2-.781 0-1.478-.288-1.936-.738M15 8l-6 8"/></svg>
            Share
          </button>

          <!-- Rename: saved files (markdown+snippet in view; drawing in edit) -->
          <button v-if="showRename" @click="$emit('rename-move')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Rename">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>

          <!-- Clone: saved markdown/snippet/drawing -->
          <button v-if="showClone" @click="$emit('clone')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Clone">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>

          <!-- Copy: snippet view only -->
          <button v-if="mode === 'view' && document.docType === 'snippet'" @click="$emit('snippet-copy')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Copy to clipboard">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            Copy
          </button>

          <!-- Edit: non-drawing editable docs in view mode -->
          <button v-if="mode === 'view' && document.type === 'file' && canEdit && document.docType !== 'drawing'" @click="$emit('edit')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>

          <!-- Drawing Save/Create -->
          <button v-if="document.docType === 'drawing'" @click="$emit('drawing-save')" :disabled="rendererState.drawingSaving" class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md text-white hover:opacity-90 disabled:opacity-50 transition-colors" style="background-color:hsl(var(--primary))">
            <span v-if="rendererState.drawingSaving" class="spinner" style="width:0.75rem;height:0.75rem;border-width:1px;border-top-color:white"></span>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ document.id ? 'Save' : 'Create' }}
          </button>

          <!-- Delete: any saved file -->
          <button v-if="showDelete" @click="$emit('delete-page')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border text-red-500 hover:bg-red-50 transition-colors" style="border-color:hsl(var(--border))" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>

        </template>

        <!-- ═══ EDIT MODE (markdown / snippet) ═══ -->
        <template v-if="mode === 'edit' && document?.docType !== 'drawing'">
          <button @click="$emit('save')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-white hover:opacity-90 transition-colors" style="background-color:hsl(var(--primary))">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Save
          </button>
          <button @click="$emit('cancel')" class="inline-flex items-center px-3 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))">
            Cancel
          </button>
        </template>

        <!-- ═══ CREATE + NOTIFICATIONS + DARK MODE + USER ═══ -->
        <div class="relative" ref="createDropdown">
          <button @click="showCreateMenu = !showCreateMenu" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Create new...">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
          <div v-if="showCreateMenu" class="absolute right-0 mt-1 w-44 rounded-lg border shadow-lg z-50 py-1" style="background-color:hsl(var(--background));border-color:hsl(var(--border))">
            <button @click="createAction('page')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color:hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              New Page
            </button>
            <button @click="createAction('snippet')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color:hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
              New Snippet
            </button>
            <button @click="createAction('drawing')" class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" style="color:hsl(var(--foreground))">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v12H4zM8 20h8"/></svg>
              New Drawing
            </button>
          </div>
        </div>

        <div class="relative" ref="notifDropdown">
          <button @click="$emit('toggle-notifications')" class="relative inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Notifications">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <span v-if="notifications.length" class="notif-badge">{{ notifications.length > 99 ? '99+' : notifications.length }}</span>
          </button>
          <div v-if="showNotifications" class="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border shadow-lg z-50" style="background-color:hsl(var(--background));border-color:hsl(var(--border))">
            <div class="flex items-center justify-between px-3 py-2 border-b" style="border-color:hsl(var(--border))">
              <span class="text-sm font-medium">Notifications</span>
              <button v-if="notifications.length" @click="$emit('clear-notifications')" class="text-xs hover:opacity-80" style="color:hsl(var(--primary))">Clear all</button>
            </div>
            <div v-if="!notifications.length" class="px-3 py-6 text-center text-sm" style="color:hsl(var(--muted-foreground))">No notifications</div>
            <button
              v-for="(n, i) in notifications.slice(0, 20)"
              :key="i"
              @click="$emit('navigate', n.path); $emit('toggle-notifications')"
              class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
              style="border-color:hsl(var(--border));color:hsl(var(--foreground))"
            >
              <img v-if="n.user.picture" :src="n.user.picture" class="w-6 h-6 rounded-full flex-shrink-0" referrerpolicy="no-referrer" />
              <div class="min-w-0 flex-1">
                <span class="font-medium">{{ n.user.name }}</span>
                <span> {{ n.action === 'save' ? 'updated' : n.action === 'create' ? 'created' : 'deleted' }} </span>
                <span class="font-medium truncate">{{ n.path }}</span>
                <div class="text-xs mt-0.5" style="color:hsl(var(--muted-foreground))">{{ timeAgo(n.ts) }}</div>
              </div>
            </button>
          </div>
        </div>

        <div v-if="presenceUsers.length" class="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style="background-color:hsl(var(--accent));color:hsl(var(--accent-foreground))" :title="presenceUsers.map(u => u.name).join(', ')">
          <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          {{ presenceUsers.length }}
        </div>

        <button @click="$emit('toggle-dark')" class="inline-flex items-center px-2 py-1.5 text-sm rounded-md border hover:opacity-80 transition-colors" style="border-color:hsl(var(--border));background-color:hsl(var(--muted))" title="Toggle dark mode">
          <svg v-if="darkMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        </button>

        <div class="flex items-center gap-2 ml-2 pl-2 border-l" style="border-color:hsl(var(--border))">
          <img v-if="user?.picture" :src="user.picture" class="w-7 h-7 rounded-full" referrerpolicy="no-referrer" />
          <span class="text-sm">{{ user?.name }}</span>
          <button @click="logout" class="text-sm hover:opacity-80 transition-colors" title="Sign out">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>

      </div>
    </header>
  `,
  inject: ['rendererState'],
  props: ['currentPath', 'mode', 'user', 'document', 'darkMode', 'notifications', 'showNotifications', 'presenceUsers'],
  emits: [
    'edit', 'save', 'cancel', 'new-page', 'new-snippet', 'new-drawing', 'delete-page',
    'toggle-dark', 'refresh-page', 'rename-move', 'clone', 'share-anonymous',
    'toggle-notifications', 'clear-notifications', 'navigate',
    'drawing-save', 'drawing-toggle-autosave', 'drawing-toggle-fullscreen',
    'snippet-copy',
    'asset-refresh', 'asset-upload', 'asset-create-subfolder',
  ],
  data() {
    return { showCreateMenu: false };
  },
  computed: {
    canEdit() {
      return this.document ? RendererService.canEdit(this.document.docType) : false;
    },
    canAnonymousShare() {
      return this.document?.id && this.document.type === 'file' && ['markdown', 'snippet', 'drawing'].includes(this.document.docType);
    },
    showRename() {
      if (!this.document?.id || this.document.type !== 'file') return false;
      const dt = this.document.docType;
      if (dt === 'drawing') return true;
      if (dt === 'snippet') return this.mode === 'view';
      if (dt === 'markdown') return this.mode === 'view';
      return false;
    },
    showClone() {
      return this.document?.id && ['markdown', 'snippet', 'drawing'].includes(this.document.docType);
    },
    showDelete() {
      if (!this.document?.id || this.document.type !== 'file') return false;
      const dt = this.document.docType;
      if (dt === 'drawing') return true;
      return this.mode === 'view' && this.canEdit;
    },
    samePageUsers() {
      if (!this.presenceUsers || !this.currentPath) return [];
      return this.presenceUsers.filter(u => u.path === this.currentPath);
    },
  },
  mounted() {
    document.addEventListener('click', this._clickOutside = (e) => {
      if (this.$refs.createDropdown && !this.$refs.createDropdown.contains(e.target)) {
        this.showCreateMenu = false;
      }
      if (this.$refs.notifDropdown && !this.$refs.notifDropdown.contains(e.target) && this.showNotifications) {
        this.$emit('toggle-notifications');
      }
    });
  },
  beforeUnmount() {
    document.removeEventListener('click', this._clickOutside);
  },
  methods: {
    logout() {
      if (typeof RealtimeService !== 'undefined') RealtimeService.disconnect();
      AuthManager.logout();
    },
    createAction(type) {
      this.showCreateMenu = false;
      if (type === 'page') this.$emit('new-page');
      else if (type === 'snippet') this.$emit('new-snippet');
      else if (type === 'drawing') this.$emit('new-drawing');
    },
    timeAgo(ts) {
      const diff = Date.now() - ts;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return Math.floor(diff / 86400000) + 'd ago';
    },
  },
};
