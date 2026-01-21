# HONE Design System

> A blade is not made sharp by force, but by patience and precision.

## Brand Essence

HONE is the human touch on AI output. The tool that takes generated work and brings it to its final edge. The design language reflects this: **precise, minimal, quietly powerful**.

---

## Logo Analysis

The mark is a stylized **H** formed by two angular blade-like verticals connected by a horizontal bar. The sparkle at the crossbar represents the moment of sharpening — where refinement happens.

**Key attributes:**
- Angular cuts suggest blade geometry
- Metallic surface implies tool, craft
- Single sparkle = precision, not decoration
- Black field = focus, no distraction

---

## Color Palette

### Primary (Dark Mode First)

| Name | Hex | Usage |
|------|-----|-------|
| Void | `#0A0A0A` | Primary background |
| Obsidian | `#141414` | Secondary background, panels |
| Steel | `#1E1E1E` | Elevated surfaces, cards |
| Edge | `#2A2A2A` | Borders, dividers |

### Metallic Accent

| Name | Hex | Usage |
|------|-----|-------|
| Blade | `#E8E8E8` | Primary text |
| Polish | `#B8B8B8` | Secondary text |
| Worn | `#707070` | Muted text, placeholders |
| Spark | `#FFFFFF` | Highlights, focus states |

### Functional

| Name | Hex | Usage |
|------|-----|-------|
| HONE Blue | `#5C8FFF` | Interactive elements, links |
| Forge | `#FF6B4A` | Destructive actions, errors |
| Temper | `#4ADE80` | Success states |
| Caution | `#FACC15` | Warnings |

### Light Mode (Secondary)

| Name | Hex | Usage |
|------|-----|-------|
| Parchment | `#FAFAFA` | Primary background |
| Linen | `#F0F0F0` | Secondary background |
| Graphite | `#1A1A1A` | Primary text |
| Slate | `#525252` | Secondary text |

---

## Typography

### Font Stack

```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Primary:** JetBrains Mono — for code, UI labels, the main interface
**Secondary:** Inter — for longer prose, documentation

### Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 32px | 600 | 1.1 | App title, hero text |
| Heading | 20px | 600 | 1.2 | Section headers |
| Body | 14px | 400 | 1.5 | Default text |
| Label | 12px | 500 | 1.4 | UI labels, buttons |
| Caption | 11px | 400 | 1.4 | Metadata, hints |

### Principles

- **Monospace by default** — this is a tool for working with code
- **No bold in body text** — use color or spacing for emphasis
- **Tight tracking** — professional, dense, no wasted space

---

## Spacing & Layout

### Base Unit

`4px` — all spacing derives from this

### Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps, icon padding |
| `sm` | 8px | Related element spacing |
| `md` | 16px | Component internal padding |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Major divisions |
| `2xl` | 48px | Page-level spacing |

### Layout Principles

- **Dense but breathable** — maximize content, minimal chrome
- **Edge-to-edge** — content should feel like it extends beyond the viewport
- **Asymmetric tension** — allow elements to sit off-grid for visual interest

---

## Components

### Buttons

```css
/* Primary */
.btn-primary {
  background: #E8E8E8;
  color: #0A0A0A;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.btn-primary:hover {
  background: #FFFFFF;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
}

/* Secondary */
.btn-secondary {
  background: transparent;
  color: #B8B8B8;
  border: 1px solid #2A2A2A;
  border-radius: 4px;
}

.btn-secondary:hover {
  border-color: #E8E8E8;
  color: #E8E8E8;
}
```

### Inputs

```css
.input {
  background: #141414;
  border: 1px solid #2A2A2A;
  border-radius: 4px;
  padding: 10px 12px;
  color: #E8E8E8;
  font-family: var(--font-mono);
  font-size: 14px;
}

.input:focus {
  border-color: #5C8FFF;
  outline: none;
  box-shadow: 0 0 0 2px rgba(92, 143, 255, 0.15);
}

