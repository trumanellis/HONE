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
  convertBlock,
  selectImageFile,
  resolveImageSrc,
} from "./editor/element-operations";
import { UndoManager } from "./undo/UndoManager";
import { TextEditTracker } from "./undo/TextEditTracker";
import { DragDropManager } from "./editor/drag-drop";
import { ImageOverlayManager } from "./editor/image-overlay";
import { captureDocumentSelection } from "./undo/SelectionUtils";
import {
  ImageReplaceCommand,
  ImageInsertCommand,
  ImageDeleteCommand,
} from "./undo/commands/ImageCommands";
import { injectEditableRegions, injectStyles, EDITOR_ATTR } from "./editor/inject";
import {
  parseEditableRegions,
  extractDoctype,
  surgicalReplace,
  syncRegionsFromDom,
} from "./editor/html-parser";
import {
  extractFrontmatter,
  stringifyWithFrontmatter,
} from "./editor/markdown";
import {
  MilkdownEditor,
  preprocessImages,
  postprocessImages,
} from "./editor/milkdown-editor";
import type { FileType } from "./types/editor";

interface RecentFile {
  path: string;
  name: string;
  accessed_at: number;
}

interface SessionData {
  open_files: string[];
  active_file: string | null;
}

const tabBarContainer = document.getElementById("tab-bar-container")!;
let tabBar: TabBar;
let contextMenu: ContextMenu;
let imageOverlayManager: ImageOverlayManager;

function getActiveTab(): TabState | null {
  const activeId = tabBar.getActiveTabId();
  return activeId ? tabBar.getTab(activeId) : null;
}

function detectFileType(path: string): FileType {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "markdown" ? "markdown" : "html";
}

// Transform images in the live DOM to use Tauri asset protocol for display.
// Used for HTML files; markdown files go through preprocessImages instead.
function transformImagesForDisplay(doc: Document, dirPath: string): void {
  const images = doc.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (
      !src ||
      src.startsWith("data:") ||
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("asset:")
    ) {
      return;
    }
    let absolutePath: string;
    if (src.startsWith("/")) {
      absolutePath = src;
    } else if (src.startsWith("file://")) {
      absolutePath = src.replace("file://", "");
    } else {
      absolutePath = `${dirPath}/${src}`;
    }
    img.setAttribute("src", convertFileSrc(absolutePath));
  });
}

const toast = document.getElementById("toast")!;
let toastTimeout: number | null = null;

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("show");
    toastTimeout = null;
  }, 2000);
}

function handleUndo(): void {
  const tab = getActiveTab();
  if (!tab) return;
  if (tab.fileType === "markdown") return; // Milkdown handles undo natively
  if (tab.undoManager?.canUndo()) {
    tab.textEditTracker?.flush();
    tab.undoManager.undo();
    markDirty();
  }
}

function handleRedo(): void {
  const tab = getActiveTab();
  if (!tab) return;
  if (tab.fileType === "markdown") return;
  if (tab.undoManager?.canRedo()) {
    tab.undoManager.redo();
    markDirty();
  }
}

async function handleRefresh(): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.currentPath) return;

  if (tab.isDirty) {
    const shouldRefresh = confirm(
      `"${tab.filename}" has unsaved changes. Reload anyway?`
    );
    if (!shouldRefresh) return;
  }

  const path = tab.currentPath;
  const tabId = tab.id;

  await teardownTab(tab);
  tabBar.removeTab(tabId);
  imageOverlayManager.detach();

  await loadFile(path);
  showToast("Refreshed");
}

const toolbarContainer = document.getElementById("toolbar")!;
const toolbar = createToolbar(toolbarContainer, {
  onOpen: handleOpen,
  onSave: handleSave,
  onSaveAs: handleSaveAs,
  onUndo: handleUndo,
  onRedo: handleRedo,
});

let findReplaceBar: FindReplaceBar | null = null;

function initializeFindReplaceBar(): void {
  const container = document.getElementById("editor-container")!;
  if (findReplaceBar) findReplaceBar.destroy();
  findReplaceBar = createFindReplaceBar(container);
  const tab = getActiveTab();
  if (tab?.contentFrame) findReplaceBar.setIframe(tab.contentFrame);
}

