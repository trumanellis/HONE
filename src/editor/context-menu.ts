/**
 * Context Menu for element operations (delete, edit links, replace images, etc.)
 */

import { EDITOR_ATTR } from './inject';

export interface ContextMenuCallbacks {
  onDelete: (element: HTMLElement) => void;
  onEditLink: (element: HTMLAnchorElement) => void;
  onInsertLink: (element: HTMLElement) => void;
  onRemoveLink: (element: HTMLAnchorElement) => void;
  onReplaceImage: (element: HTMLImageElement) => void;
  onRemoveImage: (element: HTMLImageElement) => void;
  onInsertImage: (afterElement: HTMLElement) => void;
  onConvertBlock: (element: HTMLElement, targetTag: string) => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
}

const MENU_CLASS = 'hone-context-menu';
const MENU_ITEM_CLASS = 'hone-context-menu-item';

export class ContextMenu {
  private menu: HTMLElement | null = null;
  private callbacks: ContextMenuCallbacks;
  private doc: Document | null = null;

  constructor(callbacks: ContextMenuCallbacks) {
    this.callbacks = callbacks;
  }

  attach(doc: Document): void {
    this.doc = doc;

    // Add styles to the document
    this.injectStyles(doc);

    // Listen for context menu events (capture phase to run before default behavior)
    doc.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);

    // Close menu on click outside or escape
    doc.addEventListener('click', this.close.bind(this));
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // Also close when scrolling
    doc.addEventListener('scroll', this.close.bind(this), true);
  }

  private injectStyles(doc: Document): void {
    const style = doc.createElement('style');
    style.setAttribute(EDITOR_ATTR, 'context-menu-style');
    style.textContent = `
      .${MENU_CLASS} {
        position: fixed;
        background: #1E1E1E;
        border: 1px solid #2A2A2A;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        padding: 4px 0;
        min-width: 160px;
        z-index: 10000;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
      }

      .${MENU_ITEM_CLASS} {
        padding: 6px 12px;
        color: #B8B8B8;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 100ms ease;
      }

      .${MENU_ITEM_CLASS}:hover {
        background: #2A2A2A;
        color: #E8E8E8;
      }

      .${MENU_ITEM_CLASS}.disabled {
        color: #707070;
        cursor: not-allowed;
      }

      .${MENU_ITEM_CLASS}.disabled:hover {
        background: transparent;
        color: #707070;
      }

      .${MENU_ITEM_CLASS}.destructive {
        color: #FF6B4A;
      }

      .${MENU_ITEM_CLASS}.destructive:hover {
        background: rgba(255, 107, 74, 0.1);
      }

      .${MENU_CLASS}-separator {
        height: 1px;
        background: #2A2A2A;
        margin: 4px 0;
      }

      .${MENU_CLASS}-submenu-label {
        padding: 4px 12px;
        color: #707070;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    `;
    doc.head.appendChild(style);
  }

  private handleContextMenu(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Check if clicked on an image - images get special handling even outside contenteditable
    const clickedImage = target.closest('img') as HTMLImageElement | null;

    // Find contenteditable parent (for text/link operations)
    const editableParent = target.closest('[contenteditable="true"]') as HTMLElement | null;

    // Need either an editable parent OR clicking on an image
    if (!editableParent && !clickedImage) return;

    e.preventDefault();
    e.stopPropagation();

    const items = this.buildMenuItems(target, editableParent, clickedImage);
    this.showMenu(e.clientX, e.clientY, items);
  }

  private buildMenuItems(
    clicked: HTMLElement,
    editable: HTMLElement | null,
    clickedImage: HTMLImageElement | null
  ): MenuItem[] {
    const items: MenuItem[] = [];

    // Link options only available inside contenteditable
    if (editable) {
      const link = clicked.closest('a') as HTMLAnchorElement | null;
      if (link) {
        items.push({
          label: 'Edit Link...',
          action: () => this.callbacks.onEditLink(link),
        });
        items.push({
          label: 'Remove Link',
          action: () => this.callbacks.onRemoveLink(link),
        });
        items.push({ label: '', action: () => {}, separator: true });
      } else if (this.doc?.getSelection()?.toString()) {
        // Has text selection - offer to add link
        items.push({
          label: 'Add Link...',
          action: () => this.callbacks.onInsertLink(editable),
        });
        items.push({ label: '', action: () => {}, separator: true });
      }
    }

    // Image options - available whether inside contenteditable or not
    if (clickedImage) {
      items.push({
        label: 'Replace Image...',
        action: () => this.callbacks.onReplaceImage(clickedImage),
      });
      items.push({
        label: 'Remove Image',
        action: () => this.callbacks.onRemoveImage(clickedImage),
      });
      items.push({ label: '', action: () => {}, separator: true });
    }

    // Block conversion options only available inside contenteditable
    if (editable) {
      const tagName = editable.tagName.toLowerCase();
      const convertibleTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

      if (convertibleTags.includes(tagName)) {
        items.push({
          label: 'Convert to...',
          action: () => {},
          disabled: true,
        });

        const conversions = [
          { tag: 'p', label: 'Paragraph' },
          { tag: 'h1', label: 'Heading 1' },
          { tag: 'h2', label: 'Heading 2' },
          { tag: 'h3', label: 'Heading 3' },
          { tag: 'h4', label: 'Heading 4' },
        ];

        for (const { tag, label } of conversions) {
          if (tag !== tagName) {
            items.push({
              label: `  ${label}`,
              action: () => this.callbacks.onConvertBlock(editable, tag),
            });
          }
        }

        items.push({ label: '', action: () => {}, separator: true });
      }

      // Insert image option (available for block elements inside contenteditable)
      if (!clickedImage) {
        items.push({
          label: 'Insert Image...',
          action: () => this.callbacks.onInsertImage(editable),
        });
        items.push({ label: '', action: () => {}, separator: true });
      }

      // Delete element option (available for editable elements)
      items.push({
        label: 'Delete Element',
        action: () => this.callbacks.onDelete(editable),
      });
    }

    // Remove trailing separator if present
    if (items.length > 0 && items[items.length - 1].separator) {
      items.pop();
    }

    return items;
  }

  private showMenu(x: number, y: number, items: MenuItem[]): void {
    this.close();

    if (!this.doc) return;

    const menu = this.doc.createElement('div');
    menu.className = MENU_CLASS;
    menu.setAttribute(EDITOR_ATTR, 'context-menu');

    for (const item of items) {
      if (item.separator) {
        const sep = this.doc.createElement('div');
        sep.className = `${MENU_CLASS}-separator`;
        menu.appendChild(sep);
      } else {
        const menuItem = this.doc.createElement('div');
        menuItem.className = MENU_ITEM_CLASS;
        menuItem.textContent = item.label;

        if (item.disabled) {
          menuItem.classList.add('disabled');
        } else if (item.label === 'Delete Element' || item.label === 'Remove Image' || item.label === 'Remove Link') {
          menuItem.classList.add('destructive');
        }

        if (!item.disabled) {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
            item.action();
          });
        }

        menu.appendChild(menuItem);
      }
    }

    this.doc.body.appendChild(menu);
    this.menu = menu;

    // Position menu, ensuring it stays in viewport
    const rect = menu.getBoundingClientRect();
    const viewportWidth = this.doc.defaultView?.innerWidth || 800;
    const viewportHeight = this.doc.defaultView?.innerHeight || 600;

    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  close(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
    // Menu closed
  }
}

