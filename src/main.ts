// Polyfill Buffer for gray-matter (runs in browser context)
import { Buffer } from "buffer";
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createToolbar } from "./editor/toolbar";
import { injectEditableRegions, injectStyles, EDITOR_ATTR } from "./editor/inject";
import {
  parseEditableRegions,
  extractDoctype,
  surgicalReplace,
  syncRegionsFromDom,
  type EditableRegion,
} from "./editor/html-parser";
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
  // Surgical editing state for HTML files
  originalHtml: string | null;      // Verbatim file content (never modified)
  regions: EditableRegion[];        // Editable regions with byte offsets
  scriptMap: Map<string, string>;   // Stores complete script tags for restoration
}

const state: EditorState = {
  currentPath: null,
  originalDoctype: "<!DOCTYPE html>",
  isDirty: false,
  contentFrame: null,
  fileType: 'html',
  originalMarkdown: null,
  frontmatter: null,
  originalHtml: null,
  regions: [],
  scriptMap: new Map(),
};

function detectFileType(path: string): FileType {
  const ext = path.split('.').pop()?.toLowerCase();
  return (ext === 'md' || ext === 'markdown') ? 'markdown' : 'html';
}

// Transform images in the live DOM to use Tauri asset protocol for display
function transformImagesForDisplay(doc: Document, dirPath: string): void {
  const images = doc.querySelectorAll('img');

  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:') || src.startsWith('http://') ||
        src.startsWith('https://') || src.startsWith('asset:')) {
      return;
    }

    // Convert to asset URL for display
    let absolutePath: string;
    if (src.startsWith('/')) {
      absolutePath = src;
    } else if (src.startsWith('file://')) {
      absolutePath = src.replace('file://', '');
    } else {
      absolutePath = `${dirPath}/${src}`;
    }
    img.setAttribute('src', convertFileSrc(absolutePath));
  });
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

    // Reset state for new file
    state.originalMarkdown = null;
    state.frontmatter = null;
    state.originalHtml = null;
    state.regions = [];
    state.scriptMap.clear();

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
      // HTML file - store original and parse editable regions
      state.originalHtml = content;
      state.originalDoctype = extractDoctype(content);
      state.regions = parseEditableRegions(content);
      htmlContent = content;
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
    // Sandbox blocks scripts; allow-same-origin lets us access contentDocument
    iframe.setAttribute("sandbox", "allow-same-origin");
    // Disable autocomplete/autofill features that might add UI elements
    iframe.setAttribute("autocomplete", "off");

    // Strip scripts and store for restoration (Tauri webview ignores sandbox)
    let scriptId = 0;
    let safeHtml = htmlContent.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      (match) => {
        const id = `hone-script-${scriptId++}`;
        state.scriptMap.set(id, match);
        return `<!--${id}-->`;
      }
    );

    // Inject CSP to block ALL JavaScript (including inline handlers like onload, onerror)
    const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none';" data-hone-csp>`;
    if (safeHtml.includes('<head>')) {
      safeHtml = safeHtml.replace('<head>', `<head>${csp}`);
    } else if (safeHtml.includes('<head ')) {
      safeHtml = safeHtml.replace(/<head\s[^>]*>/, `$&${csp}`);
    } else if (safeHtml.includes('<html>')) {
      safeHtml = safeHtml.replace('<html>', `<html><head>${csp}</head>`);
    } else if (safeHtml.includes('<html ')) {
      safeHtml = safeHtml.replace(/<html\s[^>]*>/, `$&<head>${csp}</head>`);
    }

    // Use srcdoc instead of doc.write() - this properly respects sandbox
    iframe.srcdoc = safeHtml;
    container.appendChild(iframe);
    state.contentFrame = iframe;

    // Wait for srcdoc content to load
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const doc = iframe.contentDocument!;

    // Inject base tag for relative paths (only for HTML files - markdown already has it inline)
    if (fileType === 'html') {
      const base = doc.createElement("base");
      base.href = `file://${dirPath}/`;
      base.setAttribute(EDITOR_ATTR, "base");
      doc.head.insertBefore(base, doc.head.firstChild);

      // Transform images to use Tauri asset protocol for display
      transformImagesForDisplay(doc, dirPath);
    }

    // Inject editing capabilities
    injectStyles(doc);

    if (fileType === 'html' && state.regions.length > 0) {
      // Use region-based editing for HTML files
      injectEditableRegions(doc, state.regions);
    } else {
      // For markdown, use selector-based approach (legacy)
      injectEditableForMarkdown(doc);
    }

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

/**
 * Legacy selector-based editable injection for markdown files
 */
function injectEditableForMarkdown(doc: Document): void {
  const EDITABLE_SELECTORS = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "td", "th", "blockquote", "figcaption",
    "dt", "dd", "label", "legend", "summary",
  ].join(", ");

  const EDITOR_CLASS = "html-editor-editable";

  const elements = doc.querySelectorAll(EDITABLE_SELECTORS);

  elements.forEach((el) => {
    // Skip if element has no direct text content or only whitespace
    const hasDirectText = Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );

    // Also include elements that have only inline children (like <strong>, <em>)
    const hasInlineContent = el.children.length > 0 &&
      Array.from(el.children).every((child) => {
        const display = window.getComputedStyle(child).display;
        return display === "inline" || display === "inline-block";
      });

    if (hasDirectText || hasInlineContent || el.children.length === 0) {
      el.setAttribute("contenteditable", "true");
      el.classList.add(EDITOR_CLASS);
      el.setAttribute(EDITOR_ATTR, "true");
    }
  });
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
    } else if (state.fileType === 'html' && state.originalHtml && state.regions.length > 0) {
      // HTML file with surgical editing - sync from DOM and replace only changed regions
      syncRegionsFromDom(state.contentFrame.contentDocument as unknown as Document, state.regions);
      content = surgicalReplace(state.originalHtml, state.regions);

      // Restore scripts that were stripped for safe editing
      state.scriptMap.forEach((script, id) => {
        content = content.replace(`<!--${id}-->`, script);
      });
    } else {
      // Fallback: full serialization for markdown-to-HTML export or edge cases
      content = state.originalDoctype + "\n" + state.contentFrame.contentDocument.documentElement.outerHTML;
    }

    await invoke("write_file", { path, content });

    // Update state to reflect new file type if changed
    state.currentPath = path;
    state.fileType = targetType;
    state.isDirty = false;

    // If we saved as markdown, update the original markdown
    if (targetType === 'markdown') {
      state.originalMarkdown = content;
      state.originalHtml = null;
      state.regions = [];
    } else if (state.fileType === 'html') {
      // Update originalHtml and re-parse regions for subsequent edits
      state.originalHtml = content;
      state.regions = parseEditableRegions(content);
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
