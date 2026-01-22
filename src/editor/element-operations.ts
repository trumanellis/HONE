/**
 * Element Operations - delete, modify, convert elements
 */

import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Delete an element from the document
 * Handles proper cleanup and marks document as dirty
 */
export function deleteElement(
  element: HTMLElement,
  onDirty: () => void
): void {
  // Get parent to check if we should remove the parent too (e.g., empty list)
  const parent = element.parentElement;

  // Remove the element
  element.remove();

  // If parent is now empty and it's a list, remove it too
  if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) {
    if (parent.children.length === 0) {
      parent.remove();
    }
  }

  onDirty();
}

/**
 * Edit a link's URL and text
 */
export function editLink(
  link: HTMLAnchorElement,
  newUrl: string,
  newText: string | null,
  onDirty: () => void
): void {
  if (newUrl) {
    link.href = newUrl;
  }

  if (newText !== null && newText !== link.textContent) {
    link.textContent = newText;
  }

  onDirty();
}

/**
 * Create a new link wrapping selected text
 */
export function insertLink(
  doc: Document,
  url: string,
  onDirty: () => void
): void {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = range.toString();

  if (!text) return;

  // Create link element
  const link = doc.createElement('a');
  link.href = url;
  link.textContent = text;

  // Replace selection with link
  range.deleteContents();
  range.insertNode(link);

  // Clear selection
  selection.removeAllRanges();

  onDirty();
}

/**
 * Remove a link but keep its text content
 */
export function removeLink(
  link: HTMLAnchorElement,
  onDirty: () => void
): void {
  const parent = link.parentNode;
  if (!parent) return;

  // Replace link with its text content
  const textNode = link.ownerDocument.createTextNode(link.textContent || '');
  parent.replaceChild(textNode, link);

  onDirty();
}

/**
 * Replace an image with a new one (opens file dialog)
 */
export async function replaceImage(
  image: HTMLImageElement,
  dirPath: string,
  onDirty: () => void
): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
    ],
  });

  if (selected) {
    // Store original src in data attribute for round-trip
    if (!image.hasAttribute('data-original-src')) {
      image.setAttribute('data-original-src', image.getAttribute('src') || '');
    }

    // Calculate relative path if in same directory tree
    const imagePath = selected;
    let newSrc: string;

    if (imagePath.startsWith(dirPath)) {
      // Make relative path
      newSrc = imagePath.slice(dirPath.length + 1);
    } else {
      // Use absolute path converted to asset URL
      newSrc = convertFileSrc(imagePath);
    }

    image.src = newSrc;
    onDirty();
  }
}

/**
 * Remove an image element
 */
export function removeImage(
  image: HTMLImageElement,
  onDirty: () => void
): void {
  // If image is inside a figure, remove the whole figure
  const figure = image.closest('figure');
  if (figure) {
    figure.remove();
  } else {
    image.remove();
  }

  onDirty();
}

/**
 * Convert a block element to a different tag type
 * Preserves content and certain attributes
 */
export function convertBlock(
  element: HTMLElement,
  targetTag: string,
  onDirty: () => void
): void {
  const doc = element.ownerDocument;
  const newElement = doc.createElement(targetTag);

  // Copy inner HTML
  newElement.innerHTML = element.innerHTML;

  // Copy editor attributes
  const editId = element.getAttribute('data-hone-edit-id');
  if (editId) {
    newElement.setAttribute('data-hone-edit-id', editId);
  }

  // Copy contenteditable and class
  if (element.hasAttribute('contenteditable')) {
    newElement.setAttribute('contenteditable', 'true');
  }
  if (element.classList.contains('html-editor-editable')) {
    newElement.classList.add('html-editor-editable');
  }
  if (element.hasAttribute('data-html-editor')) {
    newElement.setAttribute('data-html-editor', 'true');
  }

  // Copy id if present
  if (element.id) {
    newElement.id = element.id;
  }

  // Replace in DOM
  element.parentNode?.replaceChild(newElement, element);

  onDirty();
}

/**
 * Convert list item between ordered and unordered
 */
export function toggleListType(
  listItem: HTMLLIElement,
  onDirty: () => void
): void {
  const parent = listItem.parentElement;
  if (!parent || (parent.tagName !== 'UL' && parent.tagName !== 'OL')) return;

  const doc = listItem.ownerDocument;
  const newParent = doc.createElement(parent.tagName === 'UL' ? 'ol' : 'ul');

  // Copy all children from old list to new list
  while (parent.firstChild) {
    newParent.appendChild(parent.firstChild);
  }

  // Replace old list with new one
  parent.parentNode?.replaceChild(newParent, parent);

  onDirty();
}
