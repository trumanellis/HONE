/**
 * Utilities for capturing and restoring selection state.
 * Uses path-based addressing to survive DOM mutations.
 */

import type { SelectionState } from './types';

/**
 * Compute the path from a root element to a descendant node.
 * The path is an array of child indices at each level.
 */
export function getNodePath(root: Element, node: Node): number[] {
  const path: number[] = [];
  let current: Node | null = node;

  while (current && current !== root) {
    const parent: ParentNode | null = current.parentNode;
    if (!parent) break;

    const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
    if (index === -1) break;

    path.unshift(index);
    current = parent as Node;
  }

  // If we didn't reach the root, the node is not a descendant
  if (current !== root) {
    return [];
  }

  return path;
}

/**
 * Get a node from a path relative to a root element.
 * Returns null if the path is invalid or out of bounds.
 */
export function getNodeFromPath(root: Element, path: number[]): Node | null {
  let current: Node = root;

  for (const index of path) {
    if (!current.childNodes || index >= current.childNodes.length || index < 0) {
      return null;
    }
    current = current.childNodes[index];
  }

  return current;
}

/**
 * Capture the current selection state relative to a root element.
 * Returns null if there's no selection or it's outside the root.
 */
export function captureSelection(root: Element): SelectionState | null {
  const doc = root.ownerDocument;
  if (!doc) return null;

  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;

  if (!anchorNode || !focusNode) return null;

  // Check if selection is within the root
  if (!root.contains(anchorNode) || !root.contains(focusNode)) {
    return null;
  }

  const anchorPath = getNodePath(root, anchorNode);
  const focusPath = getNodePath(root, focusNode);

  // If either path is empty, the node isn't a descendant of root
  if (anchorPath.length === 0 && anchorNode !== root) return null;
  if (focusPath.length === 0 && focusNode !== root) return null;

  return {
    anchorPath,
    anchorOffset: selection.anchorOffset,
    focusPath,
    focusOffset: selection.focusOffset,
  };
}

/**
 * Restore a selection state within a root element.
 * Silently fails if the paths are no longer valid.
 */
export function restoreSelection(root: Element, state: SelectionState): void {
  const doc = root.ownerDocument;
  if (!doc) return;

  const selection = doc.getSelection();
  if (!selection) return;

  const anchorNode = state.anchorPath.length === 0 ? root : getNodeFromPath(root, state.anchorPath);
  const focusNode = state.focusPath.length === 0 ? root : getNodeFromPath(root, state.focusPath);

  if (!anchorNode || !focusNode) return;

  // Validate offsets
  const anchorMaxOffset = anchorNode.nodeType === Node.TEXT_NODE
    ? (anchorNode as Text).length
    : anchorNode.childNodes.length;
  const focusMaxOffset = focusNode.nodeType === Node.TEXT_NODE
    ? (focusNode as Text).length
    : focusNode.childNodes.length;

  const safeAnchorOffset = Math.min(state.anchorOffset, anchorMaxOffset);
  const safeFocusOffset = Math.min(state.focusOffset, focusMaxOffset);

  try {
    selection.removeAllRanges();
    const range = doc.createRange();
    range.setStart(anchorNode, safeAnchorOffset);
    range.setEnd(focusNode, safeFocusOffset);

    // If anchor comes after focus, we need to use setBaseAndExtent for proper direction
    if (state.anchorPath.toString() !== state.focusPath.toString() ||
        state.anchorOffset !== state.focusOffset) {
      selection.setBaseAndExtent(
        anchorNode,
        safeAnchorOffset,
        focusNode,
        safeFocusOffset
      );
    } else {
      selection.addRange(range);
    }
  } catch {
    // Selection restoration failed - silently ignore
    // This can happen if DOM structure has changed significantly
  }
}

/**
 * Find the contenteditable root containing a node.
 */
export function findEditableRoot(node: Node): Element | null {
  let current: Node | null = node;

  while (current) {
    if (current instanceof Element && current.getAttribute('contenteditable') === 'true') {
      return current;
    }
    current = current.parentNode;
  }

  return null;
}

/**
 * Capture selection relative to the document body (for structural operations).
 */
export function captureDocumentSelection(doc: Document): SelectionState | null {
  return captureSelection(doc.body);
}

/**
 * Restore selection relative to the document body.
 */
export function restoreDocumentSelection(doc: Document, state: SelectionState): void {
  restoreSelection(doc.body, state);
}
