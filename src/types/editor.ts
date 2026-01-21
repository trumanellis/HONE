export type FileType = 'html' | 'markdown';

export interface FrontmatterData {
  raw: string;
  data: Record<string, unknown>;
}

export interface EditorState {
  currentPath: string | null;
  originalDoctype: string;
  isDirty: boolean;
  contentFrame: HTMLIFrameElement | null;
  fileType: FileType;
  originalMarkdown: string | null;
  frontmatter: FrontmatterData | null;
}
