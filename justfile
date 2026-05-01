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


worker-dev:
    cd worker && pnpm run dev

run-all-dev:
    #!/usr/bin/env bash
    just compose-up
    if ! command -v mprocs &> /dev/null; then
        echo "Error: mprocs is not installed"
        echo "Install it with: brew install mprocs (or npm install -g mprocs)"
        exit 1
    fi
    echo "Starting all development servers with mprocs..."
    echo "Worker on http://localhost:8787"
    echo "Frontend on http://localhost:9595"
    echo ""
    mprocs --config _devops/mprocs.yaml
