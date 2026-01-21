import matter from 'gray-matter';
import type { FrontmatterData } from '../../types/editor';

export interface ParsedMarkdown {
  content: string;
  frontmatter: FrontmatterData | null;
}

export function extractFrontmatter(markdown: string): ParsedMarkdown {
  const result = matter(markdown);

  const hasFrontmatter = Object.keys(result.data).length > 0 ||
                          markdown.trimStart().startsWith('---');

  return {
    content: result.content,
    frontmatter: hasFrontmatter ? {
      raw: result.matter,
      data: result.data,
    } : null,
  };
}

export function stringifyWithFrontmatter(
  content: string,
  frontmatter: FrontmatterData | null
): string {
  if (!frontmatter) {
    return content;
  }

  // Reconstruct the frontmatter block
  const frontmatterBlock = `---\n${frontmatter.raw}\n---\n\n`;
  return frontmatterBlock + content;
}
