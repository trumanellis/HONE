import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Configure turndown with GFM support
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// Add GFM plugin for tables, strikethrough, task lists
turndownService.use(gfm);

// Preserve data attributes for round-trip of special content
turndownService.addRule('preserveDataAttrs', {
  filter: (node) => {
    return node instanceof HTMLElement &&
           (node.hasAttribute('data-math') || node.hasAttribute('data-diagram'));
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    if (el.hasAttribute('data-math')) {
      return el.getAttribute('data-math') || '';
    }
    if (el.hasAttribute('data-diagram')) {
      return el.getAttribute('data-diagram') || '';
    }
    return '';
  },
});

export function serializeToMarkdown(doc: Document): string {
  // Get the body content, excluding editor-injected elements
  const body = doc.body.cloneNode(true) as HTMLElement;

  // Remove editor-specific elements
  const editorElements = body.querySelectorAll('[data-hone-editor]');
  editorElements.forEach(el => el.remove());

  return turndownService.turndown(body.innerHTML);
}
