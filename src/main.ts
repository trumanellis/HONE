// Polyfill Buffer for gray-matter (runs in browser context)
import { Buffer } from "buffer";
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { createToolbar } from "./editor/toolbar";
import { createFindReplaceBar, FindReplaceBar } from "./editor/find-replace";
import { TabBar, TabState } from "./editor/tabs";
import { ContextMenu, showPromptDialog } from "./editor/context-menu";
import {
  deleteElement,
  editLink,
  insertLink,
  removeLink,
  replaceImage,
  removeImage,
  convertBlock,
} from "./editor/element-operations";
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
  getMarkdownStyles,
} from "./editor/markdown";
import type { FileType, FrontmatterData } from "./types/editor";

// Recent files interface matching Rust struct
interface RecentFile {
  path: string;
  name: string;
  accessed_at: number;
}

// Session state interface matching Rust struct
interface SessionData {
  open_files: string[];
  active_file: string | null;
}

// Initialize tab bar
const tabBarContainer = document.getElementById("tab-bar-container")!;
let tabBar: TabBar;
let contextMenu: ContextMenu;

// Helper to get active tab state
function getActiveTab(): TabState | null {
  const activeId = tabBar.getActiveTabId();
  return activeId ? tabBar.getTab(activeId) : null;
}

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

// Undo/Redo handlers
function handleUndo(): void {
  const tab = getActiveTab();
  if (tab?.contentFrame?.contentDocument) {
    // Focus iframe to ensure execCommand works
    tab.contentFrame.contentWindow?.focus();
    tab.contentFrame.contentDocument.execCommand("undo", false);
  }
}

function handleRedo(): void {
  const tab = getActiveTab();
  if (tab?.contentFrame?.contentDocument) {
    // Focus iframe to ensure execCommand works
    tab.contentFrame.contentWindow?.focus();
    tab.contentFrame.contentDocument.execCommand("redo", false);
  }
}

// Initialize toolbar
const toolbarContainer = document.getElementById("toolbar")!;
const toolbar = createToolbar(toolbarContainer, {
  onOpen: handleOpen,
  onSave: handleSave,
  onSaveAs: handleSaveAs,
  onUndo: handleUndo,
  onRedo: handleRedo,
});

// Initialize Find & Replace bar
let findReplaceBar: FindReplaceBar | null = null;

function initializeFindReplaceBar(): void {
  const container = document.getElementById("editor-container")!;

  // Clean up existing instance if any
  if (findReplaceBar) {
    findReplaceBar.destroy();
  }

  // Create new find/replace bar
  findReplaceBar = createFindReplaceBar(container);

  // Wire up to current iframe
  const tab = getActiveTab();
  if (tab?.contentFrame) {
    findReplaceBar.setIframe(tab.contentFrame);
  }
}

function openFindBar(mode: 'find' | 'replace'): void {
  const tab = getActiveTab();
  if (!tab?.contentFrame) return;

  if (!findReplaceBar) {
    initializeFindReplaceBar();
  }

  findReplaceBar!.setIframe(tab.contentFrame);
  findReplaceBar!.open(mode);
}

// Mark document as dirty
function markDirty(): void {
  const tab = getActiveTab();
  if (tab && !tab.isDirty) {
    tabBar.updateTab(tab.id, { isDirty: true });
    toolbar.setUnsaved(true);
  }
}

// Keyboard shortcut handler
function handleKeyboardShortcut(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey;

  // Escape key handling (no modifier needed)
  if (e.key === "Escape") {
    if (findReplaceBar?.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      findReplaceBar.close();
      return;
    }
  }

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

  // Find & Replace operations
  if (key === "f" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    openFindBar('find');
    return;
  }

  if (key === "h" || (key === "f" && e.shiftKey)) {
    e.preventDefault();
    e.stopPropagation();
    openFindBar('replace');
    return;
  }

  // Close tab with Cmd+W
  if (key === "w") {
    e.preventDefault();
    e.stopPropagation();
    const activeId = tabBar.getActiveTabId();
    if (activeId) {
      closeTab(activeId);
    }
    return;
  }

  // Text formatting - only when we have an iframe with content
  const tab = getActiveTab();
  if (tab?.contentFrame?.contentDocument) {
    const iframeDoc = tab.contentFrame.contentDocument;

    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      iframeDoc.execCommand("undo", false);
      return;
    }

    if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      e.stopPropagation();
      iframeDoc.execCommand("redo", false);
      return;
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
  // Check if any tab has unsaved changes
  const hasUnsavedChanges = tabBar.getAllTabs().some(tab => tab.isDirty);
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
});

