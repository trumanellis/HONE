<p align="center">
  <img src="icon-source.png" alt="HONE" width="120" />
</p>

<h1 align="center">HONE</h1>

<p align="center">
  <strong>The human pass on AI-generated content.</strong>
</p>

<p align="center">
  Open HTML or Markdown. See it rendered. Make it right.
</p>

<p align="center">
  <a href="https://github.com/trumanellis/HONE/releases/latest">
    <img src="https://img.shields.io/github/v/release/trumanellis/HONE?style=for-the-badge&label=Download&color=5C8FFF" alt="Download" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/trumanellis/HONE/releases/latest">macOS</a> •
  <a href="https://github.com/trumanellis/HONE/releases/latest">Windows</a> •
  <a href="https://github.com/trumanellis/HONE/releases/latest">Linux</a>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#philosophy">Philosophy</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## The Problem

AI can generate HTML and Markdown in seconds. But it's never *quite* right.

The spacing is off. The copy needs a tweak. That button should be over *there*. You know it when you see it — but you need to *see* it first.

So you open the file in a browser. Then open it in an editor. Then refresh. Then edit. Then refresh. Then lose your place. Then fix the wrong line. Then refresh again.

**This is friction where there should be flow.**

## The Solution

HONE opens your HTML or Markdown file as a fully rendered page. Click any element. Edit it directly. Save. Done.

No split panes. No context switching. No refresh cycle.

You see what your users will see, and you fix what needs fixing.

---

## Features

### Core Editing
- **Open HTML & Markdown** — Native file dialog or drag-and-drop to open `.html`, `.htm`, `.md`, or `.markdown` files
- **Inline Editing** — Click any text element to edit directly in the rendered view
- **Undo/Redo** — Full undo/redo support via toolbar buttons or keyboard shortcuts
- **Find & Replace** — Search and replace text across the document (⌘F / ⌘H)

### Element Operations (Right-Click Menu)
- **Delete Elements** — Remove paragraphs, images, sections, or any element
- **Edit Links** — Click any link to edit its URL and text, or remove it entirely
- **Insert Links** — Add links to selected text
- **Replace/Remove Images** — Swap images for different ones or remove them
- **Convert Blocks** — Transform paragraphs to headings, change heading levels, convert list types

### File Management
- **Multiple File Tabs** — Open and switch between multiple files in a vertical sidebar
- **Recent Files** — Quick access to recently opened files from the welcome screen
- **Drag-to-Open** — Drag HTML or Markdown files onto the window to open
- **Save/Save As** — Save changes back to the original file or export a copy
- **Format Conversion** — Open HTML, save as Markdown (or vice versa)

### Markdown Support
- **Round-trip Editing** — Edit rendered Markdown visually, save back as Markdown
- **Frontmatter Preservation** — YAML frontmatter is preserved when editing
- **Image Support** — Images load correctly from relative paths

### Quality of Life
- **Unsaved Changes Warning** — Prevents accidental data loss with visual indicators
- **Rich Paste** — Paste HTML content from clipboard (sanitized for safety)
- **Surgical HTML Editing** — Only modified text is changed; formatting and structure preserved

---

## Installation

### Download

