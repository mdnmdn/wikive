# Overview

## What is Google Wiki?

Google Wiki is a personal wiki application that runs entirely in the browser. It uses Google Drive as its storage backend - every page is a Markdown file, every section is a folder, and every asset lives in a dedicated `_assets` directory. There is no server to deploy, no database to manage, and no build step to run.

## Goals

1. **Zero infrastructure** - No backend, no hosting costs, no deployment pipeline. Serve the static files from anywhere (localhost, GitHub Pages, a file:// URL) and it works.

2. **User-owned data** - All content lives in the user's own Google Drive. They can browse, edit, or delete their wiki files directly in Drive. No vendor lock-in beyond Google Drive itself.

3. **Minimal scope, maximum utility** - A wiki needs pages, navigation, editing, and assets. This project provides exactly that with no bloat.

4. **Zero build step** - Every dependency loads from a CDN. The project is plain HTML, CSS, and JavaScript files. No npm, no webpack, no transpilation.

## Design Philosophy

### Why Google Drive?

Google Drive provides free storage, authentication, file versioning, sharing, and a REST API - all for free. By using the `drive.file` scope, the app can only access files it created itself, which is the minimum-privilege approach.

### Why no backend?

A backend adds complexity: hosting, databases, authentication middleware, CORS, deployment. Google's OAuth2 implicit grant flow and Drive REST API work directly from the browser, making a backend unnecessary for this use case.

### Why Vue 3 from CDN?

Vue's global build (`vue.global.prod.js`) works without a build step. Components are plain JavaScript objects with `template` strings. This keeps the project simple while still providing reactivity, component composition, and lifecycle hooks.

### Why hash routing?

Hash-based routing (`#/path/to/page`) works without a server that handles URL rewriting. The app can be served from any static file server, opened as a local file, or hosted on GitHub Pages - no `.htaccess` or server configuration needed.

### Why Toast UI Editor?

Toast UI Editor is one of the few full-featured Markdown editors that works from a CDN without a build step. It provides WYSIWYG editing, raw Markdown mode, and a toolbar - all out of the box. Alternatives like Milkdown require a bundler.

## What the App Does

1. **Authenticates** the user via Google OAuth2 (implicit grant)
2. **Creates** a `_wiki` folder in their Google Drive (if it doesn't exist) with a welcome `index.md`
3. **Renders** Markdown files with syntax highlighting (highlight.js) and diagrams (mermaid)
4. **Edits** pages with a WYSIWYG/Markdown toggle editor (Toast UI Editor)
5. **Navigates** via a sidebar folder tree, breadcrumbs, and hash-based URLs
6. **Manages assets** (images, PDFs, code files) with drag-and-drop upload, preview, rename, delete, and copyable wiki paths
7. **Caches** aggressively in localStorage with stale-while-revalidate for instant page loads

## Security Model

- **OAuth scope**: `drive.file` - the app can only see files it created. It cannot read the user's other Drive files.
- **Token storage**: Access tokens are stored in `sessionStorage` (cleared when the browser tab closes). They are never written to localStorage or sent to any server other than Google's API.
- **No backend**: There is no server that handles or stores user credentials. The OAuth flow happens entirely between the browser and Google's servers.