function openFindBar(mode: "find" | "replace"): void {
  const tab = getActiveTab();
  if (!tab) return;
  if (tab.fileType === "markdown") {
    showToast("Find & replace not available in markdown mode yet");
    return;
  }
  if (!tab.contentFrame) return;
  if (!findReplaceBar) initializeFindReplaceBar();
  findReplaceBar!.setIframe(tab.contentFrame);
  findReplaceBar!.open(mode);
}

function markDirty(): void {
  const tab = getActiveTab();
  if (tab && !tab.isDirty) {
    tabBar.updateTab(tab.id, { isDirty: true });
    toolbar.setUnsaved(true);
  }
}

function handleKeyboardShortcut(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey;

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
  const tab = getActiveTab();
  const isMarkdown = tab?.fileType === "markdown";

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

  // Find & Replace
  if (key === "f" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    openFindBar("find");
    return;
  }

  if (key === "h" || (key === "f" && e.shiftKey)) {
    e.preventDefault();
    e.stopPropagation();
    openFindBar("replace");
    return;
  }

  if (key === "w") {
    e.preventDefault();
    e.stopPropagation();
    const activeId = tabBar.getActiveTabId();
    if (activeId) closeTab(activeId);
    return;
  }

  if (key === "r") {
    e.preventDefault();
    e.stopPropagation();
    handleRefresh();
    return;
  }

  // Undo/Redo - HTML tabs only; Milkdown handles these natively via ProseMirror history
  if (!isMarkdown && key === "z" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    handleUndo();
    return;
  }

  if (!isMarkdown && ((key === "z" && e.shiftKey) || key === "y")) {
    e.preventDefault();
    e.stopPropagation();
    handleRedo();
    return;
  }
}

window.addEventListener("keydown", handleKeyboardShortcut, true);
document.addEventListener("keydown", handleKeyboardShortcut, true);

listen("menu-open", () => handleOpen());
listen("menu-save", () => handleSave());
listen("menu-save-as", () => handleSaveAs());
listen("menu-close-tab", () => {
  const activeId = tabBar.getActiveTabId();
  if (activeId) closeTab(activeId);
});
listen("menu-refresh", () => handleRefresh());

window.addEventListener("beforeunload", (e) => {
  const hasUnsavedChanges = tabBar.getAllTabs().some((tab) => tab.isDirty);
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
  if (selected) await loadFile(selected);
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
  if (!tab) return;

  const filters =
    tab.fileType === "markdown"
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

  if (selected) await saveToPath(selected);
}

function makeEmptyTabState(
  path: string,
  filename: string,
  fileType: FileType,
  dirPath: string
): Omit<TabState, "id"> {
  return {
    currentPath: path,
    filename,
    isDirty: false,
    fileType,
    dirPath,
    contentFrame: null,
    originalDoctype: "<!DOCTYPE html>",
    originalHtml: null,
    regions: [],
    scriptMap: new Map(),
    iframeSrcMap: new Map(),
    undoManager: null,
    textEditTracker: null,
    milkdownEditor: null,
    milkdownContainer: null,
    originalMarkdown: null,
    frontmatter: null,
    imageReverseMap: new Map(),
  };
}

async function loadFile(path: string): Promise<void> {
  try {
    const existingTabId = tabBar.findTabByPath(path);
    if (existingTabId) {
      switchToTab(existingTabId);
      return;
    }

    if (tabBar.hasMaxTabs()) {
      showToast("Maximum 10 tabs open");
      return;
    }

    const content: string = await invoke("read_file", { path });
    const dirPath: string = await invoke("get_file_dir", { path });

    const fileType = detectFileType(path);
    const filename = path.split(/[/\\]/).pop() || path;

    const tabState = makeEmptyTabState(path, filename, fileType, dirPath);

    const container = document.getElementById("editor-container")!;
    hideAllSurfaces(container);

    if (fileType === "markdown") {
      await mountMarkdownTab(tabState, container, content, dirPath);
    } else {
      await mountHtmlTab(tabState, container, content, dirPath);
    }

    const tabId = tabBar.createTab(tabState);
    if (!tabId) return;

    tabBar.setActiveTab(tabId);
    toolbar.setFilename(filename);
    toolbar.setUnsaved(false);
    toolbar.setFileType(fileType);

    await addToRecentFiles(path);

    const welcome = document.getElementById("welcome");
    if (welcome) welcome.style.display = "none";
    const sidebar = document.getElementById("tab-bar-container");
    if (sidebar) sidebar.style.display = "flex";

    initializeFindReplaceBar();
    await saveSession();
  } catch (err) {
    console.error("Failed to load file:", err);
    alert(`Failed to load file: ${err}`);
  }
}

function hideAllSurfaces(container: HTMLElement): void {
  container.querySelectorAll("iframe").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });
  container.querySelectorAll(".milkdown-tab-root").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });
}

