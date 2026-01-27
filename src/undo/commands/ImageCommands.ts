/**
 * Image-related undoable commands.
 */

import type { Command, SelectionState } from '../types';

/**
 * Command for replacing an image's source.
 * Stores the old and new src values for undo/redo.
 */
export class ImageReplaceCommand implements Command {
  readonly type = 'ImageReplace';

  private image: HTMLImageElement;
  private oldSrc: string;
  private newSrc: string;
  private oldOriginalSrc: string | null;
  private selectionBefore: SelectionState | null;
  private selectionAfter: SelectionState | null = null;

  constructor(
    image: HTMLImageElement,
    newSrc: string,
    selectionBefore: SelectionState | null
  ) {
    this.image = image;
    this.oldSrc = image.src;
    this.newSrc = newSrc;
    this.oldOriginalSrc = image.getAttribute('data-original-src');
    this.selectionBefore = selectionBefore;
  }

  execute(): void {
    // Store original src for round-trip preservation
    if (!this.image.hasAttribute('data-original-src')) {
      this.image.setAttribute('data-original-src', this.image.getAttribute('src') || '');
    }
    this.image.src = this.newSrc;
  }

  undo(): void {
    this.image.src = this.oldSrc;
    // Restore original data-original-src
    if (this.oldOriginalSrc !== null) {
      this.image.setAttribute('data-original-src', this.oldOriginalSrc);
    } else {
      this.image.removeAttribute('data-original-src');
    }
  }

  redo(): void {
    this.execute();
  }

  getSelectionBefore(): SelectionState | null {
    return this.selectionBefore;
  }

  getSelectionAfter(): SelectionState | null {
    return this.selectionAfter;
  }
}

/**
 * Command for inserting a new image.
 * Stores the insertion position and image src.
 */
export class ImageInsertCommand implements Command {
  readonly type = 'ImageInsert';

  private parent: Element;
  private insertIndex: number;
  private src: string;
  private image: HTMLImageElement | null = null;
  private selectionBefore: SelectionState | null;
  private selectionAfter: SelectionState | null = null;

  constructor(
    parent: Element,
    insertIndex: number,
    src: string,
    selectionBefore: SelectionState | null
  ) {
    this.parent = parent;
    this.insertIndex = insertIndex;
    this.src = src;
    this.selectionBefore = selectionBefore;
  }

  execute(): void {
    const doc = this.parent.ownerDocument;
    if (!doc) return;

    // Create the image element
    this.image = doc.createElement('img');
    this.image.src = this.src;
    this.image.alt = '';

    // Insert at the specified index
    const referenceNode = this.parent.childNodes[this.insertIndex] || null;
    this.parent.insertBefore(this.image, referenceNode);
  }

  undo(): void {
    if (this.image && this.image.parentNode) {
      this.image.remove();
    }
  }

  redo(): void {
    if (!this.image) {
      this.execute();
      return;
    }

    // Re-insert the same image element
    const referenceNode = this.parent.childNodes[this.insertIndex] || null;
    this.parent.insertBefore(this.image, referenceNode);
  }

  getSelectionBefore(): SelectionState | null {
    return this.selectionBefore;
  }

  getSelectionAfter(): SelectionState | null {
    return this.selectionAfter;
  }
}

/**
 * Command for deleting an image (or its containing figure).
 * Stores the removed element and its original position.
 */
export class ImageDeleteCommand implements Command {
  readonly type = 'ImageDelete';

  private parent: Element;
  private insertIndex: number;
  private removedElement: Element; // Either the image or its containing figure
  private selectionBefore: SelectionState | null;
  private selectionAfter: SelectionState | null = null;

  constructor(
    image: HTMLImageElement,
    selectionBefore: SelectionState | null
  ) {
    this.selectionBefore = selectionBefore;

    // Determine what to remove - the figure if image is inside one, otherwise the image
    const figure = image.closest('figure');
    this.removedElement = figure || image;
    this.parent = this.removedElement.parentElement!;
    this.insertIndex = Array.from(this.parent.childNodes).indexOf(this.removedElement as ChildNode);
  }

  execute(): void {
    this.removedElement.remove();
  }

  undo(): void {
    // Re-insert the removed element at its original position
    const referenceNode = this.parent.childNodes[this.insertIndex] || null;
    this.parent.insertBefore(this.removedElement, referenceNode);
  }

  redo(): void {
    this.execute();
  }

  getSelectionBefore(): SelectionState | null {
    return this.selectionBefore;
  }

  getSelectionAfter(): SelectionState | null {
    return this.selectionAfter;
  }
}
