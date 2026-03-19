import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import ExcalidrawWrapper from './ExcalidrawWrapper';
// @ts-ignore
import excalidrawStyles from '@excalidraw/excalidraw/index.css?inline';

class ExcalidrawWebComponent extends HTMLElement {
  private root: Root | null = null;
  private wrapperRef = React.createRef<any>();

  constructor() {
    super();
    // Use Light DOM for maximum compatibility with Excalidraw's portal-based menus and SVG icons
  }

  static get observedAttributes() {
    return ['initial-data'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'initial-data' && oldValue !== newValue) {
      this.render();
    }
  }

  connectedCallback() {
    this.injectGlobalStyles();
    this.render();
  }

  private injectGlobalStyles() {
    const id = 'excalidraw-global-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        excalidraw-component {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }
        ${excalidrawStyles}
      `;
      document.head.appendChild(style);
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  // Exposed methods
  public save() {
    return this.wrapperRef.current?.save();
  }

  public load(json: string) {
    this.wrapperRef.current?.load(json);
  }

  public async exportPng(opts?: any) {
    return this.wrapperRef.current?.exportPng(opts);
  }

  public zoomToFit() {
    this.wrapperRef.current?.zoomToFit();
  }

  public clear() {
    this.wrapperRef.current?.clear();
  }

  public getRawAPI() {
    return this.wrapperRef.current?.getRawAPI();
  }

  private render() {
    const initialData = this.getAttribute('initial-data') || undefined;

    if (!this.root) {
      this.root = createRoot(this);
    }

    this.root.render(
      <div className="excalidraw-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ExcalidrawWrapper
          ref={this.wrapperRef}
          initialData={initialData}
          onChange={(elements, appState, files) => {
            this.dispatchEvent(new CustomEvent('change', {
              detail: { elements, appState, files },
              bubbles: true,
              composed: true
            }));
          }}
        />
      </div>
    );
  }
}

if (!customElements.get('excalidraw-component')) {
  customElements.define('excalidraw-component', ExcalidrawWebComponent);
}