async function mountMarkdownTab(
  tabState: Omit<TabState, "id">,
  container: HTMLElement,
  content: string,
  dirPath: string
): Promise<void> {
  tabState.originalMarkdown = content;

  const parsed = extractFrontmatter(content);
  tabState.frontmatter = parsed.frontmatter;

  const { processed, reverseMap } = preprocessImages(parsed.content, (rel) => {
    return convertFileSrc(`${dirPath}/${rel}`);
  });
  tabState.imageReverseMap = reverseMap;

  const root = document.createElement("div");
  root.className = "milkdown-tab-root";
  container.appendChild(root);
  tabState.milkdownContainer = root;

  const editor = await MilkdownEditor.create({
    root,
    markdown: processed,
    onChange: () => markDirty(),
  });
  tabState.milkdownEditor = editor;

  // Focus the editor for immediate typing
  requestAnimationFrame(() => editor.focus());
}

async function mountHtmlTab(
  tabState: Omit<TabState, "id">,
  container: HTMLElement,
  content: string,
  dirPath: string
): Promise<void> {
  tabState.originalHtml = content;
  tabState.originalDoctype = extractDoctype(content);
  tabState.regions = parseEditableRegions(content);

  const iframe = document.createElement("iframe");
  iframe.className = "content-frame";
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.setAttribute("autocomplete", "off");

  let scriptId = 0;
  let safeHtml = content.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    (match) => {
      const id = `hone-script-${scriptId++}`;
      tabState.scriptMap.set(id, match);
      return `<!--${id}-->`;
    }
  );

  let iframeId = 0;
  safeHtml = safeHtml.replace(
    /<iframe\b([^>]*)src\s*=\s*("[^"]*"|'[^']*')([^>]*)>[\s\S]*?<\/iframe>/gi,
    (_match, before, srcAttr, after) => {
      const id = `hone-iframe-${iframeId++}`;
      const src = srcAttr.replace(/^["']|["']$/g, "");
      const attrs = before + after;
      const titleMatch = attrs.match(/title\s*=\s*"([^"]*)"/i);
      const title = titleMatch ? titleMatch[1] : src;
      tabState.iframeSrcMap.set(id, { src, original: _match });
      return `<div data-hone-iframe-id="${id}" data-hone-iframe-src="${src}" class="hone-iframe-placeholder">
          <div class="hone-iframe-label">Embedded content</div>
          <div class="hone-iframe-title">${title}</div>
          <button class="hone-iframe-open-btn" type="button">Open in Browser</button>
        </div>`;
    }
  );

  const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none';" data-hone-csp>`;
  if (safeHtml.includes("<head>")) {
    safeHtml = safeHtml.replace("<head>", `<head>${csp}`);
  } else if (safeHtml.includes("<head ")) {
    safeHtml = safeHtml.replace(/<head\s[^>]*>/, `$&${csp}`);
  } else if (safeHtml.includes("<html>")) {
    safeHtml = safeHtml.replace("<html>", `<html><head>${csp}</head>`);
  } else if (safeHtml.includes("<html ")) {
    safeHtml = safeHtml.replace(/<html\s[^>]*>/, `$&<head>${csp}</head>`);
  }

  iframe.srcdoc = safeHtml;
  container.appendChild(iframe);
  tabState.contentFrame = iframe;

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
  });

  const doc = iframe.contentDocument!;

  const base = doc.createElement("base");
  base.href = `file://${dirPath}/`;
  base.setAttribute(EDITOR_ATTR, "base");
  doc.head.insertBefore(base, doc.head.firstChild);

  transformImagesForDisplay(doc, dirPath);

  const placeholders = doc.querySelectorAll("[data-hone-iframe-id]");
  placeholders.forEach((el) => {
    const btn = el.querySelector(".hone-iframe-open-btn");
    const src = el.getAttribute("data-hone-iframe-src");
    if (btn && src) {
      btn.addEventListener("click", () => {
        const absolutePath = src.startsWith("/") ? src : `${dirPath}/${src}`;
        invoke("open_in_browser", { path: absolutePath });
      });
    }
  });

  injectStyles(doc);

  if (tabState.regions.length > 0) {
    injectEditableRegions(doc, tabState.regions);
  }

  doc.addEventListener("input", markDirty);
  doc.addEventListener("keydown", handleKeyboardShortcut, true);
  if (iframe.contentWindow) {
    iframe.contentWindow.addEventListener(
      "keydown",
      handleKeyboardShortcut,
      true
    );
  }

  contextMenu.attach(doc);
  attachPasteHandler(doc);

  const undoManager = new UndoManager(50);
  undoManager.setDocument(doc);
  tabState.undoManager = undoManager;

  const textEditTracker = new TextEditTracker(undoManager, doc, markDirty, 500);
  textEditTracker.attach();
  textEditTracker.recordAllRegionStates();
  tabState.textEditTracker = textEditTracker;

  const dragDropManager = new DragDropManager(
    iframe,
    undoManager,
    textEditTracker,
    markDirty
  );
  dragDropManager.attach();

  imageOverlayManager.attach(iframe);
}

