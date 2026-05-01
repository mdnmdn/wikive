serve:
    python3 -m http.server -d public 9595

pnpm-serve:
    pnpm dlx serve public -p 9595

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
    pnpm run dev

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

deploy env="default":
    #!/usr/bin/env bash
    set -e
    echo "Deploying to environment: {{env}}"

    rm -rf __deploy
    mkdir __deploy

    # Copy worker files
    cp -r src __deploy/src
    cp -r public __deploy/public
    cp package*.json pnpm-lock.yaml __deploy/
    cp wrangler.toml __deploy/

    # Create version.json
    VERSION="manual-$(date +%Y%m%d-%H%M)"
    BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "{\"version\": \"$VERSION\", \"buildDate\": \"$BUILD_DATE\", \"branch\": \"$BRANCH\", \"actionId\": \"manual\"}" > __deploy/public/version.json

    # Inject environment config
    if [ -f "_devops/envs/{{env}}/config.js" ]; then
        cp "_devops/envs/{{env}}/config.js" __deploy/public/config.js
    else
        echo "Warning: _devops/envs/{{env}}/config.js not found"
    fi

    # Install and deploy
    cd __deploy
    pnpm install
    pnpx wrangler deploy
