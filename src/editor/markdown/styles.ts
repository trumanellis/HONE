export function getMarkdownStyles(): string {
  return `
    /* Markdown preview styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: #0D0D0D;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      color: #ffffff;
    }

    h1 { font-size: 2em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }

    /* Paragraphs */
    p {
      margin: 1em 0;
    }

    /* Links */
    a {
      color: #58a6ff;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Code */
    code {
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 0.9em;
      background: #1a1a1a;
      padding: 0.2em 0.4em;
      border-radius: 4px;
      color: #f0f0f0;
    }

    pre {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 1em;
      overflow-x: auto;
      margin: 1em 0;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.875em;
    }

    /* Blockquotes */
    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 4px solid #444;
      background: #1a1a1a;
      color: #aaa;
    }

    blockquote p {
      margin: 0.5em 0;
    }

    /* Lists */
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin: 0.25em 0;
    }

    /* Task lists */
    ul.contains-task-list {
      list-style: none;
      padding-left: 1em;
    }

    .task-list-item {
      display: flex;
      align-items: baseline;
      gap: 0.5em;
    }

    .task-list-item input[type="checkbox"] {
      margin: 0;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid #444;
      padding: 0.5em 1em;
      text-align: left;
    }

    th {
      background: #1a1a1a;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #151515;
    }

    /* Horizontal rules */
    hr {
      border: none;
      border-top: 1px solid #333;
      margin: 2em 0;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    /* Footnotes */
    .footnotes {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1px solid #333;
      font-size: 0.9em;
      color: #888;
    }

    .footnotes ol {
      padding-left: 1.5em;
    }

    sup a {
      color: #58a6ff;
      text-decoration: none;
    }
  `;
}
