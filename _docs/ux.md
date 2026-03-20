# UX & Frontend Architecture

## Layout structure

The app uses a classic **sidebar + main content** shell, rendered as a full-height flexbox column.

```
┌──────────────────────────────────────────────────┐
│  AppHeader (fixed top bar)                       │
├──────────┬───────────────────────────────────────┤
│          │                                       │
│ Sidebar  │  Main Content                         │
│ (260px)  │  (flex-1, max-width 900px for prose)  │
│          │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
                                          Toast ─┘
```

- **`#app`**: Full-height flex column (`flex-direction: column`).
- **`.app-body`**: Flex row holding sidebar and main content. `overflow: hidden` prevents double scrollbars.
- **`.sidebar`**: Fixed 260px width, collapsible to 52px via a floating circular toggle button at the bottom-right edge. On mobile (<768px), the sidebar becomes a fixed overlay that slides off-screen when collapsed.
- **`.main-content`**: Flex-grows to fill remaining width. Scrolls independently (`overflow-y: auto`). Capped at 900px for readability on markdown/folder views. The cap is removed for editors, assets, snippets, and drawings (`max-width: none`).

## Screens and modes

### Unauthenticated — Login Screen

Full-page centered card over a purple-to-blue gradient. Shows the app logo, a tagline, and a Google-branded sign-in button. Minimal — one action, one screen.

### Authenticated — App Shell

After login, the app shell renders three permanent regions:

1. **AppHeader** — Top bar with: logo (links home), breadcrumb, context-sensitive action buttons, "+" create dropdown, dark mode toggle, user avatar + sign-out.
2. **Sidebar** — Left panel with perspective filter buttons, search input, recursive folder tree, and (in assets perspective) a drag-and-drop upload zone.
3. **Main Content** — Central area dispatched by `DocumentRenderer` based on the current document's `docType` and `mode` (view/edit).

### Content modes by document type

| Document type | View mode | Edit mode |
|---------------|-----------|-----------|
| **Markdown** | Rendered HTML with syntax highlighting, mermaid diagrams, link interception | Toast UI Editor (WYSIWYG + Markdown split) |
| **Snippet** | Read-only Ace editor with copy button, language badge, expiry countdown | Editable Ace with name, language selector, expiry duration controls |
| **Drawing** | Read-only Excalidraw canvas with PNG download | Full Excalidraw editor with save, fullscreen, name editing |
| **Asset** | Grid of cards with thumbnails, preview modal, upload, rename, delete, subfolder navigation | N/A (managed inline) |
| **Folder** | If `home.md`/`index.md` exists: renders it as markdown. Otherwise: card grid of contents with "Create Page" button | N/A |
| **Not found** | Centered 404 with the missing path and a "Create this page" button | N/A |

## Navigation and routing

- **Hash-based**: All routes use `window.location.hash` (`#/path/to/doc`). No server required.
- **Route resolution**: `onRouteChange()` detects special folders (`_assets`, `_snippets`, `_drawings`) and dispatches to `resolveSpecialRoute()` or `resolveWikiRoute()`. Wiki paths try `segment.md` first, then exact name, then show 404.
- **Breadcrumb**: Renders each path segment as a clickable link. For snippet/drawing IDs in the URL, it resolves the human-readable name from the document prop.
- **Internal links**: Markdown links that don't start with `http` or `#` are intercepted and resolved relative to the current document's path, then navigated via hash change.

## Sidebar UX

### Perspective filters

Five icon buttons at the top of the sidebar act as content filters:

| Button | Filter | Behaviour |
|--------|--------|-----------|
| All (list icon) | Shows everything | Default view |
| Pages (book icon) | Markdown files + non-special folders | Hides `_snippets`, `_drawings`, `_assets` |
| Snippets (code icon) | Snippet files + `_snippets` folder | Auto-expands `_snippets`; navigates to `#/_snippets` |
| Drawings (canvas icon) | Drawing files + `_drawings` folder | Auto-expands `_drawings`; navigates to `#/_drawings` |
| Assets (upload icon) | Asset files + `_assets` folder | Auto-expands `_assets`; navigates to `#/_assets` |

Clicking a perspective filter also navigates to the matching special route if not already there.

### Tree behaviour

- **Unified recursive tree**: `SidebarTree` loads folder contents from Drive, deduplicates entries where a folder and `.md` file share the same base name (folder wins), and renders items with docType-aware icons.
- **Folders are documents**: Clicking a folder navigates to it (renders its `home.md` or card grid). The chevron icon separately toggles expand/collapse of children.
- **Auto-expand**: When a page is created, `expandPath` propagates through the tree to auto-expand parent folders to reveal the new item.
- **Search**: Real-time case-insensitive name filtering. Applied at each tree level.
- **Snippet expiry badges**: Snippets in the tree show a time-left badge (e.g. "2h", "15m", "Exp"). Items expiring within 1 hour are highlighted in orange.

### Asset upload zone

