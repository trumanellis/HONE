import type { EditableRegion } from './html-parser';
import { EDITABLE_TAGS, LEAF_EDITABLE_TAGS } from './html-parser';

const EDITOR_CLASS = "html-editor-editable";
const EDITOR_ATTR = "data-html-editor";

/**
 * Block-level tags that indicate a div is a container, not a leaf
 */
const BLOCK_TAGS = [
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'tr', 'section', 'article',
  'header', 'footer', 'nav', 'aside', 'main', 'form',
];

/**
 * Check if a DOM element is a "leaf" node (contains only text/inline elements, no block children)
 */
function isLeafElement(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    if (BLOCK_TAGS.includes(child.tagName.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a DOM element would be considered an editable region
 */
function isEditableElement(el: Element): boolean {
  const tagName = el.tagName.toLowerCase();
  if (EDITABLE_TAGS.includes(tagName)) return true;
  if (LEAF_EDITABLE_TAGS.includes(tagName) && isLeafElement(el)) return true;
  return false;
}

/**
 * Inject edit IDs and contenteditable attributes into browser DOM elements.
 * Walks the DOM in document order, matching elements by tag name sequence
 * to align with the AST-derived regions.
 */
export function injectEditableRegions(doc: Document, regions: EditableRegion[]): void {
  // Track how many editable elements of each tag we've seen
  const tagCounts: Record<string, number> = {};

  for (const region of regions) {
    const count = tagCounts[region.tagName] || 0;
    const elements = doc.querySelectorAll(region.tagName);

    // Find the nth EDITABLE element of this tag type (not just nth element)
    let editableCount = 0;
    let matchedEl: Element | null = null;

    for (const el of Array.from(elements)) {
      if (isEditableElement(el)) {
        if (editableCount === count) {
          matchedEl = el;
          break;
        }
        editableCount++;
      }
    }

    if (matchedEl) {
      matchedEl.setAttribute('data-hone-edit-id', region.id);
      matchedEl.setAttribute('contenteditable', 'true');
      matchedEl.classList.add(EDITOR_CLASS);
      matchedEl.setAttribute(EDITOR_ATTR, 'true');
    }

    tagCounts[region.tagName] = count + 1;
  }
}

/**
 * Inject the editor stylesheet into a document
 */
export function injectStyles(doc: Document): void {
  const style = doc.createElement("style");
  style.setAttribute(EDITOR_ATTR, "style");
  style.textContent = `
    .${EDITOR_CLASS} {
      outline: none;
      transition: box-shadow 100ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    .${EDITOR_CLASS}:hover {
      box-shadow: inset 0 0 0 2px rgba(92, 143, 255, 0.3);
    }
    .${EDITOR_CLASS}:focus {
      box-shadow: inset 0 0 0 2px rgba(92, 143, 255, 0.7);
    }
    /* Hide fixed/sticky elements from loaded content (buttons, navs, etc.) */
    [style*="position: fixed"],
    [style*="position:fixed"],
    [style*="position: sticky"],
    [style*="position:sticky"] {
      display: none !important;
    }
    /* Find & Replace match highlighting */
    mark.hone-find-highlight {
      background: rgba(92, 143, 255, 0.3);
      color: inherit;
      border-radius: 2px;
      padding: 1px 0;
    }
    mark.hone-find-highlight.current {
      background: rgba(92, 143, 255, 0.7);
      outline: 1px solid #5C8FFF;
      outline-offset: 1px;
    }
    /* Image overlay controls */
    .hone-image-wrapper {
      position: relative;
      display: inline-block;
    }
    .hone-image-wrapper img {
      display: block;
    }
    .hone-image-controls {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 150ms ease;
      pointer-events: none;
    }
    .hone-image-wrapper:hover .hone-image-controls {
      opacity: 1;
      pointer-events: auto;
    }
    .hone-image-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: rgba(30, 30, 30, 0.9);
      color: #B8B8B8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 100ms ease, color 100ms ease;
      padding: 0;
    }
    .hone-image-btn:hover {
      background: rgba(42, 42, 42, 0.95);
      color: #E8E8E8;
    }
    .hone-image-btn.delete:hover {
      background: rgba(255, 107, 74, 0.9);
      color: #fff;
    }
    .hone-image-btn svg {
      width: 16px;
      height: 16px;
    }
    /* Override JS-dependent reveal animations since scripts are blocked */
    .reveal {
      opacity: 1 !important;
      transform: none !important;
    }
  `;
  doc.head.appendChild(style);

  // Also hide any elements with fixed/sticky position via computed style
  setTimeout(() => {
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      const style = doc.defaultView?.getComputedStyle(el);
      if (style && (style.position === 'fixed' || style.position === 'sticky')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }, 100);
}

export { EDITOR_CLASS, EDITOR_ATTR };
