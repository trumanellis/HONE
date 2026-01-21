import { marked, Renderer } from 'marked';
import markedFootnote from 'marked-footnote';

// Configure marked with GFM and footnotes
marked.use({
  gfm: true,
  breaks: false,
});

marked.use(markedFootnote());

// Check if a URL is relative (not absolute or protocol-relative)
function isRelativeUrl(url: string): boolean {
  // Absolute URLs start with protocol or //
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('//')) {
    return false;
  }
  return true;
}

export function parseMarkdown(
  content: string,
  resolveImagePath?: (relativePath: string) => string
): string {
  const renderer = new Renderer();

  renderer.image = ({ href, title, text }) => {
    // Use the resolver if provided and URL is relative
    const resolvedSrc = (resolveImagePath && isRelativeUrl(href))
      ? resolveImagePath(href)
      : href;
    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${resolvedSrc}" alt="${text}"${titleAttr}>`;
  };

  return marked.parse(content, { async: false, renderer }) as string;
}
