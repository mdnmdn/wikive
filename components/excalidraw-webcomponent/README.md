# Excalidraw Web Component

A lightweight web component wrapper for Excalidraw, allowing you to embed the Excalidraw editor into any web application (Vanilla JS, Vue, Angular, etc.) as a custom HTML element.

## Installation

1. Clone or download this project.
2. Install dependencies: `pnpm install`
3. Build the distributable: `pnpm build`

## Usage

Include the generated JS and CSS files in your project:

```html
<link rel="stylesheet" href="dist/excalidraw-webcomponent3.css">
<script src="dist/excalidraw-wc.umd.js"></script>

<div style="width: 800px; height: 600px;">
    <excalidraw-component id="excalidraw"></excalidraw-component>
</div>
```

### API

The web component exposes the following methods:

- `save()`: Returns the current scene as a JSON string.
- `load(json: string)`: Loads a scene from a JSON string.
- `exportPng(opts?: any)`: Returns a Promise that resolves to a PNG Blob of the current scene.
- `zoomToFit()`: Zooms the view to fit all elements.
- `clear()`: Clears the canvas.
- `getRawAPI()`: Returns the underlying Excalidraw Imperative API for advanced usage.

### Attributes

- `initial-data`: A JSON string representing the initial scene state.

### Events

- `change`: Fired whenever the scene changes. The `detail` property contains `elements`, `appState`, and `files`.

```javascript
const el = document.getElementById('excalidraw');
el.addEventListener('change', (e) => {
    console.log('Canvas changed!', e.detail.elements);
});
```

## Development

- `pnpm dev`: Start the Vite development server.
- `pnpm build`: Create the production build in the `dist/` directory.
- `pnpm preview`: Preview the production build.

## Notes

- The component requires a container with defined width and height to display correctly.
- Excalidraw assets (fonts, etc.) are bundled or loaded from CDNs as per Excalidraw's default behavior.