.input::placeholder {
  color: #707070;
}
```

### Cards / Panels

```css
.panel {
  background: #141414;
  border: 1px solid #1E1E1E;
  border-radius: 6px;
  padding: 16px;
}

.panel-elevated {
  background: #1E1E1E;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}
```

### Editor Surface

The HTML preview area should feel like a **light table** — the surface where work happens:

```css
.editor-surface {
  background: #0D0D0D;
  border: 1px solid #1E1E1E;
  border-radius: 2px;
  /* Subtle inner glow suggesting illumination */
  box-shadow: inset 0 0 60px rgba(255, 255, 255, 0.02);
}
```

---

## Iconography

### Style

- **Stroke-based**, not filled
- **1.5px stroke weight** at 20px size
- **Sharp corners** — no rounded caps
- **Minimal detail** — reduce to essence

### Recommended Set

Use [Lucide Icons](https://lucide.dev/) as base, customized to sharper corners where needed.

Key icons:
- File operations: `file`, `folder`, `save`, `upload`
- Edit operations: `pencil`, `scissors`, `copy`, `trash-2`
- View operations: `eye`, `code`, `split`, `maximize`

---

## Motion

### Principles

- **Quick and precise** — no bouncy or playful easing
- **Functional, not decorative** — motion serves understanding
- **Subtle** — the work is the focus, not the interface

### Timing

| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 100ms | `ease-out` |
| State change | 150ms | `ease-out` |
| Panel open/close | 200ms | `ease-in-out` |
| Page transition | 250ms | `ease-in-out` |

### Easing Curves

```css
--ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

---

## Shadows

Shadows should feel like **metal under light** — sharp, directional, minimal diffusion.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px rgba(255, 255, 255, 0.1);
```

---

## Voice & Tone

### UI Copy Principles

- **Terse** — say it in fewer words
- **Active voice** — "Save file" not "File will be saved"
- **Lowercase preference** — buttons and labels in lowercase or sentence case
- **No exclamation marks** — calm confidence
- **Technical is fine** — users are working with code

### Examples

| Instead of | Use |
|------------|-----|
| "Your file has been successfully saved!" | "Saved" |
| "Are you sure you want to delete this?" | "Delete file?" |
| "Loading, please wait..." | "Loading" |
| "Click here to open" | "Open" |
| "SUBMIT" | "submit" or "Submit" |

---

## File Structure for Tauri/Svelte

```
src/
├── lib/
│   ├── styles/
│   │   ├── tokens.css       # CSS custom properties
│   │   ├── reset.css        # Minimal reset
│   │   ├── typography.css   # Font definitions
│   │   └── components.css   # Shared component styles
│   ├── components/
│   │   ├── Button.svelte
│   │   ├── Input.svelte
│   │   ├── Panel.svelte
│   │   └── ...
│   └── icons/
│       └── ...
├── app.css                  # Global styles, imports tokens
└── app.html
```

---

## CSS Tokens Reference

```css
:root {
  /* Colors - Dark */
  --color-void: #0A0A0A;
  --color-obsidian: #141414;
  --color-steel: #1E1E1E;
  --color-edge: #2A2A2A;
  
  --color-blade: #E8E8E8;
  --color-polish: #B8B8B8;
  --color-worn: #707070;
  --color-spark: #FFFFFF;
  
  --color-hone-blue: #5C8FFF;
  --color-forge: #FF6B4A;
  --color-temper: #4ADE80;
  --color-caution: #FACC15;
  
  /* Typography */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --font-sans: 'Inter', -apple-system, sans-serif;
  
  --text-display: 32px;
  --text-heading: 20px;
  --text-body: 14px;
  --text-label: 12px;
  --text-caption: 11px;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  
  /* Radii */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(255, 255, 255, 0.1);
  
  /* Motion */
  --duration-micro: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 250ms;
  --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

---

## Summary

HONE's interface should feel like a **precision instrument** — the visual equivalent of a well-balanced blade. Dark, focused, minimal ornamentation. Every element earns its place.

When in doubt, remove.
