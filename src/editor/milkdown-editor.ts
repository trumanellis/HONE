import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame-dark.css";

export interface MilkdownEditorOptions {
  root: HTMLElement;
  markdown: string;
  onChange?: (markdown: string) => void;
}

export class MilkdownEditor {
  private crepe: Crepe;
  private currentMarkdown: string;

  private constructor(crepe: Crepe, markdown: string) {
    this.crepe = crepe;
    this.currentMarkdown = markdown;
  }

  static async create(options: MilkdownEditorOptions): Promise<MilkdownEditor> {
    const crepe = new Crepe({
      root: options.root,
      defaultValue: options.markdown,
    });

    await crepe.create();

    const editor = new MilkdownEditor(crepe, options.markdown);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        editor.currentMarkdown = markdown;
        options.onChange?.(markdown);
      });
    });

    return editor;
  }

  getMarkdown(): string {
    // Prefer the cached value from listener; fall back to crepe.getMarkdown()
    try {
      return this.crepe.getMarkdown();
    } catch {
      return this.currentMarkdown;
    }
  }

  focus(): void {
    const root = (this.crepe as unknown as { root?: HTMLElement }).root;
    const editable = root?.querySelector<HTMLElement>(".ProseMirror");
    editable?.focus();
  }

  async destroy(): Promise<void> {
    await this.crepe.destroy();
  }
}

/**
 * Rewrite image URLs in markdown source for editor display.
 *
 * Markdown image syntax `![alt](url)` and raw `<img src="url">` tags are
 * traversed. Relative URLs are resolved through `toAssetUrl` so the Tauri
 * asset protocol can serve them inside the editor. A reverse map is returned
 * so `postprocessImages` can restore the original relative paths on save.
 */
export interface ImageRewriteResult {
  processed: string;
  reverseMap: Map<string, string>;
}

function isRelativeUrl(url: string): boolean {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith("//")) {
    return false;
  }
  return true;
}

export function preprocessImages(
  markdown: string,
  toAssetUrl: (relativePath: string) => string
): ImageRewriteResult {
  const reverseMap = new Map<string, string>();

  // Markdown image syntax: ![alt](url) or ![alt](url "title")
  let processed = markdown.replace(
    /!\[([^\]]*)\]\(\s*(<[^>]+>|[^()\s]+(?:\([^)]*\)[^()\s]*)*)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
    (match, alt: string, urlPart: string, titlePart: string | undefined) => {
      // Strip angle brackets if present
      let url = urlPart;
      const hasBrackets = url.startsWith("<") && url.endsWith(">");
      if (hasBrackets) {
        url = url.slice(1, -1);
      }
      if (!isRelativeUrl(url)) return match;

      const assetUrl = toAssetUrl(url);
      reverseMap.set(assetUrl, url);

      const wrappedUrl = hasBrackets ? `<${assetUrl}>` : assetUrl;
      const titleSuffix = titlePart ?? "";
      return `![${alt}](${wrappedUrl}${titleSuffix})`;
    }
  );

  // HTML <img src="..."> tags (handles both " and ' quoting)
  processed = processed.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, url: string) => {
      if (!isRelativeUrl(url)) return match;
      const assetUrl = toAssetUrl(url);
      reverseMap.set(assetUrl, url);
      return `${prefix}${quote}${assetUrl}${quote}`;
    }
  );

  return { processed, reverseMap };
}

export function postprocessImages(
  markdown: string,
  reverseMap: Map<string, string>
): string {
  if (reverseMap.size === 0) return markdown;
  let result = markdown;
  for (const [assetUrl, relativeUrl] of reverseMap.entries()) {
    const escaped = assetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), relativeUrl);
  }
  return result;
}
