# JupyterLite — Kernels

## Overview

JupyterLite runs kernels entirely in the browser using WebAssembly. No server process is needed.
The wiki's JupyterLite bundle (v0.7.4) ships with a single kernel — **Pyodide (python3)** — which
provides a near-full Python 3.11 environment with NumPy, pandas, matplotlib, and hundreds of other
packages available via `micropip`.

This document covers:
- Available kernels and their trade-offs
- How to install and activate additional kernels
- How to configure the default kernel
- How to pre-install Python packages

---

## Available kernels

### 1. Pyodide — `python` (currently installed)

| Property | Value |
|----------|-------|
| Package | `@jupyterlite/pyodide-kernel` |
| Kernel name (id) | `python` |
| Display name | `Python (Pyodide)` |
| Language | Python 3.11 |
| Engine | Pyodide (CPython compiled to WASM) |
| Bundle size | ~8–12 MB download (WASM) |
| Package manager | `micropip` / `piplite` |
| Status in wikive | Installed and active |

Pyodide supports almost all pure-Python packages plus many binary extensions (NumPy, SciPy, pandas, PIL,
etc.) that have been compiled to WASM. It is the most capable Python-in-browser option.

**Startup time**: 3–10 seconds on first load (WASM compilation); subsequent loads are served from the
service worker cache.

### 2. xeus-python — `xpython`

| Property | Value |
|----------|-------|
| Package | `jupyterlite-xeus` (unified package — `jupyterlite-xeus-python` is **deprecated**) |
| Kernel name (id) | `xpython` |
| Display name | `Python (xeus-python)` |
| Engine | xeus (C++ Jupyter protocol impl) + Emscripten Python |
| Bundle size | ~4–6 MB |
| Package manager | `%pip` magic / conda-forge packages compiled with Emscripten toolchain |
| Status in wikive | Not installed |

xeus-python starts faster than Pyodide and supports `time.sleep` (blocked in Pyodide). The trade-off is
fewer dynamically installable packages — only packages compiled with Emscripten's toolchain are available.
Pre-install packages via `environment.yml` at build time.

> **Deep dive**: https://github.com/jupyterlite/xeus  
> **xeus-lite docs**: https://jupyterlite-xeus.readthedocs.io/

### 3. TypeScript kernel — `typescript`

| Property | Value |
|----------|-------|
| Package | `jupyterlite-typescript-kernel` |
| Kernel name (id) | `typescript` |
| Display name | `TypeScript` |
| Engine | TypeScript Compiler API in WASM |
| Bundle size | ~3 MB |
| Status in wikive | Not installed |

Useful for wiki contributors who want to prototype JavaScript/TypeScript snippets interactively.
Integrates naturally with the wiki's JavaScript-first architecture.

> **Deep dive**: https://github.com/jupyterlite/jupyterlite-typescript-kernel

### 4. JavaScript kernel — `javascript`

Ships with some JupyterLite builds. Uses a WebWorker to eval JavaScript. Limited stdlib but useful for
quick JS prototyping.

### 5. xeus-lua — `xlua`

| Property | Value |
|----------|-------|
| Package | `jupyterlite-xeus` (configure via `environment.yml` with `xeus-lua`) |
| Engine | Lua compiled to WASM via Emscripten |
| Status | Experimental |

> **Deep dive**: https://github.com/jupyterlite/xeus

### 6. xeus-sql — `xsql`

SQL notebook interface using an in-memory SQLite database compiled to WASM. Configure via
`jupyterlite-xeus` with `xeus-sqlite` in `environment.yml`.

> **Deep dive**: https://github.com/jupyterlite/xeus

### 7. xeus-cpp — `xcpp`

C++ kernel using Clang/LLVM compiled to WASM. Configure via `jupyterlite-xeus` with `xeus-cpp` in
`environment.yml`. Useful for systems programming demonstrations.

### 8. R kernel — `ir` (experimental)

WebR provides R in the browser. JupyterLite R kernels are experimental but available.

> **Deep dive**: https://webr.r-wasm.org/, https://github.com/georgestagg/jupyterlite-webr-kernel

