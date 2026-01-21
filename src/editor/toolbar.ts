import type { FileType } from "../types/editor";

export interface ToolbarCallbacks {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export function createToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): {
  setFilename: (name: string | null) => void;
  setUnsaved: (unsaved: boolean) => void;
  setFileType: (type: FileType) => void;
} {
  const openBtn = document.createElement("button");
  openBtn.textContent = "open";
  openBtn.title = "open file (⌘O)";
  openBtn.addEventListener("click", callbacks.onOpen);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "save";
  saveBtn.title = "save file (⌘S)";
  saveBtn.addEventListener("click", callbacks.onSave);

  const saveAsBtn = document.createElement("button");
  saveAsBtn.textContent = "save as";
  saveAsBtn.title = "save as (⌘⇧S)";
  saveAsBtn.addEventListener("click", callbacks.onSaveAs);

  const fileTypeBadge = document.createElement("span");
  fileTypeBadge.className = "file-type-badge";

  const filenameEl = document.createElement("span");
  filenameEl.className = "filename";

  container.appendChild(openBtn);
  container.appendChild(saveBtn);
  container.appendChild(saveAsBtn);
  container.appendChild(fileTypeBadge);
  container.appendChild(filenameEl);

  return {
    setFilename(name: string | null) {
      filenameEl.textContent = name || "";
    },
    setUnsaved(unsaved: boolean) {
      filenameEl.classList.toggle("unsaved", unsaved);
    },
    setFileType(type: FileType) {
      fileTypeBadge.textContent = type === 'markdown' ? 'MD' : 'HTML';
      fileTypeBadge.className = `file-type-badge ${type}`;
    },
  };
}