async function handleOpen(): Promise<void> {
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
  const tab = getActiveTab();
  if (!tab?.currentPath) {
    await handleSaveAs();
    return;
  }

  await saveToPath(tab.currentPath);
}

async function handleSaveAs(): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.contentFrame?.contentDocument) return;

  // Show appropriate filters based on source file type
  const filters = tab.fileType === 'markdown'
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
    defaultPath: tab.currentPath || undefined,
  });

  if (selected) {
    await saveToPath(selected);
  }
}

async function loadFile(path: string): Promise<void> {
  try {
    // Check if file is already open in a tab
    const existingTabId = tabBar.findTabByPath(path);
    if (existingTabId) {
      switchToTab(existingTabId);
      return;
    }

    // Check max tabs
    if (tabBar.hasMaxTabs()) {
      showToast("Maximum 10 tabs open");
      return;
    }

    const content: string = await invoke("read_file", { path });
    const dirPath: string = await invoke("get_file_dir", { path });

    // Detect file type
    const fileType = detectFileType(path);
    const filename = path.split(/[/\\]/).pop() || path;

    // Create tab state
    const tabState = {
      currentPath: path,
      filename,
      isDirty: false,
      fileType,
      contentFrame: null as HTMLIFrameElement | null,
      originalDoctype: "<!DOCTYPE html>",
      originalMarkdown: null as string | null,
      frontmatter: null as FrontmatterData | null,
      originalHtml: null as string | null,
      regions: [] as EditableRegion[],
      scriptMap: new Map<string, string>(),
    };

    let htmlContent: string;

    if (fileType === 'markdown') {
      // Store original markdown for round-trip
      tabState.originalMarkdown = content;

      // Extract frontmatter
      const parsed = extractFrontmatter(content);
      tabState.frontmatter = parsed.frontmatter;

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
      tabState.originalDoctype = "<!DOCTYPE html>";
    } else {
      // HTML file - store original and parse editable regions
      tabState.originalHtml = content;
      tabState.originalDoctype = extractDoctype(content);
      tabState.regions = parseEditableRegions(content);
      htmlContent = content;
    }

    // Hide all existing iframes
    const container = document.getElementById("editor-container")!;
    const existingIframes = container.querySelectorAll("iframe");
    existingIframes.forEach(iframe => {
      iframe.style.display = "none";
    });

    const iframe = document.createElement("iframe");
    iframe.className = "content-frame";
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
        tabState.scriptMap.set(id, match);
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
    tabState.contentFrame = iframe;

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
    }

    // Transform images to use Tauri asset protocol for display
    // This handles both HTML files and raw HTML <img> tags in markdown
    transformImagesForDisplay(doc, dirPath);

    // Inject editing capabilities
    injectStyles(doc);

    if (fileType === 'html' && tabState.regions.length > 0) {
      // Use region-based editing for HTML files
      injectEditableRegions(doc, tabState.regions);
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

    // Attach context menu for element operations
    contextMenu.attach(doc);

    // Attach paste handler for rich content
    attachPasteHandler(doc);

    // Create tab and switch to it
    const tabId = tabBar.createTab(tabState);
    if (tabId) {
      tabBar.setActiveTab(tabId);

      // Update toolbar
      toolbar.setFilename(filename);
      toolbar.setUnsaved(false);
      toolbar.setFileType(fileType);

      // Add to recent files
      await addToRecentFiles(path);

      // Hide welcome screen and show sidebar
      const welcome = document.getElementById("welcome");
      if (welcome) {
        welcome.style.display = "none";
      }
      const sidebar = document.getElementById("tab-bar-container");
      if (sidebar) {
        sidebar.style.display = "flex";
      }

      // Initialize find/replace bar for this document
      initializeFindReplaceBar();

      // Save session state
      await saveSession();
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

// Switch to a different tab
function switchToTab(tabId: string): void {
  const tab = tabBar.getTab(tabId);
  if (!tab) return;

  // Hide all iframes
  const container = document.getElementById("editor-container")!;
  const iframes = container.querySelectorAll("iframe");
  iframes.forEach(iframe => {
    iframe.style.display = "none";
  });

  // Show the selected tab's iframe
  if (tab.contentFrame) {
    tab.contentFrame.style.display = "block";
  }

  // Update tab bar
  tabBar.setActiveTab(tabId);

  // Update toolbar
  toolbar.setFilename(tab.filename);
  toolbar.setUnsaved(tab.isDirty);
  toolbar.setFileType(tab.fileType);

  // Update find/replace bar to use this tab's iframe
  if (findReplaceBar && tab.contentFrame) {
    findReplaceBar.setIframe(tab.contentFrame);
  }

  // Save session state (fire and forget)
  saveSession();
}

// Close a tab
async function closeTab(tabId: string): Promise<void> {
  const tab = tabBar.getTab(tabId);
  if (!tab) return;

  // Warn about unsaved changes
  if (tab.isDirty) {
    const shouldClose = confirm(`"${tab.filename}" has unsaved changes. Close anyway?`);
    if (!shouldClose) return;
  }

  // Remove iframe
  if (tab.contentFrame) {
    tab.contentFrame.remove();
  }

  // Remove tab
  tabBar.removeTab(tabId);

  // If this was the active tab, switch to another or show welcome
  if (tabBar.getActiveTabId() === null) {
    const allTabs = tabBar.getAllTabs();
    if (allTabs.length > 0) {
      switchToTab(allTabs[allTabs.length - 1].id);
    } else {
      // Show welcome screen and hide sidebar
      const welcome = document.getElementById("welcome");
      if (welcome) {
        welcome.style.display = "flex";
      }
      const sidebar = document.getElementById("tab-bar-container");
      if (sidebar) {
        sidebar.style.display = "none";
      }
      toolbar.setFilename("");
      toolbar.setUnsaved(false);

      // Refresh recent files list
      initializeRecentFiles();
    }
  }

  // Save session state after tab is closed
  await saveSession();
}

async function saveToPath(path: string): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.contentFrame?.contentDocument) return;

  try {
    const targetType = detectFileType(path);
    let content: string;

    if (targetType === 'markdown') {
      // Serialize HTML back to markdown
      const markdownContent = serializeToMarkdown(tab.contentFrame.contentDocument);
      // Prepend frontmatter if we had it originally
      content = stringifyWithFrontmatter(markdownContent, tab.frontmatter);
    } else if (tab.fileType === 'html' && tab.originalHtml && tab.regions.length > 0) {
      // HTML file with surgical editing - sync from DOM and replace only changed regions
      syncRegionsFromDom(tab.contentFrame.contentDocument as unknown as Document, tab.regions);
      content = surgicalReplace(tab.originalHtml, tab.regions);

      // Restore scripts that were stripped for safe editing
      tab.scriptMap.forEach((script, id) => {
        content = content.replace(`<!--${id}-->`, script);
      });
    } else {
      // Fallback: full serialization for markdown-to-HTML export or edge cases
      content = tab.originalDoctype + "\n" + tab.contentFrame.contentDocument.documentElement.outerHTML;
    }

    await invoke("write_file", { path, content });

    const filename = path.split(/[/\\]/).pop() || path;

    // Update tab state
    tabBar.updateTab(tab.id, {
      currentPath: path,
      filename,
      fileType: targetType,
      isDirty: false,
    });

    // If we saved as markdown, update the original markdown
    if (targetType === 'markdown') {
      tabBar.updateTab(tab.id, {
        originalMarkdown: content,
        originalHtml: null,
        regions: [],
      });
    } else if (tab.fileType === 'html') {
      // Update originalHtml and re-parse regions for subsequent edits
      tabBar.updateTab(tab.id, {
        originalHtml: content,
        regions: parseEditableRegions(content),
        originalMarkdown: null,
        frontmatter: null,
      });
    }

    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);
    toolbar.setFileType(targetType);

    showToast("Saved!");

  } catch (err) {
    console.error("Failed to save file:", err);
    alert(`Failed to save file: ${err}`);
  }
}

