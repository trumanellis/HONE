/**
 * Command for undoing/redoing text edits within a contenteditable region.
 * Captures the entire innerHTML of the region before and after changes.
 */

import type { Command, SelectionState } from '../types';

export class TextEditCommand implements Command {
  readonly type = 'TextEdit';

  private region: Element;
  private previousHTML: string;
  private newHTML: string;
  private selectionBefore: SelectionState | null;
  private selectionAfter: SelectionState | null;

  constructor(
    region: Element,
    previousHTML: string,
    newHTML: string,
    selectionBefore: SelectionState | null,
    selectionAfter: SelectionState | null
  ) {
    this.region = region;
    this.previousHTML = previousHTML;
    this.newHTML = newHTML;
    this.selectionBefore = selectionBefore;
    this.selectionAfter = selectionAfter;
  }

  execute(): void {
    // On initial execute, the DOM is already in the "new" state
    // This is called when pushing to the stack, but mutations have already happened
    // So this is essentially a no-op for the initial execute
    // The actual change happens via direct DOM manipulation (user typing)
  }

  undo(): void {
    this.region.innerHTML = this.previousHTML;
  }

  redo(): void {
    this.region.innerHTML = this.newHTML;
  }

  getSelectionBefore(): SelectionState | null {
    return this.selectionBefore;
  }

  getSelectionAfter(): SelectionState | null {
    return this.selectionAfter;
  }

  /**
   * Check if this command can be merged with another text edit command
   * (for batching rapid keystrokes into a single undo step)
   */
  canMergeWith(other: TextEditCommand): boolean {
    return this.region === other.region;
  }

  /**
   * Merge another text edit command into this one.
   * Updates the newHTML and selectionAfter to reflect the combined edit.
   */
  mergeWith(other: TextEditCommand): void {
    this.newHTML = other.newHTML;
    this.selectionAfter = other.selectionAfter;
  }
}
