# Google Wiki

A zero-backend personal wiki that runs entirely in the browser, storing Markdown pages and related files in your Google Drive.

## Features

- **No Backend Required**: Runs as a static site from CDN-hosted libraries.
- **Google Drive Integration**: Uses Google OAuth for login and stores data in your Drive.
- **Markdown Support**: Render pages with syntax highlighting and Mermaid diagrams.
- **Asset Manager**: Manage images and other files directly in the wiki.
- **Snippet Manager**: Store temporary code or text snippets with expiration.
- **Local Caching**: Stale-while-revalidate for fast loading.
- **Zero Build Step**: Pure HTML/CSS/JS.

## Setup

1.  Copy `src/config.sample.js` to `src/config.js`.
2.  Configure your Google OAuth Client ID in `src/config.js`.
3.  Ensure your Google Cloud Console project has the Google Drive API enabled and the proper OAuth consent screen configured.

## Development

You can serve the project using `just`:

```bash
# Serve using Python 3
just serve

# Serve using pnpm serve
just pnpm-serve
```

The app will be available at `http://localhost:9595`.

## License

MIT