// Initialize TabBar with callbacks
tabBar = new TabBar(tabBarContainer, {
  onTabSwitch: (tabId) => switchToTab(tabId),
  onTabClose: (tabId) => closeTab(tabId),
});

// Initialize ContextMenu with element operation callbacks
contextMenu = new ContextMenu({
  onDelete: (element) => {
    deleteElement(element, markDirty);
  },
  onEditLink: (link) => {
    const tab = getActiveTab();
    if (!tab?.contentFrame?.contentDocument) return;

    showPromptDialog(
      tab.contentFrame.contentDocument,
      "Edit Link",
      [
        { label: "URL", value: link.href, placeholder: "https://example.com" },
        { label: "Text", value: link.textContent || "", placeholder: "Link text" },
      ],
      ([url, text]) => {
        editLink(link, url, text, markDirty);
      }
    );
  },
  onInsertLink: (_element) => {
    const tab = getActiveTab();
    if (!tab?.contentFrame?.contentDocument) return;

    showPromptDialog(
      tab.contentFrame.contentDocument,
      "Add Link",
      [{ label: "URL", value: "", placeholder: "https://example.com" }],
      ([url]) => {
        if (url && tab.contentFrame?.contentDocument) {
          insertLink(tab.contentFrame.contentDocument, url, markDirty);
        }
      }
    );
  },
  onRemoveLink: (link) => {
    removeLink(link, markDirty);
  },
  onReplaceImage: async (image) => {
    const tab = getActiveTab();
    if (!tab?.currentPath) return;

    const dirPath: string = await invoke("get_file_dir", { path: tab.currentPath });
    await replaceImage(image, dirPath, markDirty);
  },
  onRemoveImage: (image) => {
    removeImage(image, markDirty);
  },
  onConvertBlock: (element, targetTag) => {
    convertBlock(element, targetTag, markDirty);
  },
});

