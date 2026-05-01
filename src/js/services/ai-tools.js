// AI Tools — wiki document operations for the AI assistant

window.getWikiTools = async function() {
  const { s } = await import('@hashbrownai/core');

  return [
    {
      name: 'readPage',
      description: 'Read the markdown content of a wiki page. Pass the path as argument.',
      label: (args) => `Reading "${args?.path ?? ''}"`,
      schema: s.object('readPage input', {
        path: s.string('Page path relative to wiki root, without the .md extension. Examples: "home", "notes/meeting".'),
      }),
      async handler({ path }, _signal) {
        if (!path) throw new Error('path is required');
        const resolved = await StorageService.resolvePath(path);
        if (!resolved || resolved.type !== 'file') {
          throw new Error(`Page not found: ${path}`);
        }
        const content = await StorageService.getFileContent(resolved.id);
        return { content };
      },
    },
    {
      name: 'writePage',
      description: 'Create or update a wiki page. Pass path and content as arguments.',
      label: (args) => `Writing "${args?.path ?? ''}"`,
      schema: s.object('writePage input', {
        path: s.string('Page path relative to wiki root, without .md extension. Use "/" for subfolders.'),
        content: s.string('Full markdown content to write to the page.'),
      }),
      async handler({ path, content }, _signal) {
        if (!path || content === undefined) throw new Error('path and content are required');
        const resolved = await StorageService.resolvePath(path);
        if (resolved && resolved.type === 'file') {
          await StorageService.updateFile(resolved.id, content);
          return { status: 'updated', path };
        } else {
          const file = await StorageService.createFile(path + '.md', content);
          return { status: 'created', path, id: file.id };
        }
      },
    },
    {
      name: 'listPages',
      description: 'List all wiki pages. Optionally pass a folder prefix to filter.',
      label: () => 'Listing pages',
      schema: s.object('listPages input', {
        prefix: s.string('Folder prefix to filter results, e.g. "notes". Pass an empty string to list all pages.'),
      }),
      async handler({ prefix }, _signal) {
        const rootId = await StorageService.getRootFolderId();
        const files = await StorageService.listFolder(rootId, { prefix: prefix || '' });
        const pages = files
          .filter(f => f.name && f.name.endsWith('.md'))
          .map(f => f.path?.replace(/\.md$/, '') || f.name.replace(/\.md$/, ''));
        return { pages };
      },
    },
    {
      name: 'deletePage',
      description: 'Delete a wiki page. Pass the path as argument.',
      label: (args) => `Deleting "${args?.path ?? ''}"`,
      schema: s.object('deletePage input', {
        path: s.string('Page path without .md extension.'),
      }),
      async handler({ path }, _signal) {
        if (!path) throw new Error('path is required');
        const resolved = await StorageService.resolvePath(path);
        if (!resolved || resolved.type !== 'file') {
          throw new Error(`Page not found: ${path}`);
        }
        await StorageService.deleteFile(resolved.id);
        return { status: 'deleted', path };
      },
    },
  ];
};