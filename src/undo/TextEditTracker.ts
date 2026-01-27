/**
 * TextEditTracker - Tracks text edits using MutationObserver.
 * Batches rapid typing into single undo steps using debouncing.
 */

import type { UndoManager } from './UndoManager';
import type { SelectionState } from './types';
import { TextEditCommand } from './commands/TextEditCommand';
import { captureSelection } from './SelectionUtils';

interface PendingSnapshot {
  region: Element;
  html: string;
  selectionBefore: SelectionState | null;
}

export class TextEditTracker {
  private undoManager: UndoManager;
  private observer: MutationObserver;
  private pendingSnapshot: PendingSnapshot | null = null;
  private debounceTimer: number | null = null;
  private debounceMs: number;
  private isObserving: boolean = false;
  private root: Document;
  private onDirty: () => void;

  constructor(
    undoManager: UndoManager,
    root: Document,
    onDirty: () => void,
    debounceMs: number = 500
  ) {
    this.undoManager = undoManager;
    this.root = root;
    this.onDirty = onDirty;
    this.debounceMs = debounceMs;

    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }

  /**
   * Start observing the document for text mutations.
   */
  attach(): void {
    if (this.isObserving) return;

    this.observer.observe(this.root.body, {
      childList: true,
      characterData: true,
      subtree: true,
      characterDataOldValue: true,
    });

    this.isObserving = true;
  }

  /**
   * Stop observing mutations.
   */
  detach(): void {
    if (!this.isObserving) return;

    this.flush(); // Commit any pending changes
    this.observer.disconnect();
    this.isObserving = false;
  }

  /**
   * Temporarily pause tracking (e.g., during programmatic DOM changes).
   * Returns a function to resume tracking.
   */
  pause(): () => void {
    if (!this.isObserving) {
      return () => {};
    }

    this.flush();
    this.observer.disconnect();
    this.isObserving = false;

    return () => {
      this.attach();
    };
  }

  /**
   * Flush any pending snapshot to the undo stack.
   * Call this before executing structural commands (image replace, reorder, etc.)
   * to ensure text edits are properly ordered in the undo stack.
   */
  flush(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingSnapshot) {
      this.commitPendingSnapshot();
    }
  }

  /**
   * Handle mutations detected by the observer.
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // Find the contenteditable region that contains these mutations
    let editedRegion: Element | null = null;

    for (const mutation of mutations) {
      const target = mutation.target;

      // Find the contenteditable ancestor
      let node: Node | null = target;
      while (node && node !== this.root.body) {
        if (node instanceof Element && node.getAttribute('contenteditable') === 'true') {
          editedRegion = node;
          break;
        }
        node = node.parentNode;
      }

      if (editedRegion) break;
    }

    if (!editedRegion) return;

    // If we don't have a pending snapshot for this region, start one
    if (!this.pendingSnapshot || this.pendingSnapshot.region !== editedRegion) {
      // Flush any existing pending snapshot first
      this.flush();

      // We need the HTML from BEFORE the mutations.
      // Since we're in the mutation callback, the DOM is already changed.
      // We'll reconstruct the previous state by undoing character data changes.
      // For simplicity, we'll capture a "before" state on the first mutation
      // and update it going forward.

      // Actually, MutationObserver fires after the DOM has changed,
      // so we can't easily get the "before" state here.
      // The solution is to capture on focus/input start.

      // For now, we'll work with what we have - capture the current state
      // as the "new" state. The "before" state was captured on the previous flush
      // or this is the first edit.

      // Better approach: Track the last known "clean" state per region
      this.pendingSnapshot = {
        region: editedRegion,
        html: this.lastKnownHTML.get(editedRegion) || editedRegion.innerHTML,
        selectionBefore: this.lastKnownSelection,
      };
    }

    // Reset the debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.commitPendingSnapshot();
      this.debounceTimer = null;
    }, this.debounceMs);

    // Mark as dirty immediately
    this.onDirty();
  }

  /**
   * Storage for the last known HTML state of each region.
   * Used to track the "before" state for text edit commands.
   */
  private lastKnownHTML: Map<Element, string> = new Map();
  private lastKnownSelection: SelectionState | null = null;

  /**
   * Record the current state of a region as the "before" state.
   * Call this when focus enters a region or after structural operations.
   */
  recordRegionState(region: Element): void {
    this.lastKnownHTML.set(region, region.innerHTML);
    this.lastKnownSelection = captureSelection(region);
  }

  /**
   * Record states for all contenteditable regions.
   */
  recordAllRegionStates(): void {
    const regions = this.root.querySelectorAll('[contenteditable="true"]');
    for (const region of regions) {
      this.lastKnownHTML.set(region, region.innerHTML);
    }
  }

  /**
   * Commit the pending snapshot as a TextEditCommand.
   */
  private commitPendingSnapshot(): void {
    if (!this.pendingSnapshot) return;

    const { region, html: previousHTML, selectionBefore } = this.pendingSnapshot;
    const newHTML = region.innerHTML;

    // Don't create a command if nothing changed
    if (previousHTML === newHTML) {
      this.pendingSnapshot = null;
      return;
    }

    const selectionAfter = captureSelection(region);

    const command = new TextEditCommand(
      region,
      previousHTML,
      newHTML,
      selectionBefore,
      selectionAfter
    );

    // Push to undo stack (but don't execute - the DOM is already in the new state)
    // We need a special path for this since execute() is a no-op for TextEditCommand
    this.undoManager.execute(command);

    // Update the last known state
    this.lastKnownHTML.set(region, newHTML);
    this.lastKnownSelection = selectionAfter;
    this.pendingSnapshot = null;
  }

  /**
   * Clear all tracked state.
   */
  clear(): void {
    this.flush();
    this.lastKnownHTML.clear();
    this.lastKnownSelection = null;
  }
}