// Handle drag-and-drop file opening
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // Check for supported file types
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name.toLowerCase();

    if (name.endsWith(".html") || name.endsWith(".htm") ||
        name.endsWith(".md") || name.endsWith(".markdown")) {
      // Get file path - this works in Tauri
      const path = (file as unknown as { path?: string }).path;
      if (path) {
        await loadFile(path);
        break; // Only open first valid file
      }
    }
  }
});

// Handle clipboard paste events for rich content
function handlePaste(e: ClipboardEvent): void {
  const tab = getActiveTab();
  if (!tab?.contentFrame?.contentDocument) return;

  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const iframeDoc = tab.contentFrame.contentDocument;
  const selection = iframeDoc.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  // Check for HTML content first
  const htmlContent = clipboardData.getData("text/html");
  if (htmlContent) {
    e.preventDefault();

    // Clean up the HTML (remove scripts, styles, etc.)
    const cleanHtml = sanitizeHtmlPaste(htmlContent);

    // Insert at cursor position
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const temp = iframeDoc.createElement("div");
    temp.innerHTML = cleanHtml;

    // Move all children into a document fragment
    const frag = iframeDoc.createDocumentFragment();
    while (temp.firstChild) {
      frag.appendChild(temp.firstChild);
    }
    range.insertNode(frag);

    // Collapse selection to end
    selection.collapseToEnd();
    markDirty();
    return;
  }

  // For plain text, let the browser handle it (default behavior)
}