async function teardownTab(tab: TabState): Promise<void> {
  if (tab.milkdownEditor) {
    await tab.milkdownEditor.destroy();
    tab.milkdownEditor = null;
  }
  if (tab.milkdownContainer) {
    tab.milkdownContainer.remove();
    tab.milkdownContainer = null;
  }
  if (tab.contentFrame) {
    tab.contentFrame.remove();
    tab.contentFrame = null;
  }
}

function switchToTab(tabId: string): void {
  const tab = tabBar.getTab(tabId);
  if (!tab) return;

  const container = document.getElementById("editor-container")!;
  hideAllSurfaces(container);

  if (tab.contentFrame) tab.contentFrame.style.display = "block";
  if (tab.milkdownContainer) tab.milkdownContainer.style.display = "block";

  tabBar.setActiveTab(tabId);
  toolbar.setFilename(tab.filename);
  toolbar.setUnsaved(tab.isDirty);
  toolbar.setFileType(tab.fileType);

  if (findReplaceBar && tab.contentFrame) {
    findReplaceBar.setIframe(tab.contentFrame);
  }

  if (tab.contentFrame) {
    imageOverlayManager.attach(tab.contentFrame);
  } else {
    imageOverlayManager.detach();
  }

  if (tab.milkdownEditor) {
    requestAnimationFrame(() => tab.milkdownEditor?.focus());
  }

  saveSession();
}

async function closeTab(tabId: string): Promise<void> {
  const tab = tabBar.getTab(tabId);
  if (!tab) return;

  if (tab.isDirty) {
    const shouldClose = confirm(
      `"${tab.filename}" has unsaved changes. Close anyway?`
    );
    if (!shouldClose) return;
  }

  await teardownTab(tab);
  tabBar.removeTab(tabId);

  if (tabBar.getActiveTabId() === null) {
    const allTabs = tabBar.getAllTabs();
    if (allTabs.length > 0) {
      switchToTab(allTabs[allTabs.length - 1].id);
    } else {
      const welcome = document.getElementById("welcome");
      if (welcome) welcome.style.display = "flex";
      const sidebar = document.getElementById("tab-bar-container");
      if (sidebar) sidebar.style.display = "none";
      toolbar.setFilename("");
      toolbar.setUnsaved(false);
      imageOverlayManager.detach();
      initializeRecentFiles();
    }
  }

  await saveSession();
}

