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

- **Open HTML & Markdown** — Native file dialog to open `.html`, `.htm`, `.md`, or `.markdown` files
- **Inline Editing** — Click any text element to edit directly in the rendered view
- **Text Formatting** — Bold, italic, underline with familiar shortcuts (Markdown-aware)
- **Save/Save As** — Save changes back to the original file or export a copy
- **Round-trip Markdown** — Edit rendered Markdown visually, save back as Markdown
- **Frontmatter Preservation** — YAML frontmatter is preserved when editing Markdown
- **Image Support** — Images load correctly from relative paths in both HTML and Markdown
- **Unsaved Changes Warning** — Prevents accidental data loss

---

## Installation

### From Releases

Download the latest build for your platform from [Releases](https://github.com/trumanellis/HONE/releases).

### Build from Source

```bash
git clone https://github.com/trumanellis/HONE.git
cd HONE
npm install
npm run tauri build
```

---

## Usage

```bash
# Open an HTML file
hone index.html

# Open a Markdown file
hone README.md

# Open the current directory's index
hone .
```

Or drag an HTML or Markdown file onto the app icon.

### Keyboard Shortcuts

#### File Operations

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+O | Open file |
| ⌘/Ctrl+S | Save |
| ⌘/Ctrl+Shift+S | Save As |

#### Text Formatting

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+B | Bold |
| ⌘/Ctrl+I | Italic |
| ⌘/Ctrl+U | Underline |
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |

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
│   ├── editor/
│   │   ├── inject.ts      # Contenteditable injection
│   │   ├── extract.ts     # Clean HTML extraction
│   │   └── toolbar.ts     # Toolbar UI
│   └── styles/
│       └── editor.css
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Tauri commands
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

### v0.1 — Now
- [x] Open and render local HTML files
- [x] Open and render Markdown files with live preview
- [x] Round-trip Markdown editing (edit visually, save as Markdown)
- [x] Frontmatter preservation for Markdown
- [x] Inline text editing with contenteditable
- [x] Text formatting (bold, italic, underline)
- [x] Save back to source file
- [x] Relative asset path support (images in HTML and Markdown)

### v0.2 — Next
- [ ] Class and attribute editing panel
- [ ] Inline style adjustments
- [ ] Element reordering via drag
- [ ] Multiple file tabs

### v0.3 — Later
- [ ] CSS file awareness and editing
- [ ] Template/component extraction
- [ ] Custom keyboard shortcuts
- [ ] Plugin system

### Future
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

MIT © [Your Name]

---

<p align="center">
  <sub>A blade is not made sharp by force, but by patience and precision.</sub>
</p>