// Sanitize pasted HTML to remove potentially dangerous or unwanted elements
function sanitizeHtmlPaste(html: string): string {
  // Create a temporary container to parse the HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Remove script tags
  const scripts = temp.querySelectorAll("script");
  scripts.forEach((s) => s.remove());

  // Remove style tags
  const styles = temp.querySelectorAll("style");
  styles.forEach((s) => s.remove());

  // Remove event handlers and dangerous attributes
  const allElements = temp.querySelectorAll("*");
  allElements.forEach((el) => {
    // Remove all event handlers
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (attr.name.startsWith("on") || attr.name === "style") {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Remove iframes, objects, embeds
  const dangerous = temp.querySelectorAll("iframe, object, embed, form, input, button");
  dangerous.forEach((el) => el.remove());

  return temp.innerHTML;
}

// Listen for paste events in iframes
function attachPasteHandler(doc: Document): void {
  doc.addEventListener("paste", handlePaste as EventListener, true);
}

// Recent files functions
async function addToRecentFiles(path: string): Promise<void> {
  try {
    await invoke("add_recent_file", { path });
  } catch (err) {
    console.error("Failed to add file to recent files:", err);
  }
}

async function loadRecentFiles(): Promise<RecentFile[]> {
  try {
    return await invoke("get_recent_files");
  } catch (err) {
    console.error("Failed to load recent files:", err);
    return [];
  }
}

function renderRecentFiles(files: RecentFile[]): void {
  const welcome = document.getElementById("welcome");
  if (!welcome) return;

  // Remove existing recent files section if any
  const existing = welcome.querySelector(".recent-files");
  if (existing) {
    existing.remove();
  }

  // Don't show section if no recent files
  if (files.length === 0) return;

  // Create recent files section
  const section = document.createElement("div");
  section.className = "recent-files";

  const heading = document.createElement("h3");
  heading.textContent = "Recent Files";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "recent-files-list";

  files.forEach((file) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.className = "recent-file-item";
    link.title = file.path;

    const nameSpan = document.createElement("span");
    nameSpan.className = "recent-file-name";
    nameSpan.textContent = file.name;

    const pathSpan = document.createElement("span");
    pathSpan.className = "recent-file-path";
    // Show parent directory for context
    const pathParts = file.path.split(/[/\\]/);
    pathParts.pop(); // Remove filename
    pathSpan.textContent = pathParts.slice(-2).join("/");

    link.appendChild(nameSpan);
    link.appendChild(pathSpan);

    link.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadFile(file.path);
    });

    item.appendChild(link);
    list.appendChild(item);
  });

  section.appendChild(list);

  // Insert after shortcuts
  const shortcuts = welcome.querySelector(".shortcuts");
  if (shortcuts) {
    shortcuts.after(section);
  } else {
    welcome.appendChild(section);
  }
}

// Initialize recent files on startup
async function initializeRecentFiles(): Promise<void> {
  const files = await loadRecentFiles();
  renderRecentFiles(files);
}

// Session management functions
async function saveSession(): Promise<void> {
  try {
    const allTabs = tabBar.getAllTabs();
    const openFiles = allTabs
      .filter(tab => tab.currentPath)
      .map(tab => tab.currentPath);

    const activeTab = getActiveTab();
    const activeFile = activeTab?.currentPath || null;

    await invoke("save_session", { openFiles, activeFile });
  } catch (err) {
    console.error("Failed to save session:", err);
  }
}

async function loadSession(): Promise<SessionData | null> {
  try {
    return await invoke("get_session");
  } catch (err) {
    console.error("Failed to load session:", err);
    return null;
  }
}

async function restoreSession(): Promise<void> {
  const session = await loadSession();
  if (!session || session.open_files.length === 0) {
    // No session to restore, just show recent files
    await initializeRecentFiles();
    return;
  }

  // Load all files from the session
  for (const filePath of session.open_files) {
    try {
      await loadFile(filePath);
    } catch (err) {
      console.error(`Failed to restore file ${filePath}:`, err);
    }
  }

  // Switch to the previously active file if it was restored
  if (session.active_file) {
    const activeTabId = tabBar.findTabByPath(session.active_file);
    if (activeTabId) {
      switchToTab(activeTabId);
    }
  }
}

// Call on page load - restore session instead of just recent files
restoreSession();