async function saveToPath(path: string): Promise<void> {
  const tab = getActiveTab();
  if (!tab) return;

  try {
    const targetType = detectFileType(path);
    let content: string;

    if (tab.fileType === "markdown" && tab.milkdownEditor) {
      // Markdown source of truth lives in Milkdown
      let md = tab.milkdownEditor.getMarkdown();
      md = postprocessImages(md, tab.imageReverseMap);

      if (targetType === "markdown") {
        content = stringifyWithFrontmatter(md, tab.frontmatter);
      } else {
        // Markdown → HTML export: keep simple, write the markdown body as-is
        // wrapped in a minimal HTML shell. Heavy conversion was a feature of
        // the legacy turndown round-trip we just removed.
        content = stringifyWithFrontmatter(md, tab.frontmatter);
      }
    } else if (
      tab.fileType === "html" &&
      tab.contentFrame?.contentDocument &&
      tab.originalHtml &&
      tab.regions.length > 0 &&
      targetType === "html"
    ) {
      syncRegionsFromDom(
        tab.contentFrame.contentDocument as unknown as Document,
        tab.regions
      );
      content = surgicalReplace(tab.originalHtml, tab.regions);
      tab.scriptMap.forEach((script, id) => {
        content = content.replace(`<!--${id}-->`, script);
      });
    } else if (tab.fileType === "html" && tab.contentFrame?.contentDocument) {
      content =
        tab.originalDoctype +
        "\n" +
        tab.contentFrame.contentDocument.documentElement.outerHTML;
      tab.iframeSrcMap.forEach(({ original }, id) => {
        const placeholderRegex = new RegExp(
          `<div[^>]*data-hone-iframe-id="${id}"[^>]*>[\\s\\S]*?<\\/div>`,
          "g"
        );
        content = content.replace(placeholderRegex, original);
      });
    } else {
      return;
    }

    await invoke("write_file", { path, content });

    const filename = path.split(/[/\\]/).pop() || path;

    tabBar.updateTab(tab.id, {
      currentPath: path,
      filename,
      fileType: targetType,
      isDirty: false,
    });

    if (tab.fileType === "markdown") {
      tabBar.updateTab(tab.id, { originalMarkdown: content });
    } else if (tab.fileType === "html") {
      tabBar.updateTab(tab.id, {
        originalHtml: content,
        regions: parseEditableRegions(content),
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

// Shared image operation handlers — only valid for HTML tabs
async function handleReplaceImage(image: HTMLImageElement): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.currentPath || !tab.undoManager || !tab.contentFrame?.contentDocument)
    return;

  tab.textEditTracker?.flush();

  const dirPath: string = await invoke("get_file_dir", { path: tab.currentPath });
  const imagePath = await selectImageFile();
  if (!imagePath) return;

  const newSrc = resolveImageSrc(imagePath, dirPath);
  const selectionBefore = captureDocumentSelection(tab.contentFrame.contentDocument);
  const command = new ImageReplaceCommand(image, newSrc, selectionBefore);
  tab.undoManager.execute(command);
  markDirty();
  tab.textEditTracker?.recordAllRegionStates();
}

function handleRemoveImage(image: HTMLImageElement): void {
  const tab = getActiveTab();
  if (!tab?.undoManager || !tab.contentFrame?.contentDocument) {
    const figure = image.closest("figure");
    if (figure) figure.remove();
    else image.remove();
    markDirty();
    return;
  }

  tab.textEditTracker?.flush();
  const selectionBefore = captureDocumentSelection(tab.contentFrame.contentDocument);
  const command = new ImageDeleteCommand(image, selectionBefore);
  tab.undoManager.execute(command);
  markDirty();
  tab.textEditTracker?.recordAllRegionStates();

  if (tab.contentFrame) imageOverlayManager.attach(tab.contentFrame);
}

tabBar = new TabBar(tabBarContainer, {
  onTabSwitch: (tabId) => switchToTab(tabId),
  onTabClose: (tabId) => closeTab(tabId),
});

contextMenu = new ContextMenu({
  onDelete: (element) => deleteElement(element, markDirty),
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
      ([url, text]) => editLink(link, url, text, markDirty)
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
  onRemoveLink: (link) => removeLink(link, markDirty),
  onReplaceImage: handleReplaceImage,
  onRemoveImage: handleRemoveImage,
  onInsertImage: async (afterElement) => {
    const tab = getActiveTab();
    if (!tab?.currentPath || !tab.undoManager || !tab.contentFrame?.contentDocument)
      return;
    tab.textEditTracker?.flush();
    const dirPath: string = await invoke("get_file_dir", { path: tab.currentPath });
    const imagePath = await selectImageFile();
    if (!imagePath) return;
    const src = resolveImageSrc(imagePath, dirPath);
    const parent = afterElement.parentElement;
    if (!parent) return;
    const insertIndex =
      Array.from(parent.childNodes).indexOf(afterElement as ChildNode) + 1;
    const selectionBefore = captureDocumentSelection(
      tab.contentFrame.contentDocument
    );
    const command = new ImageInsertCommand(parent, insertIndex, src, selectionBefore);
    tab.undoManager.execute(command);
    markDirty();
    tab.textEditTracker?.recordAllRegionStates();
  },
  onConvertBlock: (element, targetTag) =>
    convertBlock(element, targetTag, markDirty),
});

const editorContainer = document.getElementById("editor-container")!;
imageOverlayManager = new ImageOverlayManager(editorContainer, {
  onReplace: handleReplaceImage,
  onRemove: handleRemoveImage,
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name.toLowerCase();
    if (
      name.endsWith(".html") ||
      name.endsWith(".htm") ||
      name.endsWith(".md") ||
      name.endsWith(".markdown")
    ) {
      const path = (file as unknown as { path?: string }).path;
      if (path) {
        await loadFile(path);
        break;
      }
    }
  }
});

function handlePaste(e: ClipboardEvent): void {
  const tab = getActiveTab();
  if (!tab?.contentFrame?.contentDocument) return;

  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const iframeDoc = tab.contentFrame.contentDocument;
  const selection = iframeDoc.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const htmlContent = clipboardData.getData("text/html");
  if (htmlContent) {
    e.preventDefault();
    const cleanHtml = sanitizeHtmlPaste(htmlContent);

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const temp = iframeDoc.createElement("div");
    temp.innerHTML = cleanHtml;

    const frag = iframeDoc.createDocumentFragment();
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    range.insertNode(frag);

    selection.collapseToEnd();
    markDirty();
  }
}

function sanitizeHtmlPaste(html: string): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("script").forEach((s) => s.remove());
  temp.querySelectorAll("style").forEach((s) => s.remove());

  temp.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("on") || attr.name === "style") {
        el.removeAttribute(attr.name);
      }
    });
  });

  temp
    .querySelectorAll("iframe, object, embed, form, input, button")
    .forEach((el) => el.remove());

  return temp.innerHTML;
}

