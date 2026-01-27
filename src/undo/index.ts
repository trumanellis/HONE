/**
 * Unified Undo System - Public API
 */

export type { Command, SelectionState, UndoManagerListener } from './types';
export { UndoManager } from './UndoManager';
export { TextEditTracker } from './TextEditTracker';
export {
  captureSelection,
  restoreSelection,
  captureDocumentSelection,
  restoreDocumentSelection,
  getNodePath,
  getNodeFromPath,
  findEditableRoot,
} from './SelectionUtils';

// Commands
export { ImageReplaceCommand, ImageInsertCommand, ImageDeleteCommand } from './commands/ImageCommands';
export { TextEditCommand } from './commands/TextEditCommand';
export { ReorderCommand } from './commands/ReorderCommand';
