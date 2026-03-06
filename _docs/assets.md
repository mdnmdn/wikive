# Asset Manager

The asset manager provides a dedicated area for uploading, organizing, previewing, and referencing non-Markdown files (images, PDFs, code snippets, videos, etc.) within the wiki.

## Accessing Assets

Click the **Assets** link at the bottom of the sidebar, or navigate to `#/_assets`. The first visit creates the `_assets` folder inside `_wiki` in Google Drive.

## Uploading Files

There are three ways to upload:

### Drag and Drop
Drag files from your file manager onto the drop zone. Multiple files can be dropped at once.

### Click to Upload
Click the **Upload** button in the top-right corner. A native file picker opens. Select one or more files.

### Paste from Clipboard
Copy an image (e.g., screenshot, or from a web page) and press **Ctrl+V** / **Cmd+V** while on the assets page. Pasted images get auto-named with a timestamp (e.g., `pasted-1709731200000.png`).

## File Grid

Uploaded files appear in a responsive grid. Each card shows:

- **Thumbnail**: images show a preview; other files show a type icon with the file extension
- **File name**: truncated with ellipsis if too long
- **Action buttons**:
  - **Copy wiki path** (clipboard icon) - copies the path for use in Markdown pages
  - **Download** (arrow-down icon) - downloads the file to your computer
  - **Rename** (pencil icon) - opens a rename dialog
  - **Delete** (trash icon) - opens a confirmation dialog
- **Wiki path badge**: a monospace badge at the bottom showing the full path (e.g., `/_assets/images/logo.png`). Click to copy.

## Wiki Paths

Every asset has a wiki path that can be copied and used in Markdown pages. The path format is:

```
/_assets/filename.ext
/_assets/subfolder/filename.ext
```

Click the path badge on any asset card, or click the clipboard icon, to copy the path to your clipboard. A toast notification confirms the copy.

## Subfolder Organization

Click the **folder+** button to create subfolders within `_assets`. Navigate into subfolders by clicking them. A breadcrumb trail shows your current location:

```
_assets / images / screenshots
```

Click any breadcrumb segment to navigate back up.

## Preview

Click any file to open a full-screen preview modal. The preview type depends on the file:

### Images
`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`

Displayed inline with the browser's native image rendering. Scales to fit the viewport.

### Video
`.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`

Native `<video>` player with controls (play, pause, seek, volume, fullscreen).

### Audio
`.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`

Native `<audio>` player with controls.

### PDF
`.pdf`

Embedded in an `<iframe>` using the browser's built-in PDF viewer.

### Text, Markdown, and Code Files
`.txt`, `.md`, `.json`, `.js`, `.ts`, `.css`, `.html`, `.xml`, `.yaml`, `.py`, `.rb`, `.rs`, `.go`, `.java`, `.c`, `.cpp`, `.sh`, `.sql`, `.csv`, `.log`, and many more.

- **View mode**: Markdown files render as HTML; code/text files display in a monospace `<pre>` block
- **Edit mode**: Click **Edit** in the preview header to switch to a full-height `<textarea>` editor. Click **Save** to write changes back to Drive.

### Other File Types
A "Preview not available" message with a **Download** button.

## Rename

Click the pencil icon on any asset card. A dialog opens with the current name pre-filled:
- For files, the name (without extension) is pre-selected for easy renaming
- For folders, the full name is selected
- Press Enter or click **Rename** to confirm

## Delete

Click the trash icon on any asset card. A confirmation dialog asks before proceeding. The file is permanently deleted from Google Drive (not moved to trash).

## How Assets Are Stored

```
Google Drive/
  _wiki/
    _assets/                    # Created on first visit to Assets
      logo.png                  # Uploaded files
      diagram.svg
      images/                   # User-created subfolder
        screenshot-1.png
        screenshot-2.png
      documents/
        spec.pdf
        notes.txt
```

The `_assets` folder is a regular Google Drive folder inside `_wiki`. It is:
- **Hidden from the sidebar page tree** - the sidebar filters it out and shows a dedicated "Assets" link instead
- **Accessible at `#/_assets`** - its own route in the app
- **Browsable in Google Drive** - you can view/download assets directly in Drive's web UI
