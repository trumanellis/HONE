/**
 * UndoManager - Manages a stack of undoable commands.
 * Supports execute, undo, redo with proper selection restoration.
 */

import type { Command, UndoManagerListener } from './types';
import { restoreDocumentSelection } from './SelectionUtils';

export class UndoManager {
  private stack: Command[] = [];
  private index: number = -1; // Points to last executed command
  private maxSize: number;
  private listeners: Set<UndoManagerListener> = new Set();
  private doc: Document | null = null;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Set the document for selection restoration.
   */
  setDocument(doc: Document): void {
    this.doc = doc;
  }

  /**
   * Execute a new command and add it to the stack.
   * Clears any redo history.
   */
  execute(command: Command): void {
    // Execute the command
    command.execute();

    // Clear redo history (everything after current index)
    this.stack = this.stack.slice(0, this.index + 1);

    // Add the new command
    this.stack.push(command);
    this.index++;

    // Enforce max size
    while (this.stack.length > this.maxSize) {
      this.stack.shift();
      this.index--;
    }

    this.notifyListeners();
  }

  /**
   * Undo the last command.
   * Returns true if undo was performed, false if nothing to undo.
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.stack[this.index];
    command.undo();
    this.index--;

    // Restore selection to before state
    const selectionBefore = command.getSelectionBefore();
    if (selectionBefore && this.doc) {
      restoreDocumentSelection(this.doc, selectionBefore);
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Redo the next command.
   * Returns true if redo was performed, false if nothing to redo.
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.index++;
    const command = this.stack[this.index];
    command.redo();

    // Restore selection to after state
    const selectionAfter = command.getSelectionAfter();
    if (selectionAfter && this.doc) {
      restoreDocumentSelection(this.doc, selectionAfter);
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.index >= 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /**
   * Clear the entire undo/redo stack.
   */
  clear(): void {
    this.stack = [];
    this.index = -1;
    this.notifyListeners();
  }

  /**
   * Get the number of commands in the stack.
   */
  getStackSize(): number {
    return this.stack.length;
  }

  /**
   * Get the current index in the stack.
   */
  getIndex(): number {
    return this.index;
  }

  /**
   * Add a listener for state changes.
   */
  addListener(listener: UndoManagerListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener.
   */
  removeListener(listener: UndoManagerListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();

    for (const listener of this.listeners) {
      listener.onStateChange?.(canUndo, canRedo);
    }
  }
}
