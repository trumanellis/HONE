import type { EditableRegion } from './html-parser';

const EDITOR_CLASS = "html-editor-editable";
const EDITOR_ATTR = "data-html-editor";

/**
 * Inject edit IDs and contenteditable attributes into browser DOM elements.
 * Walks the DOM in document order, matching elements by tag name sequence
 * to align with the AST-derived regions.
 */
export function injectEditableRegions(doc: Document, regions: EditableRegion[]): void {
  // Track how many of each tag we've seen to match DOM order to AST order
  const tagCounts: Record<string, number> = {};

  for (const region of regions) {
    const count = tagCounts[region.tagName] || 0;
    const elements = doc.querySelectorAll(region.tagName);

    if (count < elements.length) {
      const el = elements[count];
      el.setAttribute('data-hone-edit-id', region.id);
      el.setAttribute('contenteditable', 'true');
      el.classList.add(EDITOR_CLASS);
      el.setAttribute(EDITOR_ATTR, 'true');
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
