/**
 * Core types for the unified undo system
 */

/**
 * Represents the cursor/selection state within a contenteditable region.
 * Uses path-based addressing to survive DOM mutations.
 */
export interface SelectionState {
  /** Path from contenteditable root to anchor node (array of child indices) */
  anchorPath: number[];
  /** Offset within the anchor node */
  anchorOffset: number;
  /** Path from contenteditable root to focus node */
  focusPath: number[];
  /** Offset within the focus node */
  focusOffset: number;
}

/**
 * Base interface for all undoable commands.
 * Commands encapsulate both the action and its inverse.
 */
export interface Command {
  /** Unique type identifier for debugging/logging */
  readonly type: string;

  /** Execute the command (apply the change) */
  execute(): void;

  /** Undo the command (revert the change) */
  undo(): void;

  /** Redo the command (re-apply after undo) */
  redo(): void;

  /** Selection state before the command was executed */
  getSelectionBefore(): SelectionState | null;

  /** Selection state after the command was executed */
  getSelectionAfter(): SelectionState | null;
}

/**
 * Callback for undo manager state changes
 */
export interface UndoManagerListener {
  /** Called when undo/redo availability changes */
  onStateChange?(canUndo: boolean, canRedo: boolean): void;
}
