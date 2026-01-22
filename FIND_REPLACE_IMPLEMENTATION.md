# Find & Replace Implementation for HONE

## Overview

A fully functional Find & Replace dialog has been implemented for the HONE editor. The implementation follows the existing design system and architecture patterns.

## Architecture

### Component Structure

**File**: `src/editor/find-replace.ts`
- **FindReplaceBar class**: Main component managing the find/replace UI and logic
- **Positioning**: Fixed bar at top of `#editor-container` (not a modal)
- **Integration**: Works with iframe-based content display
- **Search Algorithm**: Uses TreeWalker API to traverse text nodes and RegExp for matching

### Key Features

1. **Find Mode (Cmd+F)**
   - Text input with real-time search
   - Next/Previous navigation buttons
   - Match count display
   - Case-sensitive toggle
   - Highlights all matches in yellow
   - Current match highlighted in darker yellow with outline

2. **Replace Mode (Cmd+H or Cmd+Shift+F)**
   - All Find mode features
   - Additional replace input field
   - Replace single match button
   - Replace all matches button

3. **Keyboard Shortcuts**
   - `Cmd+F`: Open Find bar
   - `Cmd+H` or `Cmd+Shift+F`: Open Find & Replace bar
   - `Enter` in find input: Go to next match
   - `Shift+Enter` in find input: Go to previous match
   - `Escape`: Close the bar

4. **Smart Features**
   - Auto-populates search with selected text (if any)
   - Smooth scrolling to matches
   - Wraps around when reaching end/start of document
   - Clears highlights when closing
   - Updates match count in real-time
   - Marks document as dirty after replacements

## Files Modified

### 1. `src/editor/find-replace.ts` (NEW)
Complete Find & Replace component implementation with:
- Text search using TreeWalker API
- Match highlighting with `<mark>` elements
- Navigation between matches
- Replace functionality
- Case-sensitive search toggle

### 2. `src/main.ts`
Added:
- Import for FindReplaceBar
- Global `findReplaceBar` variable
- `initializeFindReplaceBar()` function
- `openFindBar(mode)` function
- Keyboard shortcuts for Cmd+F, Cmd+H, Cmd+Shift+F, and Escape
- Integration in `loadFile()` function

### 3. `src/styles/editor.css`
Added:
- `.find-replace-bar` styles
- Input field styles matching design system
- Button styles consistent with toolbar
- Match count display styles
- Highlight styles for iframe content (`iframe mark.hone-find-highlight`)
- Made `#editor-container` position: relative for absolute positioning

### 4. `index.html`
Updated welcome screen shortcuts to include:
- Cmd+F for find
- Cmd+H for find & replace
- ESC to close find

## Design System Compliance

### Colors (from tokens.css)
- Background: `var(--color-steel)` (#1E1E1E)
- Inputs: `var(--color-obsidian)` (#141414)
- Borders: `var(--color-edge)` (#2A2A2A)
- Text: `var(--color-blade)` (#E8E8E8)
- Labels: `var(--color-polish)` (#B8B8B8)
- Match highlight: `rgba(92, 143, 255, 0.3)` (light blue)
- Current match: `rgba(92, 143, 255, 0.7)` (darker blue)
- Active button: `var(--color-hone-blue)` (#5C8FFF)

### Typography
- Font: `var(--font-mono)` (JetBrains Mono)
- Size: `var(--text-label)` (12px)

### Spacing
- Padding: `var(--space-sm)` (8px)
- Gap: `var(--space-sm)` (8px)

### Motion
- Transitions: `var(--duration-fast)` (150ms)
- Easing: `var(--ease-out)`

## Technical Implementation Details

### Search Algorithm

1. **Text Traversal**: Uses `TreeWalker` with `NodeFilter.SHOW_TEXT` to find all text nodes
2. **Filtering**: Skips script, style, and existing mark elements
3. **Matching**: RegExp with 'g' flag (or 'gi' for case-insensitive)
4. **Highlighting**: Wraps matches in `<mark class="hone-find-highlight" data-match-index="N">`
5. **Navigation**: Queries marks by data-match-index and scrolls with `scrollIntoView()`

### Replace Logic

1. **Single Replace**: Replaces the current (highlighted) match only
2. **Replace All**: Iterates through all marks and replaces each
3. **DOM Cleanup**: Calls `normalize()` to merge adjacent text nodes
4. **State Update**: Triggers 'input' event to mark document as dirty

### Edge Cases Handled

- Empty search query: Clears highlights, shows no matches
- No matches: Displays "no matches" instead of count
- Iframe not loaded: Checks `state.contentFrame` before operations
- Multiple consecutive replacements: Re-runs find after each replace
- Special regex characters: Escapes pattern before creating RegExp
- Circular navigation: Uses modulo arithmetic for wrap-around

## Usage

### For Users

1. Open a file in HONE
2. Press `Cmd+F` to search
3. Type search term (optional: click Aa for case-sensitive)
4. Use ↑↓ buttons or Enter/Shift+Enter to navigate
5. Press `Cmd+H` for find & replace
6. Enter replacement text
7. Click "replace" or "replace all"
8. Press `Escape` to close

### For Developers

```typescript
// Initialize (called automatically when file loads)
initializeFindReplaceBar();

// Open programmatically
openFindBar('find');      // Opens find mode
openFindBar('replace');   // Opens replace mode

// Access instance
if (findReplaceBar) {
  findReplaceBar.setIframe(iframe);
  findReplaceBar.open('find');
  findReplaceBar.close();
  findReplaceBar.isOpen();
  findReplaceBar.destroy();
}
```

## Testing Checklist

- [x] Build succeeds without errors
- [ ] Cmd+F opens Find bar
- [ ] Cmd+H opens Find & Replace bar
- [ ] Escape closes the bar
- [ ] Search highlights matches
- [ ] Next/Previous navigation works
- [ ] Match count displays correctly
- [ ] Case-sensitive toggle works
- [ ] Replace single match works
- [ ] Replace all works
- [ ] Document marked dirty after replace
- [ ] Selected text pre-fills search
- [ ] Works with both HTML and Markdown files
- [ ] Highlights scroll into view smoothly
- [ ] Bar positioned correctly at top of editor

## Future Enhancements

Possible improvements for future versions:
- Whole word matching toggle
- Regular expression search mode
- Search history/recent searches
- Find in selection
- Persistent search options
- Search results panel
- Incremental find-as-you-type feedback
- Undo for replace all operation