When the "Assets" perspective is active, a drag-and-drop zone and upload button appear at the bottom of the sidebar. Files dropped here are uploaded directly to the `_assets` folder in Drive.

## Header UX

The header adapts its action buttons based on context:

- **View mode** (editable document): Shows Refresh, Edit, Delete buttons.
- **Edit mode**: Shows Save (primary color) and Cancel buttons.
- **Always visible**: "+" dropdown (New Page, New Snippet, New Drawing), dark mode toggle, user info with sign-out.

The "+" create dropdown closes on outside click.

## Dialogs and modals

All modals use a fixed full-screen backdrop (`bg-black/50`) with a centered card. Clicking the backdrop dismisses the modal (except during async operations).

- **New Page dialog**: Text input for path with helper text about `/` for subfolders. Shows a spinner during creation; inputs disabled while creating. Auto-focuses the input on open.
- **Asset preview modal**: Full-screen modal with type-aware content: images scale to fit, video/audio show native controls, PDFs render in an iframe, text files show in a `<pre>` or as rendered markdown, with an edit mode via textarea. Unknown types show a download button.
- **Asset rename dialog**: Single input pre-focused with filename selected (extension excluded).
- **Asset delete confirmation**: Warning text explaining the file moves to Drive trash.

## Color system and theming

Uses CSS custom properties following the shadcn/ui pattern, consumed by Tailwind via `hsl(var(--token))`.

### Light mode palette (elegant purple)

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `0 0% 100%` | Page background |
| `--foreground` | `240 10% 3.9%` | Primary text |
| `--primary` | `268 90% 50%` | Buttons, links, active states |
| `--muted` | `260 30% 96%` | Subtle backgrounds, code blocks |
| `--accent` | `260 20% 92%` | Hover states, active tree items |
| `--border` | `260 25% 88%` | All borders |
| `--destructive` | `0 84.2% 60.2%` | Delete actions |

### Dark mode

Toggled via the `.dark` class on `<html>`. CSS variables shift to darker purple tones. Third-party tools adapt: highlight.js switches to `github-dark`, mermaid switches to `dark` theme, Toast UI Editor gets background/color overrides via `.dark` scoped CSS.

Dark mode preference persists in `localStorage`.

## Responsive design

- **Mobile breakpoint**: `768px`.
- **Sidebar**: Becomes a fixed overlay positioned below the header. Collapsed state slides it fully off-screen (`translateX(-100%)`).
- **Main content**: Padding reduces from `2rem 3rem` to `1.5rem`.
- No other breakpoints — the layout relies on flexbox and `auto-fill` grids to adapt naturally.

## Feedback and loading states

- **Spinner**: Small CSS-only spinning circle (`border-top` trick) used consistently for all loading states — page load, page creation, asset upload.
- **Toast notifications**: Fixed bottom-right, slide-up animation, auto-dismiss after 3s. Three variants: success (green), error (red), info (primary purple). Click to dismiss early.
- **Disabled states**: Buttons and inputs get `disabled:opacity-50` during async operations.
- **Empty states**: Centered messages with large muted icons for empty folders, no search results, no assets, and unknown document types.

## Interaction patterns

- **View/Edit toggle**: Documents start in view mode. Edit button switches to edit mode; Save persists and returns to view; Cancel discards and returns to view. Snippets and drawings handle their own save lifecycle and notify the parent via events.
- **Create flow**: "+" dropdown → select type → type-specific creation (dialog for pages, immediate navigation for snippets, immediate canvas for drawings). New pages auto-navigate and auto-enter edit mode via `pendingEditPath`.
- **Delete flow**: Confirm dialog → trash in Drive → navigate to parent path → refresh sidebar.
- **Clipboard paste**: In the asset viewer, pasting an image from the clipboard uploads it directly as a timestamped file.
- **Wiki path copy**: Assets show a monospace wiki path below each item. Clicking it copies the path to clipboard for use in markdown pages.

## Typography and prose

Markdown content renders inside a `.prose` container with carefully tuned styles:

- Headings: `h1` at 2rem with bottom border, `h2` at 1.5rem, `h3` at 1.25rem.
- Body text: 1.7 line-height for readability.
- Code: Inline code gets muted background + rounded corners. Code blocks get muted background + horizontal scroll.
- Blockquotes: Left border in primary color with muted text.
- Tables: Full-width with collapsed borders and muted header background.
- Images: Max-width 100% with rounded corners.
- Links: Primary color with underline, opacity hover effect.

## Component communication

The app uses a **props-down, events-up** pattern with minimal root state:

- Root (`app.js`) holds: `document`, `fileContent`, `mode`, `darkMode`, `sidebarCollapsed`.
- `DocumentRenderer` dispatches to the correct renderer component via `RendererService.getRenderer(docType, mode)` using Vue's `<component :is>`.
- All renderers emit a standard set of events: `@save`, `@delete`, `@toast`, `@mode-change`, `@navigate`.
- The sidebar communicates upward via `@refresh`, `@toggle-collapse`, `@toast`, `@assets-uploaded`.
