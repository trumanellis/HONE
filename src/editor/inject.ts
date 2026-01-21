// Elements that should be made contenteditable
const EDITABLE_SELECTORS = [
  "p",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "li",
  "td", "th",
  "blockquote",
  "figcaption",
  "dt", "dd",
  "label",
  "legend",
  "summary",
  "span", // Only direct text containers
  "a",
].join(", ");

const EDITOR_CLASS = "html-editor-editable";
const EDITOR_ATTR = "data-html-editor";

/**
 * Inject contenteditable attributes into block-level text elements
 */
export function injectEditable(doc: Document): void {
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