Download the latest build for your platform from [Releases](https://github.com/trumanellis/HONE/releases):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `HONE_x.x.x_aarch64.dmg` |
| macOS (Intel) | `HONE_x.x.x_x64.dmg` |
| Windows | `HONE_x.x.x_x64-setup.exe` or `.msi` |
| Linux | `HONE_x.x.x_amd64.deb` or `.AppImage` |

### Install

**macOS**: Open the `.dmg` and drag HONE to Applications.

**Windows**: Run the `.exe` installer or `.msi`.

**Linux**: Install the `.deb` with `sudo dpkg -i hone_*.deb` or run the `.AppImage` directly.

### Build from Source

```bash
git clone https://github.com/trumanellis/HONE.git
cd HONE
npm install
npm run tauri build
```

---

## Usage

### Opening Files

1. **Click "open"** in the toolbar (or ⌘O)
2. **Drag and drop** HTML or Markdown files onto the window
3. **Click a recent file** from the welcome screen

### Editing

- **Click any text** to edit it directly
- **Right-click any element** to access the context menu:
  - Delete the element
  - Edit, insert, or remove links
  - Replace or remove images
  - Convert between headings, paragraphs, and lists
- **Use ⌘F** to find text, **⌘H** to find and replace

### Saving

- **⌘S** saves to the original file
- **⌘⇧S** lets you save as a new file (including format conversion)

### Keyboard Shortcuts

#### File Operations

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+O | Open file |
| ⌘/Ctrl+S | Save |
| ⌘/Ctrl+Shift+S | Save As |
| ⌘/Ctrl+W | Close tab |

#### Edit Operations

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |

#### Find & Replace

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+F | Find |
| ⌘/Ctrl+H | Find & Replace |
| Enter | Next match |
| Shift+Enter | Previous match |
| Escape | Close find bar |

---

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Architecture

| Layer | Stack |
|-------|-------|
| Frontend | TypeScript + Vite |
| Backend | Rust (Tauri 2.0) |
| Editing | `contenteditable` on block-level elements (p, h1-h6, li, td, etc.) |

### Project Structure

```
hone/
├── src/                    # Frontend TypeScript
│   ├── main.ts            # Main editor logic
│   ├── types/
│   │   └── editor.ts      # TypeScript types
│   ├── editor/
│   │   ├── inject.ts      # Contenteditable injection
│   │   ├── html-parser.ts # AST-based HTML parsing
│   │   ├── markdown.ts    # Markdown parsing/serialization
│   │   ├── toolbar.ts     # Toolbar UI
│   │   ├── tabs.ts        # Multi-tab management
│   │   ├── find-replace.ts # Find & Replace functionality
│   │   ├── context-menu.ts # Right-click context menu
│   │   └── element-operations.ts # Delete, link, image ops
│   └── styles/
│       ├── tokens.css     # Design tokens
│       └── editor.css     # Main styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Tauri commands (file I/O, recent files)
│   │   └── main.rs
│   └── tauri.conf.json
└── test-files/            # Sample HTML for testing
```

### Security Note

CSP is configured to allow loading local assets via Tauri's asset protocol. The iframe sandbox restricts script execution in loaded documents.

---

## Philosophy

HONE exists because of a simple observation:

> AI is good at generating. Humans are good at discerning.

The best workflow isn't human *or* AI — it's AI generating candidates and humans selecting and refining. But our tools still assume humans are doing everything from scratch.

HONE is built for the **refinement step**. The part where you take something 90% right and make it 100% right. The part that requires taste, context, and the ability to *see* what you're doing.

We call this the **HONE** workflow:

1. Generate HTML or Markdown with your AI tool of choice
2. Open it in HONE
3. See it as your users will
4. Make the small adjustments that make it yours
5. Ship

No friction. No context switching. Just the final pass that brings it to edge.

---

## Roadmap

### v1.0 — Current Release
- [x] Open and render local HTML files
- [x] Open and render Markdown files with live preview
- [x] Round-trip Markdown editing (edit visually, save as Markdown)
- [x] Frontmatter preservation for Markdown
- [x] Inline text editing with contenteditable
- [x] Save back to source file
- [x] Relative asset path support (images in HTML and Markdown)
- [x] Multiple file tabs with vertical sidebar
- [x] Recent files menu on welcome screen
- [x] Drag-and-drop file opening
- [x] Find & Replace (⌘F / ⌘H)
- [x] Element deletion via context menu
- [x] Link editing (edit URL/text, insert, remove)
- [x] Image replace/remove via context menu
- [x] Block conversion (paragraphs ↔ headings ↔ lists)
- [x] Rich clipboard paste support
- [x] Format conversion (HTML ↔ Markdown)
- [x] Surgical HTML editing (preserves formatting)
- [x] Undo/Redo toolbar buttons
- [x] Cross-platform builds (macOS, Windows, Linux)

### v1.1 — Next
- [ ] Class and attribute editing panel
- [ ] Inline style adjustments
- [ ] Element reordering via drag
- [ ] CSS file awareness and editing

### Future
- [ ] Template/component extraction
- [ ] Custom keyboard shortcuts
- [ ] Plugin system
- [ ] AI-assisted suggestions (opt-in, local models preferred)
- [ ] Static site generator integrations
- [ ] Asset management

---

## Part of Synchronicity Engine

HONE is one piece of a larger ecosystem of tools for regenerative technology — software built to support human flourishing rather than extract from it.

Learn more at [syncengine.earth](https://syncengine.earth)

---

## Contributing

HONE is open source under the MIT license.

The best way to contribute right now is to **use it and report what breaks**. File issues with:
- What you were trying to do
- What happened instead
- The HTML file if you can share it (or a minimal reproduction)

Code contributions welcome once we stabilize the core editing loop. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT © Truman Ellis

---

<p align="center">
  <sub>A blade is not made sharp by force, but by patience and precision.</sub>
</p>
