import { EDITOR_CLASS, EDITOR_ATTR } from "./inject";

/**
 * Extract clean HTML from the edited document
 * Removes all editor-injected attributes and elements
 */
export function extractCleanHtml(doc: Document, originalDoctype: string): string {
  // Clone the document to avoid modifying the live DOM
  const clone = doc.cloneNode(true) as Document;

  // Remove editor-injected styles
  const injectedStyles = clone.querySelectorAll(`[${EDITOR_ATTR}="style"]`);
  injectedStyles.forEach((el) => el.remove());

  // Remove editor attributes from all elements
  const editableElements = clone.querySelectorAll(`[${EDITOR_ATTR}]`);
  editableElements.forEach((el) => {
    el.removeAttribute("contenteditable");
    el.removeAttribute(EDITOR_ATTR);
    el.classList.remove(EDITOR_CLASS);

    // Clean up empty class attribute
    if (el.classList.length === 0) {
      el.removeAttribute("class");
    }
  });

  // Also clean any remaining contenteditable attributes (safety)
  const anyEditable = clone.querySelectorAll("[contenteditable]");
  anyEditable.forEach((el) => el.removeAttribute("contenteditable"));

  // Remove any base tag we may have injected
  const baseTag = clone.querySelector(`base[${EDITOR_ATTR}]`);
  if (baseTag) {
    baseTag.remove();
  }

  // Serialize the HTML
  const html = clone.documentElement.outerHTML;

  // Combine with doctype
  return originalDoctype + "\n" + html;
}

/**
 * Extract doctype from HTML string
 */
export function extractDoctype(html: string): string {
  const match = html.match(/^<!DOCTYPE[^>]*>/i);
  return match ? match[0] : "<!DOCTYPE html>";
}