/**
 * Creates and shows a simple prompt dialog in the iframe document
 */
export function showPromptDialog(
  doc: Document,
  title: string,
  fields: { label: string; value: string; placeholder?: string }[],
  onSubmit: (values: string[]) => void
): void {
  // Remove any existing dialog
  const existing = doc.querySelector('[data-hone-dialog]');
  if (existing) existing.remove();

  const overlay = doc.createElement('div');
  overlay.setAttribute('data-hone-dialog', 'true');
  overlay.setAttribute(EDITOR_ATTR, 'dialog');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;

  const dialog = doc.createElement('div');
  dialog.style.cssText = `
    background: #1E1E1E;
    border: 1px solid #2A2A2A;
    border-radius: 6px;
    padding: 20px;
    min-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    font-family: 'JetBrains Mono', monospace;
  `;

  const titleEl = doc.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    color: #E8E8E8;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
  `;
  dialog.appendChild(titleEl);

  const inputs: HTMLInputElement[] = [];

  for (const field of fields) {
    const label = doc.createElement('label');
    label.style.cssText = `
      display: block;
      color: #B8B8B8;
      font-size: 11px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    label.textContent = field.label;
    dialog.appendChild(label);

    const input = doc.createElement('input');
    input.type = 'text';
    input.value = field.value;
    input.placeholder = field.placeholder || '';
    input.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: #141414;
      border: 1px solid #2A2A2A;
      border-radius: 4px;
      color: #E8E8E8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    `;
    input.addEventListener('focus', () => {
      input.style.borderColor = '#5C8FFF';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#2A2A2A';
    });
    dialog.appendChild(input);
    inputs.push(input);
  }

  const buttons = doc.createElement('div');
  buttons.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  `;

  const cancelBtn = doc.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #2A2A2A;
    border-radius: 4px;
    background: transparent;
    color: #B8B8B8;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());

  const submitBtn = doc.createElement('button');
  submitBtn.textContent = 'Apply';
  submitBtn.style.cssText = `
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #E8E8E8;
    color: #000000;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 500;
  `;
  submitBtn.addEventListener('click', () => {
    onSubmit(inputs.map(i => i.value));
    overlay.remove();
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(submitBtn);
  dialog.appendChild(buttons);

  overlay.appendChild(dialog);
  doc.body.appendChild(overlay);

  // Focus first input
  if (inputs.length > 0) {
    inputs[0].focus();
    inputs[0].select();
  }

  // Handle Enter key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(inputs.map(i => i.value));
      overlay.remove();
    } else if (e.key === 'Escape') {
      overlay.remove();
    }
  };

  for (const input of inputs) {
    input.addEventListener('keydown', handleKeydown);
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}