> **Note**: All xeus-based kernels use the unified `jupyterlite-xeus` Python package. The old individual
> packages (`jupyterlite-xeus-python`, `jupyterlite-xeus-lua`) are **deprecated**. Configure which
> kernels to include via `environment.yml` placed in the build directory root.

---

## How kernels are installed in JupyterLite

JupyterLite bundles are built using `jupyter lite build` (Python CLI). The build tool copies kernel
WASM files and registers them in `jupyter-lite.json` as federated extensions. Because the wiki avoids a
build step, kernels must be added **manually** to the static bundle.

There are two ways to add a kernel without a build step:

### Method A — copy pre-built kernel assets + register manually

Many JupyterLite kernels publish pre-built NPM packages. Their `static/` folder contains the
`remoteEntry.js` webpack module federation entry point and the WASM payload.

Steps:

1. **Download the kernel NPM package**:
   ```bash
   npm pack @jupyterlite/pyodide-kernel   # example — already installed
   # or for xeus-python:
   npm pack @jupyterlite/xeus-python-kernel
   ```

2. **Extract the `labextension/` folder** from the tarball and place it under:
   ```
   public/jupyterlite/extensions/<kernel-package-name>/
   ```

3. **Register in `jupyter-lite.json`** (all copies: root, `lab/`, `repl/`, etc.):
   ```json
   {
     "jupyter-config-data": {
       "federated_extensions": [
         {
           "extension": "./extension",
           "load": "static/remoteEntry.HASH.js",
           "name": "@jupyterlite/xeus-python-kernel",
           "style": "./style"
         }
       ]
     }
   }
   ```
   Replace `HASH` with the actual filename from the extracted `static/` folder.

4. **Add kernel spec** to `jupyter-lite.json`:
   ```json
   {
     "jupyter-config-data": {
       "kernelspecs": {
         "xpython": {
           "argv": ["xpython"],
           "display_name": "Python (xeus-python)",
           "language": "python",
           "name": "xpython",
           "resources": {
             "logo-32x32": "kernelspecs/xpython/logo-32x32.png",
             "logo-64x64": "kernelspecs/xpython/logo-64x64.png"
           }
         }
       }
     }
   }
   ```

### Method B — use `jupyter lite build` once and commit the output

```bash
# One-time setup (use jupyterlite-xeus, NOT the deprecated jupyterlite-xeus-python)
pip install jupyterlite-core jupyterlite-pyodide-kernel jupyterlite-xeus

# Configure xeus kernels via environment.yml in the build root:
# environment.yml:
#   name: xeus-environment
#   channels:
#     - https://repo.mamba.pm/emscripten-forge
#     - conda-forge
#   dependencies:
#     - xeus-python
#     - xeus-lua

# Build the bundle
jupyter lite build \
  --output-dir public/jupyterlite \
  --apps lab repl \
  --no-sourcemaps

# Commit the output
git add public/jupyterlite
```

After an initial build, the output is static HTML/JS and can be committed to the repo. Future kernel
additions require re-running the build command and committing the updated output.

**This is the recommended approach** for adding kernels, even though it requires a one-time Python
toolchain setup.

> **Deep dive**:
> - JupyterLite CLI: https://jupyterlite.readthedocs.io/en/stable/reference/cli.html
> - jupyterlite-core: https://pypi.org/project/jupyterlite-core/
> - jupyterlite-pyodide-kernel: https://pypi.org/project/jupyterlite-pyodide-kernel/
> - jupyterlite-xeus: https://pypi.org/project/jupyterlite-xeus/

---

## Changing the default kernel

In `public/jupyterlite/jupyter-lite.json` (and each sub-env copy), set:

```json
{
  "jupyter-config-data": {
    "defaultKernelName": "python"
  }
}
```

Valid values: any kernel `name` field from `kernelspecs` (e.g. `"python"`, `"xpython"`, `"typescript"`).

The `NotebookViewer.js` REPL also passes `?kernel=python` in the URL. Update that param when changing the
default:

```js
// js/renderers/NotebookViewer.js
const params = new URLSearchParams({
  kernel: 'xpython',  // or 'typescript', etc.
  toolbar: '1',
  theme: this.darkMode ? 'JupyterLab Dark' : 'JupyterLab Light'
});
```

For notebooks stored in Drive that specify a `kernelspec` in their metadata, JupyterLite will respect
that value and attempt to start the matching kernel (falling back to the default if unavailable).

