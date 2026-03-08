// localStorage cache with TTL and stale-while-revalidate
const CacheService = {
  _prefix: 'wiki:',

  get(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      return entry;
    } catch {
      return null;
    }
  },

  getValue(key) {
    const entry = this.get(key);
    return entry ? entry.value : null;
  },

  isFresh(key) {
    const entry = this.get(key);
    return entry && entry.expiry > Date.now();
  },

  set(key, value) {
    const entry = {
      value,
      expiry: Date.now() + CONFIG.CACHE_TTL,
      ts: Date.now(),
    };
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(entry));
    } catch (e) {
      // Quota exceeded - evict oldest entries
      this._evictOldest(5);
      try {
        localStorage.setItem(this._prefix + key, JSON.stringify(entry));
      } catch {
        // Give up
      }
    }
  },

  remove(key) {
    localStorage.removeItem(this._prefix + key);
  },

  invalidatePath(path) {
    // Remove content and path caches for this path
    this.remove('content:' + path);
    this.remove('path:' + path);
    // Invalidate parent listing
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    this.remove('listing:' + parent);
  },

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this._prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },

  _evictOldest(count) {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this._prefix)) {
        try {
          const entry = JSON.parse(localStorage.getItem(k));
          entries.push({ key: k, ts: entry.ts || 0 });
        } catch {
          entries.push({ key: k, ts: 0 });
        }
      }
    }
    entries.sort((a, b) => a.ts - b.ts);
    entries.slice(0, count).forEach(e => localStorage.removeItem(e.key));
  },
};
