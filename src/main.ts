import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createToolbar } from "./editor/toolbar";
import { injectEditable, injectStyles, EDITOR_ATTR } from "./editor/inject";
import { extractCleanHtml, extractDoctype } from "./editor/extract";

interface EditorState {
  currentPath: string | null;
  originalDoctype: string;
  isDirty: boolean;
  contentFrame: HTMLIFrameElement | null;
}

const state: EditorState = {
  currentPath: null,
  originalDoctype: "<!DOCTYPE html>",
  isDirty: false,
  contentFrame: null,
};

// Toast notification
const toast = document.getElementById("toast")!;
let toastTimeout: number | null = null;

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("show");
    toastTimeout = null;
  }, 2000);
}

// Initialize toolbar
const toolbarContainer = document.getElementById("toolbar")!;
const toolbar = createToolbar(toolbarContainer, {
  onOpen: handleOpen,
  onSave: handleSave,
  onSaveAs: handleSaveAs,
});

// Mark document as dirty
function markDirty(): void {
  if (!state.isDirty) {
    state.isDirty = true;
    toolbar.setUnsaved(true);
  }
}

// Keyboard shortcut handler
function handleKeyboardShortcut(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;

  const key = e.key.toLowerCase();

  // File operations - always handle these
  if (key === "o") {
    e.preventDefault();
    e.stopPropagation();
    handleOpen();
    return;
  }

  if (e.shiftKey && key === "s") {
    e.preventDefault();
    e.stopPropagation();
    handleSaveAs();
    return;
  }

  if (key === "s") {
    e.preventDefault();
    e.stopPropagation();
    handleSave();
    return;
  }

  // Text formatting - only when we have an iframe with content
  if (state.contentFrame?.contentDocument) {
    const iframeDoc = state.contentFrame.contentDocument;

    if (key === "b") {
      e.preventDefault();
      iframeDoc.execCommand("bold", false);
      markDirty();
    } else if (key === "i" && !e.shiftKey) {
      e.preventDefault();
      iframeDoc.execCommand("italic", false);
      markDirty();
    } else if (key === "u") {
      e.preventDefault();
      iframeDoc.execCommand("underline", false);
      markDirty();
    } else if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      iframeDoc.execCommand("undo", false);
    } else if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      iframeDoc.execCommand("redo", false);
    }
  }
}

// Keyboard shortcuts - listen on window to catch all events
window.addEventListener("keydown", handleKeyboardShortcut, true);
document.addEventListener("keydown", handleKeyboardShortcut, true);

// Listen for menu events from Tauri
listen("menu-open", () => handleOpen());
listen("menu-save", () => handleSave());
listen("menu-save-as", () => handleSaveAs());

// Unsaved changes warning
window.addEventListener("beforeunload", (e) => {
  if (state.isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

async function handleOpen(): Promise<void> {
  // Warn about unsaved changes
  if (state.isDirty) {
    const shouldContinue = confirm("You have unsaved changes. Continue without saving?");
    if (!shouldContinue) return;
  }

  const selected = await open({
    multiple: false,
    filters: [{ name: "HTML Files", extensions: ["html", "htm"] }],
  });

  if (selected) {
    await loadFile(selected);
  }
}

async function handleSave(): Promise<void> {
  if (!state.currentPath) {
    await handleSaveAs();
    return;
  }

  await saveToPath(state.currentPath);
}

async function handleSaveAs(): Promise<void> {
  if (!state.contentFrame?.contentDocument) return;

  const selected = await save({
    filters: [{ name: "HTML Files", extensions: ["html", "htm"] }],
    defaultPath: state.currentPath || undefined,
  });

  if (selected) {
    await saveToPath(selected);
  }
}

async function loadFile(path: string): Promise<void> {
  try {
    const content: string = await invoke("read_file", { path });
    const dirPath: string = await invoke("get_file_dir", { path });

    state.currentPath = path;
    state.originalDoctype = extractDoctype(content);
    state.isDirty = false;

    // Update toolbar (handle both Unix and Windows paths)
    const filename = path.split(/[/\\]/).pop() || path;
    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);

    // Create or get iframe
    const container = document.getElementById("editor-container")!;
    container.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.id = "content-frame";
    iframe.sandbox.add("allow-same-origin");
    // Disable autocomplete/autofill features that might add UI elements
    iframe.setAttribute("autocomplete", "off");
    container.appendChild(iframe);
    state.contentFrame = iframe;

    // Wait for iframe to be ready
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.src = "about:blank";
    });

    const doc = iframe.contentDocument!;

    // Write the HTML content
    doc.open();
    doc.write(content);
    doc.close();

    // Inject base tag for relative paths
    const base = doc.createElement("base");
    base.href = `file://${dirPath}/`;
    base.setAttribute(EDITOR_ATTR, "base");
    doc.head.insertBefore(base, doc.head.firstChild);

    // Inject editing capabilities
    injectStyles(doc);
    injectEditable(doc);

    // Track changes
    doc.addEventListener("input", markDirty);

    // Keyboard shortcuts in iframe (capture phase on both document and window)
    doc.addEventListener("keydown", handleKeyboardShortcut, true);
    if (iframe.contentWindow) {
      iframe.contentWindow.addEventListener("keydown", handleKeyboardShortcut, true);
    }

  } catch (err) {
    console.error("Failed to load file:", err);
    alert(`Failed to load file: ${err}`);
  }
}

async function saveToPath(path: string): Promise<void> {
  if (!state.contentFrame?.contentDocument) return;

  try {
    const cleanHtml = extractCleanHtml(state.contentFrame.contentDocument, state.originalDoctype);
    await invoke("write_file", { path, content: cleanHtml });

    state.currentPath = path;
    state.isDirty = false;

    const filename = path.split(/[/\\]/).pop() || path;
    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);

    showToast("Saved!");

  } catch (err) {
    console.error("Failed to save file:", err);
    alert(`Failed to save file: ${err}`);
  }
}
