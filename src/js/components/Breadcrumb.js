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
  props: ['path', 'snippetName'],
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
      if (this.snippetName && seg.path.startsWith('_snippets/') && index === this.segments.length - 1) {
        return this.snippetName;
      }
      return seg.name;
    }
  }
};
