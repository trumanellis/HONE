import type { FileType } from "../types/editor";

export interface ToolbarCallbacks {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const ICONS = {
  open: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 6.5V15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5a1 1 0 0 0-1-1H10L8.5 5.5H4a1 1 0 0 0-1 1z"/></svg>`,
  save: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M4 3h10l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M6 3v5h7V3M7 13h6"/></svg>`,
  saveAs: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 3v4h4"/></svg>`,
  undo: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M7 10H4V7"/><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 6 6 6 6 0 0 1-6 6"/></svg>`,
  redo: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M13 10h3V7"/><path d="M16 10a6 6 0 0 0-6-6 6 6 0 0 0-6 6 6 6 0 0 0 6 6"/></svg>`,
};

function makeButton(
  icon: string,
  label: string,
  title: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "tb-btn";
  btn.title = title;
  btn.innerHTML = `<span class="tb-icon">${icon}</span><span class="tb-label">${label}</span>`;
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", onClick);
  return btn;
}

export function createToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): {
  setFilename: (name: string | null) => void;
  setUnsaved: (unsaved: boolean) => void;
  setFileType: (type: FileType) => void;
} {
  const openBtn = makeButton(ICONS.open, "open", "open file (⌘O)", callbacks.onOpen);
  const saveBtn = makeButton(ICONS.save, "save", "save file (⌘S)", callbacks.onSave);
  const saveAsBtn = makeButton(ICONS.saveAs, "save as", "save as (⌘⇧S)", callbacks.onSaveAs);

  const separator = document.createElement("span");
  separator.className = "toolbar-separator";

  const undoBtn = makeButton(ICONS.undo, "undo", "undo (⌘Z)", callbacks.onUndo);
  const redoBtn = makeButton(ICONS.redo, "redo", "redo (⌘⇧Z)", callbacks.onRedo);

  const filenameEl = document.createElement("span");
  filenameEl.className = "filename";

  container.appendChild(openBtn);
  container.appendChild(saveBtn);
  container.appendChild(saveAsBtn);
  container.appendChild(separator);
  container.appendChild(undoBtn);
  container.appendChild(redoBtn);
  container.appendChild(filenameEl);

  return {
    setFilename(name: string | null) {
      filenameEl.textContent = name || "";
    },
    setUnsaved(unsaved: boolean) {
      filenameEl.classList.toggle("unsaved", unsaved);
    },
    setFileType(_type: FileType) {
      // File type is shown in sidebar tabs.
    },
  };
}
