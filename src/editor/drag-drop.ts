/**
 * DragDropManager - Enables drag and drop reordering of block elements.
 * Shows drag handles on hover and provides visual feedback during drag.
 */

import type { UndoManager } from '../undo/UndoManager';
import type { TextEditTracker } from '../undo/TextEditTracker';
import { ReorderCommand } from '../undo/commands/ReorderCommand';
import { captureDocumentSelection } from '../undo/SelectionUtils';
import { EDITOR_ATTR } from './inject';

// Block-level elements that can be dragged
const DRAGGABLE_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'FIGURE', 'PRE',
  'DIV', 'SECTION', 'ARTICLE',
]);

// SVG icons for drag handle
const DRAG_HANDLE_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <circle cx="5" cy="3" r="1.5"/>
  <circle cx="11" cy="3" r="1.5"/>
  <circle cx="5" cy="8" r="1.5"/>
  <circle cx="11" cy="8" r="1.5"/>
  <circle cx="5" cy="13" r="1.5"/>
  <circle cx="11" cy="13" r="1.5"/>
</svg>`;

export class DragDropManager {
  private iframe: HTMLIFrameElement;
  private undoManager: UndoManager;
  private textTracker: TextEditTracker | null;
  private onDirty: () => void;
  private doc: Document | null = null;

  // State
  private dragHandle: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  private draggingElement: Element | null = null;
  private dragStartParent: Element | null = null;
  private dragStartIndex: number = -1;
  private hoveredElement: Element | null = null;

  constructor(
    iframe: HTMLIFrameElement,
    undoManager: UndoManager,
    textTracker: TextEditTracker | null,
    onDirty: () => void
  ) {
    this.iframe = iframe;
    this.undoManager = undoManager;
    this.textTracker = textTracker;
    this.onDirty = onDirty;
  }

  /**
   * Attach drag-drop functionality to the iframe document.
   */
  attach(): void {
    const doc = this.iframe.contentDocument;
    if (!doc) return;

    this.doc = doc;

    // Inject styles
    this.injectStyles(doc);

    // Create drag handle element
    this.dragHandle = this.createDragHandle(doc);
    doc.body.appendChild(this.dragHandle);

    // Create drop indicator element
    this.dropIndicator = this.createDropIndicator(doc);
    doc.body.appendChild(this.dropIndicator);

    // Event listeners
    doc.addEventListener('mousemove', this.handleMouseMove);
    doc.addEventListener('mouseleave', this.handleMouseLeave);
    doc.addEventListener('dragstart', this.handleDragStart);
    doc.addEventListener('dragend', this.handleDragEnd);
    doc.addEventListener('dragover', this.handleDragOver);
    doc.addEventListener('drop', this.handleDrop);
  }

  /**
   * Remove drag-drop functionality.
   */
  detach(): void {
    if (!this.doc) return;

    this.doc.removeEventListener('mousemove', this.handleMouseMove);
    this.doc.removeEventListener('mouseleave', this.handleMouseLeave);
    this.doc.removeEventListener('dragstart', this.handleDragStart);
    this.doc.removeEventListener('dragend', this.handleDragEnd);
    this.doc.removeEventListener('dragover', this.handleDragOver);
    this.doc.removeEventListener('drop', this.handleDrop);

    this.dragHandle?.remove();
    this.dropIndicator?.remove();

    this.dragHandle = null;
    this.dropIndicator = null;
    this.doc = null;
  }

  private injectStyles(doc: Document): void {
    const style = doc.createElement('style');
    style.setAttribute(EDITOR_ATTR, 'drag-drop-style');
    style.textContent = `
      .hone-drag-handle {
        position: absolute;
        width: 20px;
        height: 24px;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: grab;
        color: #707070;
        background: rgba(30, 30, 30, 0.9);
        border-radius: 3px;
        z-index: 1000;
        transition: color 100ms ease, opacity 100ms ease;
        opacity: 0;
      }

      .hone-drag-handle:hover {
        color: #B8B8B8;
        opacity: 1;
      }

      .hone-drag-handle.visible {
        display: flex;
        opacity: 0.7;
      }

      .hone-drag-handle:active {
        cursor: grabbing;
      }

      .hone-dragging {
        opacity: 0.5;
        outline: 2px dashed rgba(92, 143, 255, 0.5) !important;
      }

      .hone-drop-indicator {
        position: absolute;
        height: 2px;
        background: #5C8FFF;
        pointer-events: none;
        z-index: 1001;
        display: none;
        box-shadow: 0 0 4px rgba(92, 143, 255, 0.5);
      }

      .hone-drop-indicator::before,
      .hone-drop-indicator::after {
        content: '';
        position: absolute;
        width: 8px;
        height: 8px;
        background: #5C8FFF;
        border-radius: 50%;
        top: -3px;
      }

      .hone-drop-indicator::before {
        left: -4px;
      }

      .hone-drop-indicator::after {
        right: -4px;
      }
    `;
    doc.head.appendChild(style);
  }

  private createDragHandle(doc: Document): HTMLElement {
    const handle = doc.createElement('div');
    handle.className = 'hone-drag-handle';
    handle.setAttribute(EDITOR_ATTR, 'drag-handle');
    handle.innerHTML = DRAG_HANDLE_SVG;
    handle.draggable = true;
    return handle;
  }

  private createDropIndicator(doc: Document): HTMLElement {
    const indicator = doc.createElement('div');
    indicator.className = 'hone-drop-indicator';
    indicator.setAttribute(EDITOR_ATTR, 'drop-indicator');
    return indicator;
  }

  /**
   * Find the draggable block element at a given point.
   */
  private findDraggableAtPoint(x: number, y: number): Element | null {
    if (!this.doc) return null;

    // Walk up from the element at point to find a draggable block
    let element = this.doc.elementFromPoint(x, y);

    while (element && element !== this.doc.body) {
      // Skip editor UI elements
      if (element.hasAttribute(EDITOR_ATTR)) {
        element = element.parentElement;
        continue;
      }

      // Check if this is a draggable block
      if (DRAGGABLE_TAGS.has(element.tagName) &&
          element.getAttribute('contenteditable') === 'true') {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  }

  /**
   * Position the drag handle next to an element.
   */
  private positionDragHandle(element: Element): void {
    if (!this.dragHandle || !this.doc) return;

    const rect = element.getBoundingClientRect();
    const scrollY = this.doc.documentElement.scrollTop || this.doc.body.scrollTop;
    const scrollX = this.doc.documentElement.scrollLeft || this.doc.body.scrollLeft;

    this.dragHandle.style.left = `${rect.left + scrollX - 24}px`;
    this.dragHandle.style.top = `${rect.top + scrollY + (rect.height / 2) - 12}px`;
    this.dragHandle.classList.add('visible');
  }

  /**
   * Hide the drag handle.
   */
  private hideDragHandle(): void {
    if (this.dragHandle) {
      this.dragHandle.classList.remove('visible');
    }
  }

  /**
   * Position the drop indicator between elements.
   */
  private positionDropIndicator(target: Element, position: 'before' | 'after'): void {
    if (!this.dropIndicator || !this.doc) return;

    const rect = target.getBoundingClientRect();
    const scrollY = this.doc.documentElement.scrollTop || this.doc.body.scrollTop;
    const scrollX = this.doc.documentElement.scrollLeft || this.doc.body.scrollLeft;

    const y = position === 'before' ? rect.top : rect.bottom;

    this.dropIndicator.style.left = `${rect.left + scrollX}px`;
    this.dropIndicator.style.top = `${y + scrollY - 1}px`;
    this.dropIndicator.style.width = `${rect.width}px`;
    this.dropIndicator.style.display = 'block';
  }

  private hideDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
  }

  // Event handlers (bound to preserve 'this')
  private handleMouseMove = (e: MouseEvent): void => {
    // Don't update handle position while dragging
    if (this.draggingElement) return;

    const element = this.findDraggableAtPoint(e.clientX, e.clientY);

    if (element && element !== this.hoveredElement) {
      this.hoveredElement = element;
      this.positionDragHandle(element);
    } else if (!element && this.hoveredElement) {
      this.hoveredElement = null;
      this.hideDragHandle();
    }
  };

  private handleMouseLeave = (): void => {
    if (!this.draggingElement) {
      this.hoveredElement = null;
      this.hideDragHandle();
    }
  };

  private handleDragStart = (e: DragEvent): void => {
    // Only handle drags from our drag handle
    if (e.target !== this.dragHandle) return;

    if (!this.hoveredElement || !this.doc) {
      e.preventDefault();
      return;
    }

    // Flush any pending text edits
    this.textTracker?.flush();

    // Store drag start state
    this.draggingElement = this.hoveredElement;
    this.dragStartParent = this.hoveredElement.parentElement;
    this.dragStartIndex = Array.from(this.dragStartParent!.childNodes)
      .indexOf(this.draggingElement as ChildNode);

    // Visual feedback
    this.draggingElement.classList.add('hone-dragging');
    this.hideDragHandle();

    // Set drag data
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', ''); // Required for Firefox

    // Create a drag image (clone of element)
    const clone = this.draggingElement.cloneNode(true) as HTMLElement;
    clone.style.width = `${this.draggingElement.getBoundingClientRect().width}px`;
    clone.style.opacity = '0.8';
    clone.style.position = 'absolute';
    clone.style.top = '-1000px';
    this.doc.body.appendChild(clone);
    e.dataTransfer!.setDragImage(clone, 0, 0);
    setTimeout(() => clone.remove(), 0);
  };

  private handleDragEnd = (): void => {
    if (this.draggingElement) {
      this.draggingElement.classList.remove('hone-dragging');
    }

    this.draggingElement = null;
    this.dragStartParent = null;
    this.dragStartIndex = -1;
    this.hideDropIndicator();
  };

  private handleDragOver = (e: DragEvent): void => {
    if (!this.draggingElement || !this.doc) return;

    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    // Find the element we're hovering over
    const target = this.findDraggableAtPoint(e.clientX, e.clientY);

    if (!target || target === this.draggingElement) {
      this.hideDropIndicator();
      return;
    }

    // Determine if we should drop before or after
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';

    this.positionDropIndicator(target, position);
  };

  private handleDrop = (e: DragEvent): void => {
    if (!this.draggingElement || !this.dragStartParent || !this.doc) return;

    e.preventDefault();

    // Find drop target
    const target = this.findDraggableAtPoint(e.clientX, e.clientY);
    if (!target || target === this.draggingElement) {
      return;
    }

    // Determine drop position
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;

    const newParent = target.parentElement!;
    let newIndex = Array.from(newParent.childNodes).indexOf(target as ChildNode);

    if (!insertBefore) {
      newIndex++;
    }

    // Don't create a command if position hasn't changed
    if (newParent === this.dragStartParent && newIndex === this.dragStartIndex) {
      return;
    }

    // Capture selection before the move
    const selectionBefore = captureDocumentSelection(this.doc);

    // Create and execute the reorder command
    const command = new ReorderCommand(
      this.draggingElement,
      this.dragStartParent,
      this.dragStartIndex,
      newParent,
      newIndex,
      selectionBefore
    );

    this.undoManager.execute(command);
    this.onDirty();

    // Re-record region states since DOM structure changed
    this.textTracker?.recordAllRegionStates();
  };
}
