/**
 * Command for reordering elements via drag and drop.
 * Stores the element reference and its old/new positions.
 */

import type { Command, SelectionState } from '../types';

export class ReorderCommand implements Command {
  readonly type = 'Reorder';

  private element: Element;
  private oldParent: Element;
  private oldIndex: number;
  private newParent: Element;
  private newIndex: number;
  private selectionBefore: SelectionState | null;
  private selectionAfter: SelectionState | null = null;

  constructor(
    element: Element,
    oldParent: Element,
    oldIndex: number,
    newParent: Element,
    newIndex: number,
    selectionBefore: SelectionState | null
  ) {
    this.element = element;
    this.oldParent = oldParent;
    this.oldIndex = oldIndex;
    this.newParent = newParent;
    this.newIndex = newIndex;
    this.selectionBefore = selectionBefore;
  }

  execute(): void {
    // Move element to new position
    const referenceNode = this.newParent.childNodes[this.newIndex] || null;

    // If moving within the same parent and the new index is after the old index,
    // we need to account for the element being removed first
    if (this.oldParent === this.newParent && this.newIndex > this.oldIndex) {
      const adjustedRef = this.newParent.childNodes[this.newIndex + 1] || null;
      this.newParent.insertBefore(this.element, adjustedRef);
    } else {
      this.newParent.insertBefore(this.element, referenceNode);
    }
  }

  undo(): void {
    // Move element back to old position
    const referenceNode = this.oldParent.childNodes[this.oldIndex] || null;
    this.oldParent.insertBefore(this.element, referenceNode);
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
