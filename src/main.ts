// Polyfill Buffer for gray-matter (runs in browser context)
import { Buffer } from "buffer";
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createToolbar } from "./editor/toolbar";
import { injectEditable, injectStyles, EDITOR_ATTR } from "./editor/inject";
import { extractCleanHtml, extractDoctype, revertAssetUrls } from "./editor/extract";
import {
  parseMarkdown,
  serializeToMarkdown,
  extractFrontmatter,
  stringifyWithFrontmatter,
  applyMarkdownFormat,
  getMarkdownStyles,
} from "./editor/markdown";
import type { FileType, FrontmatterData } from "./types/editor";

interface EditorState {
  currentPath: string | null;
  originalDoctype: string;
  isDirty: boolean;
  contentFrame: HTMLIFrameElement | null;
  fileType: FileType;
  originalMarkdown: string | null;
  frontmatter: FrontmatterData | null;
}

const state: EditorState = {
  currentPath: null,
  originalDoctype: "<!DOCTYPE html>",
  isDirty: false,
  contentFrame: null,
  fileType: 'html',
  originalMarkdown: null,
  frontmatter: null,
};

function detectFileType(path: string): FileType {
  const ext = path.split('.').pop()?.toLowerCase();
  return (ext === 'md' || ext === 'markdown') ? 'markdown' : 'html';
}

// Convert image src attributes in HTML to use Tauri asset protocol
function convertHtmlImageSrcs(html: string, dirPath: string): string {
  // Match img tags and rewrite src attributes for relative paths
  return html.replace(
    /<img\s+([^>]*?)src\s*=\s*(["'])([^"']+)\2([^>]*)>/gi,
    (match, before, quote, src, after) => {
      // Skip data URLs, http(s) URLs, and already-converted asset URLs
      if (src.startsWith('data:') || src.startsWith('http://') ||
          src.startsWith('https://') || src.startsWith('asset:')) {
        return match;
      }

      // Convert relative path to absolute, then to asset URL
      let absolutePath: string;
      if (src.startsWith('/')) {
        // Absolute path on filesystem
        absolutePath = src;
      } else if (src.startsWith('file://')) {
        // file:// URL - extract path
        absolutePath = src.replace('file://', '');
      } else {
        // Relative path - resolve against dirPath
        absolutePath = `${dirPath}/${src}`;
      }

      const assetUrl = convertFileSrc(absolutePath);
      return `<img ${before}src=${quote}${assetUrl}${quote}${after}>`;
    }
  );
}

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
      if (state.fileType === 'markdown') {
        applyMarkdownFormat(iframeDoc, 'bold');
      } else {
        iframeDoc.execCommand("bold", false);
      }
      markDirty();
    } else if (key === "i" && !e.shiftKey) {
      e.preventDefault();
      if (state.fileType === 'markdown') {
        applyMarkdownFormat(iframeDoc, 'italic');
      } else {
        iframeDoc.execCommand("italic", false);
      }
      markDirty();
    } else if (key === "u") {
      e.preventDefault();
      // Underline not typically used in markdown, use code format instead
      if (state.fileType === 'markdown') {
        applyMarkdownFormat(iframeDoc, 'code');
      } else {
        iframeDoc.execCommand("underline", false);
      }
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
    filters: [
      { name: "All Supported", extensions: ["html", "htm", "md", "markdown"] },
      { name: "HTML Files", extensions: ["html", "htm"] },
      { name: "Markdown Files", extensions: ["md", "markdown"] },
    ],
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

  // Show appropriate filters based on source file type
  const filters = state.fileType === 'markdown'
    ? [
        { name: "Markdown Files", extensions: ["md", "markdown"] },
        { name: "HTML Files", extensions: ["html", "htm"] },
      ]
    : [
        { name: "HTML Files", extensions: ["html", "htm"] },
        { name: "Markdown Files", extensions: ["md", "markdown"] },
      ];

  const selected = await save({
    filters,
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

    // Detect file type
    const fileType = detectFileType(path);
    state.currentPath = path;
    state.fileType = fileType;
    state.isDirty = false;

    // Reset markdown-specific state
    state.originalMarkdown = null;
    state.frontmatter = null;

    let htmlContent: string;

    if (fileType === 'markdown') {
      // Store original markdown for round-trip
      state.originalMarkdown = content;

      // Extract frontmatter
      const parsed = extractFrontmatter(content);
      state.frontmatter = parsed.frontmatter;

      // Parse markdown to HTML with Tauri asset protocol for images
      const bodyHtml = parseMarkdown(parsed.content, (relativePath) => {
        const absolutePath = `${dirPath}/${relativePath}`;
        return convertFileSrc(absolutePath);
      });

      // Wrap in HTML document with markdown styles
      // Include base tag for relative paths (must be in HTML before parsing for images to work)
      htmlContent = `<!DOCTYPE html>
<html>
<head>
  <base href="file://${dirPath}/" ${EDITOR_ATTR}="base">
  <meta charset="utf-8">
  <style>${getMarkdownStyles()}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
      state.originalDoctype = "<!DOCTYPE html>";
    } else {
      // HTML file - convert image paths to asset URLs
      htmlContent = convertHtmlImageSrcs(content, dirPath);
      state.originalDoctype = extractDoctype(content);
    }

    // Update toolbar (handle both Unix and Windows paths)
    const filename = path.split(/[/\\]/).pop() || path;
    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);
    toolbar.setFileType(fileType);

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
    doc.write(htmlContent);
    doc.close();

    // Inject base tag for relative paths (only for HTML files - markdown already has it inline)
    if (fileType === 'html') {
      const base = doc.createElement("base");
      base.href = `file://${dirPath}/`;
      base.setAttribute(EDITOR_ATTR, "base");
      doc.head.insertBefore(base, doc.head.firstChild);
    }

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
    const targetType = detectFileType(path);
    let content: string;

    if (targetType === 'markdown') {
      // Serialize HTML back to markdown
      const markdownContent = serializeToMarkdown(state.contentFrame.contentDocument);
      // Prepend frontmatter if we had it originally
      content = stringifyWithFrontmatter(markdownContent, state.frontmatter);
    } else {
      // Export as HTML
      const doctype = state.fileType === 'markdown' ? "<!DOCTYPE html>" : state.originalDoctype;
      let html = extractCleanHtml(state.contentFrame.contentDocument, doctype);

      // Revert asset URLs back to relative paths
      const dirPath: string = await invoke("get_file_dir", { path });
      content = revertAssetUrls(html, dirPath);
    }

    await invoke("write_file", { path, content });

    // Update state to reflect new file type if changed
    state.currentPath = path;
    state.fileType = targetType;
    state.isDirty = false;

    // If we saved as markdown, update the original markdown
    if (targetType === 'markdown') {
      state.originalMarkdown = content;
    } else {
      state.originalMarkdown = null;
      state.frontmatter = null;
    }

    const filename = path.split(/[/\\]/).pop() || path;
    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);
    toolbar.setFileType(targetType);

    showToast("Saved!");

  } catch (err) {
    console.error("Failed to save file:", err);
    alert(`Failed to save file: ${err}`);
  }
}
