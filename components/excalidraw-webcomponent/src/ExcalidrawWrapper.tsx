import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { Excalidraw, exportToBlob, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';

export interface ExcalidrawWrapperProps {
  initialData?: string; // JSON string
  onChange?: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
}

const ExcalidrawWrapper = forwardRef<ExcalidrawImperativeAPI | any, ExcalidrawWrapperProps>((props, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const pendingLoad = useRef<string | null>(null);

  // When the API becomes available, apply any load() call that arrived before it was ready
  useEffect(() => {
    if (excalidrawAPI && pendingLoad.current !== null) {
      const json = pendingLoad.current;
      pendingLoad.current = null;
      try {
        const data = JSON.parse(json);
        excalidrawAPI.updateScene({
          elements: data.elements || [],
          appState: { ...data.appState, scrollToContent: true },
          files: data.files || {},
        });
      } catch (e) {
        console.error("Failed to load pending Excalidraw data", e);
      }
    }
  }, [excalidrawAPI]);

  useImperativeHandle(ref, () => ({
    getRawAPI: () => excalidrawAPI,

    save: () => {
      if (!excalidrawAPI) return null;
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      return serializeAsJSON(elements, appState, files, "local");
    },

    load: (json: string) => {
      if (!excalidrawAPI) {
        // API not ready yet — queue for when it becomes available
        pendingLoad.current = json;
        return;
      }
      try {
        const data = JSON.parse(json);
        excalidrawAPI.updateScene({
          elements: data.elements || [],
          appState: { ...data.appState, scrollToContent: true },
          files: data.files || {},
        });
      } catch (e) {
        console.error("Failed to load Excalidraw data", e);
      }
    },

    exportPng: async (opts?: any) => {
      if (!excalidrawAPI) return null;
      const elements = excalidrawAPI.getSceneElements();
      if (!elements.length) return null;
      const blob = await exportToBlob({
        elements,
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
        ...opts
      });
      return blob;
    },

    zoomToFit: () => {
      if (!excalidrawAPI) return;
      excalidrawAPI.scrollToContent();
    },

    clear: () => {
      if (!excalidrawAPI) return;
      excalidrawAPI.updateScene({ elements: [] });
    }
  }), [excalidrawAPI]);

  return (
    <div className="excalidraw-container" style={{ height: '100%', width: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={props.initialData ? JSON.parse(props.initialData) : undefined}
        onChange={props.onChange}
      />
    </div>
  );
});

export default ExcalidrawWrapper;