---

## Per-notebook kernel selection

The nbformat metadata block controls which kernel opens a notebook:

```json
{
  "metadata": {
    "kernelspec": {
      "display_name": "Python (Pyodide)",
      "language": "python",
      "name": "python"
    }
  }
}
```

When creating a new notebook in `doCreateNewNotebook()` (`app.js:968`), include the appropriate
`kernelspec` metadata in the initial JSON template. If the wiki will support multiple kernels in the
future, the "New Notebook" dialog should offer a kernel selection dropdown.

---

## Pre-installing Python packages

### Option 1 — `piplite` at notebook runtime

Inside a notebook cell:

```python
import piplite
await piplite.install(['matplotlib', 'scikit-learn'])
```

Or using the `%pip` magic (Pyodide kernel):

```python
%pip install matplotlib scikit-learn
```

### Option 2 — pre-bundle packages in `jupyter-lite.json`

Packages listed under `pipliteUrls` are loaded automatically when the kernel starts:

```json
{
  "jupyter-config-data": {
    "pipliteUrls": [
      "https://pypi.org/pypi/numpy/json",
      "https://pypi.org/pypi/pandas/json"
    ],
    "pipliteWheelUrls": [
      "./wheels/mypackage-1.0.0-py3-none-any.whl"
    ]
  }
}
```

### Option 3 — include wheels in the bundle

Place `.whl` files under `public/jupyterlite/wheels/` and reference them in `pipliteWheelUrls`. Useful for
private or modified packages.

> **Deep dive**:
> - piplite docs: https://jupyterlite.readthedocs.io/en/stable/howto/configure/piplite.html
> - Pyodide package index: https://pyodide.org/en/stable/usage/packages-in-pyodide.html
> - micropip docs: https://micropip.pyodide.org/en/stable/

---

## Kernel configuration file (`overrides.json`)

JupyterLite supports a per-deployment `overrides.json` at `public/jupyterlite/overrides.json` for
default settings:

```json
{
  "@jupyterlab/apputils-extension:themes": {
    "theme": "JupyterLab Dark"
  },
  "@jupyterlab/notebook-extension:tracker": {
    "defaultCell": "code",
    "autoStartDefaultKernel": true
  }
}
```

This file is applied at JupyterLite startup before user settings in IndexedDB. It can be used to
enforce default kernel behavior without requiring the user to configure anything.

> **Deep dive**: https://jupyterlite.readthedocs.io/en/stable/howto/configure/settings.html

---

## Kernel lifecycle and the wiki session

Each time the iframe reloads (e.g. when navigating between notebooks), the kernel is restarted and all
in-memory state is lost. This is expected behavior for JupyterLite.

To persist variables across sessions, notebooks should write output to Drive files (using the postMessage
bridge described in [`jupyterlite-gdrive-provider.md`](jupyterlite-gdrive-provider.md)) or use
`pyodide.to_js()` and `localStorage` for small values.

---

## References

| Resource | URL |
|----------|-----|
| JupyterLite kernels overview | https://jupyterlite.readthedocs.io/en/stable/howto/configure/kernels.html |
| Pyodide docs | https://pyodide.org/en/stable/ |
| xeus-python | https://github.com/jupyter-xeus/xeus-python |
| xeus-lite (WebAssembly xeus kernels) | https://github.com/jupyter-xeus/xeus-lite |
| JupyterLite TypeScript kernel | https://github.com/jupyterlite/jupyterlite-typescript-kernel |
| WebR (R in browser) | https://webr.r-wasm.org/ |
| jupyterlite-webr-kernel | https://github.com/georgestagg/jupyterlite-webr-kernel |
| piplite (package installer) | https://jupyterlite.readthedocs.io/en/stable/howto/configure/piplite.html |
| Pyodide packages | https://pyodide.org/en/stable/usage/packages-in-pyodide.html |
| micropip | https://micropip.pyodide.org/en/stable/ |
| JupyterLite settings override | https://jupyterlite.readthedocs.io/en/stable/howto/configure/settings.html |
| kernelspecs format | https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs |
| jupyterlite-core build CLI | https://jupyterlite.readthedocs.io/en/stable/reference/cli.html |