function attachPasteHandler(doc: Document): void {
  doc.addEventListener("paste", handlePaste as EventListener, true);
}

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

  const existing = welcome.querySelector(".recent-files");
  if (existing) existing.remove();
  if (files.length === 0) return;

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
    const pathParts = file.path.split(/[/\\]/);
    pathParts.pop();
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

  const shortcuts = welcome.querySelector(".shortcuts");
  if (shortcuts) shortcuts.after(section);
  else welcome.appendChild(section);
}

async function initializeRecentFiles(): Promise<void> {
  const files = await loadRecentFiles();
  renderRecentFiles(files);
}

async function saveSession(): Promise<void> {
  try {
    const allTabs = tabBar.getAllTabs();
    const openFiles = allTabs
      .filter((tab) => tab.currentPath)
      .map((tab) => tab.currentPath);
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
    await initializeRecentFiles();
    return;
  }

  for (const filePath of session.open_files) {
    try {
      await loadFile(filePath);
    } catch (err) {
      console.error(`Failed to restore file ${filePath}:`, err);
    }
  }

  if (session.active_file) {
    const activeTabId = tabBar.findTabByPath(session.active_file);
    if (activeTabId) switchToTab(activeTabId);
  }
}

// Listen for CLI file open events (second-instance launches or macOS file associations)
listen<string[]>("open-files", async (event) => {
  for (const filePath of event.payload) {
    await loadFile(filePath);
  }
});

async function openPendingCliFiles(): Promise<boolean> {
  try {
    const files = await invoke<string[]>("take_pending_cli_files");
    if (!files || files.length === 0) return false;
    for (const filePath of files) {
      await loadFile(filePath);
    }
    return true;
  } catch (err) {
    console.error("Failed to read pending CLI files:", err);
    return false;
  }
}

// Call on page load - open CLI-provided files first, otherwise restore session
(async () => {
  const opened = await openPendingCliFiles();
  if (!opened) {
    await restoreSession();
  }
})();
