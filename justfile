serve:
    python3 -m http.server -d src 9595

pnpm-serve:
    pnpm dlx serve src -p 9595

# Build the Excalidraw web component bundle
excalidraw-build:
    cd components/excalidraw-webcomponent && pnpm install && pnpm run build

# Build and copy Excalidraw assets into src/js and src/css
excalidraw-sync: excalidraw-build
    # Ensure target directories exist
    mkdir -p src/js src/css
    # Copy the webcomponent bundle into js
    cp components/excalidraw-webcomponent/dist/excalidraw-wc.umd.js src/js/

