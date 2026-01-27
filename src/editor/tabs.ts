import type { FileType } from "../types/editor";
import type { EditableRegion } from "./html-parser";
import type { FrontmatterData } from "../types/editor";
import type { UndoManager } from "../undo/UndoManager";
import type { TextEditTracker } from "../undo/TextEditTracker";

export interface TabState {
  id: string;
  currentPath: string;
  filename: string;
  isDirty: boolean;
  fileType: FileType;
  // Content state
  contentFrame: HTMLIFrameElement | null;
  originalDoctype: string;
  originalMarkdown: string | null;
  frontmatter: FrontmatterData | null;
  originalHtml: string | null;
  regions: EditableRegion[];
  scriptMap: Map<string, string>;
  // Undo system
  undoManager: UndoManager | null;
  textEditTracker: TextEditTracker | null;
}

export interface TabBarCallbacks {
  onTabSwitch: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const MAX_TABS = 10;

export class TabBar {
  private container: HTMLElement;
  private tabList: HTMLElement;
  private tabs: Map<string, TabState> = new Map();
  private activeTabId: string | null = null;
  private callbacks: TabBarCallbacks;
  private tabElements: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement, callbacks: TabBarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    // Find or create the .tab-bar element inside the container
    this.tabList = this.container.querySelector('.tab-bar') || this.container;
  }

  private createTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public createTab(state: Omit<TabState, 'id'>): string | null {
    // Check max tabs
    if (this.tabs.size >= MAX_TABS) {
      return null;
    }

    const id = this.createTabId();
    const tabState: TabState = { id, ...state };
    this.tabs.set(id, tabState);

    // Create tab element
    const tabEl = this.createTabElement(tabState);
    this.tabElements.set(id, tabEl);
    this.tabList.appendChild(tabEl);

    return id;
  }

  private createTabElement(tab: TabState): HTMLElement {
    const tabEl = document.createElement("div");
    tabEl.className = "tab";
    tabEl.dataset.tabId = tab.id;

    // File type badge
    const badge = document.createElement("span");
    badge.className = `tab-badge ${tab.fileType}`;
    badge.textContent = tab.fileType === 'markdown' ? 'MD' : 'HTML';

    // Filename
    const filename = document.createElement("span");
    filename.className = "tab-filename";
    filename.textContent = tab.filename;

    // Unsaved indicator
    const unsaved = document.createElement("span");
    unsaved.className = "tab-unsaved";
    unsaved.textContent = "*";

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.innerHTML = "×";
    closeBtn.title = "close tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onTabClose(tab.id);
    });

    // Tab click handler
    tabEl.addEventListener("click", () => {
      this.callbacks.onTabSwitch(tab.id);
    });

    tabEl.appendChild(badge);
    tabEl.appendChild(filename);
    tabEl.appendChild(unsaved);
    tabEl.appendChild(closeBtn);

    return tabEl;
  }

  public setActiveTab(tabId: string): void {
    this.activeTabId = tabId;

    // Update visual state
    this.tabElements.forEach((el, id) => {
      el.classList.toggle("active", id === tabId);
    });
  }

  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  public getTab(tabId: string): TabState | null {
    return this.tabs.get(tabId) || null;
  }

  public updateTab(tabId: string, updates: Partial<TabState>): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    Object.assign(tab, updates);

    // Update tab element if needed
    const tabEl = this.tabElements.get(tabId);
    if (!tabEl) return;

    if (updates.filename !== undefined) {
      const filenameEl = tabEl.querySelector(".tab-filename");
      if (filenameEl) {
        filenameEl.textContent = updates.filename;
      }
    }

    if (updates.isDirty !== undefined) {
      tabEl.classList.toggle("dirty", updates.isDirty);
    }

    if (updates.fileType !== undefined) {
      const badge = tabEl.querySelector(".tab-badge");
      if (badge) {
        badge.className = `tab-badge ${updates.fileType}`;
        badge.textContent = updates.fileType === 'markdown' ? 'MD' : 'HTML';
      }
    }
  }

  public removeTab(tabId: string): void {
    const tabEl = this.tabElements.get(tabId);
    if (tabEl) {
      tabEl.remove();
      this.tabElements.delete(tabId);
    }
    this.tabs.delete(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = null;
    }
  }

  public findTabByPath(path: string): string | null {
    for (const [id, tab] of this.tabs.entries()) {
      if (tab.currentPath === path) {
        return id;
      }
    }
    return null;
  }

  public getAllTabs(): TabState[] {
    return Array.from(this.tabs.values());
  }

  public getTabCount(): number {
    return this.tabs.size;
  }

  public hasMaxTabs(): boolean {
    return this.tabs.size >= MAX_TABS;
  }

  public clear(): void {
    this.tabElements.forEach((el) => el.remove());
    this.tabElements.clear();
    this.tabs.clear();
    this.activeTabId = null;
  }
}
