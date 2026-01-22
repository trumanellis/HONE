import { parse, type DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
type DocumentType = DefaultTreeAdapterTypes.DocumentType;

/**
 * Tags that contain editable text content
 */
export const EDITABLE_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'td', 'th', 'blockquote', 'figcaption',
  'dt', 'dd', 'label', 'legend', 'summary',
];

/**
 * Represents an editable region in the HTML document
 */
export interface EditableRegion {
  id: string;           // "region-0", "region-1", etc.
  tagName: string;      // "p", "h1", "li", etc.
  startOffset: number;  // Byte offset where content starts (after start tag)
  endOffset: number;    // Byte offset where content ends (before end tag)
  originalContent: string;
  currentContent: string | null;
  isDirty: boolean;
}

/**
 * Type guard to check if a node is an Element with sourceCodeLocation
 */
function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

/**
 * Parse HTML and extract all editable regions with their byte offsets
 */
export function parseEditableRegions(html: string): EditableRegion[] {
  const ast = parse(html, { sourceCodeLocationInfo: true });
  const regions: EditableRegion[] = [];
  let regionId = 0;

  function walk(node: Node): void {
    if (isElement(node) && EDITABLE_TAGS.includes(node.tagName)) {
      const loc = node.sourceCodeLocation;
      if (loc?.startTag && loc?.endTag) {
        const startOffset = loc.startTag.endOffset;
        const endOffset = loc.endTag.startOffset;

        regions.push({
          id: `region-${regionId++}`,
          tagName: node.tagName,
          startOffset,
          endOffset,
          originalContent: html.slice(startOffset, endOffset),
          currentContent: null,
          isDirty: false,
        });
      }
    }

    if ('childNodes' in node) {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
  }

  walk(ast);
  return regions;
}

/**
 * Extract the doctype string from HTML using parse5
 */
export function extractDoctype(html: string): string {
  const ast = parse(html, { sourceCodeLocationInfo: true });

  for (const node of ast.childNodes) {
    if (node.nodeName === '#documentType') {
      const doctype = node as DocumentType;
      const loc = doctype.sourceCodeLocation;
      if (loc) {
        return html.slice(loc.startOffset, loc.endOffset);
      }
    }
  }

  return '<!DOCTYPE html>';
}

/**
 * Perform surgical replacement of edited regions in the original HTML string.
 * Only modified regions are replaced; unchanged regions remain byte-for-byte identical.
 *
 * @param originalHtml - The original HTML string (never modified)
 * @param regions - Array of EditableRegion with currentContent populated
 * @returns New HTML string with only edited regions replaced
 */
export function surgicalReplace(
  originalHtml: string,
  regions: EditableRegion[]
): string {
  // Find dirty regions and sort by offset DESCENDING (replace from end first)
  // This ensures byte offsets remain valid as we replace
  const dirtyRegions = regions
    .filter(r => r.isDirty && r.currentContent !== null)
    .sort((a, b) => b.startOffset - a.startOffset);

  if (dirtyRegions.length === 0) {
    return originalHtml;
  }

  let result = originalHtml;
  for (const region of dirtyRegions) {
    result =
      result.slice(0, region.startOffset) +
      region.currentContent +
      result.slice(region.endOffset);
  }

  return result;
}

/**
 * Update regions with content from browser DOM and mark dirty regions.
 * Call this before surgicalReplace().
 */
export function syncRegionsFromDom(
  doc: Document,
  regions: EditableRegion[]
): void {
  for (const region of regions) {
    const el = doc.querySelector(`[data-hone-edit-id="${region.id}"]`);
    if (el) {
      region.currentContent = el.innerHTML;
      region.isDirty = region.currentContent !== region.originalContent;
    }
  }
}

/**
 * After editing and saving, update regions to reflect new state.
 * This allows subsequent saves to only change newly edited regions.
 */
export function commitRegions(regions: EditableRegion[]): void {
  for (const region of regions) {
    if (region.isDirty && region.currentContent !== null) {
      // Update original content to match current
      region.originalContent = region.currentContent;
      region.isDirty = false;
      // Note: offset updates for subsequent regions would be needed for
      // multiple saves without reload. For now, we re-parse regions after save.
    }
  }
}
