import type { FileType } from "../types/editor";

export interface ToolbarCallbacks {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function createToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): {
  setFilename: (name: string | null) => void;
  setUnsaved: (unsaved: boolean) => void;
  setFileType: (type: FileType) => void;
} {
  const openBtn = document.createElement("button");
  openBtn.innerHTML = '<span class="btn-icon">📂</span> open';
  openBtn.title = "open file (⌘O)";
  openBtn.addEventListener("click", callbacks.onOpen);

  const saveBtn = document.createElement("button");
  saveBtn.innerHTML = '<span class="btn-icon">💾</span> save';
  saveBtn.title = "save file (⌘S)";
  saveBtn.addEventListener("click", callbacks.onSave);

  const saveAsBtn = document.createElement("button");
  saveAsBtn.innerHTML = '<span class="btn-icon">📄</span> save as';
  saveAsBtn.title = "save as (⌘⇧S)";
  saveAsBtn.addEventListener("click", callbacks.onSaveAs);

  // Separator
  const separator = document.createElement("span");
  separator.className = "toolbar-separator";

  const undoBtn = document.createElement("button");
  undoBtn.innerHTML = '<span class="btn-icon">↩</span> undo';
  undoBtn.title = "undo (⌘Z)";
  undoBtn.addEventListener("mousedown", (e) => e.preventDefault()); // Prevent focus steal
  undoBtn.addEventListener("click", callbacks.onUndo);

  const redoBtn = document.createElement("button");
  redoBtn.innerHTML = '<span class="btn-icon">↪</span> redo';
  redoBtn.title = "redo (⌘⇧Z)";
  redoBtn.addEventListener("mousedown", (e) => e.preventDefault()); // Prevent focus steal
  redoBtn.addEventListener("click", callbacks.onRedo);

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
      // File type is shown in sidebar tabs, no longer needed in toolbar
    },
  };
}
