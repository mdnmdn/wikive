const Breadcrumb = {
  template: `
    <nav class="breadcrumb" v-if="segments.length > 0">
      <span class="separator">/</span>
      <template v-for="(seg, i) in segments" :key="i">
        <a :href="'#/' + seg.path">{{ formatSegment(seg, i) }}</a>
        <span v-if="i < segments.length - 1" class="separator">/</span>
      </template>
    </nav>
  `,
  props: ['path', 'document'],
  computed: {
    segments() {
      if (!this.path || this.path === '/') return [];
      const parts = this.path.split('/').filter(Boolean);
      return parts.map((name, i) => ({
        name,
        path: parts.slice(0, i + 1).join('/'),
      }));
    },
  },
  methods: {
    formatSegment(seg, index) {
      // For snippet routes, show the document name for the last segment (which is an ID)
      if (this.document && index === this.segments.length - 1) {
        if (seg.path.startsWith('_snippets/') && this.document.name) {
          return this.document.name;
        }
        if (seg.path.startsWith('_drawings/') && this.document.name) {
          return this.document.name.replace(/\.excalidraw$/, '');
        }
      }
      return seg.name;
    },
  },
};
