import { describe, it, expect } from 'vitest';
import {
  parseEditableRegions,
  extractDoctype,
  surgicalReplace,
  EDITABLE_TAGS,
} from './html-parser';

describe('parseEditableRegions', () => {
  it('extracts paragraph regions with correct offsets', () => {
    const html = '<p>Hello world</p>';
    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe('region-0');
    expect(regions[0].tagName).toBe('p');
    expect(regions[0].originalContent).toBe('Hello world');
    expect(regions[0].isDirty).toBe(false);
  });

  it('extracts multiple regions in document order', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Title</h1>
  <p>First paragraph</p>
  <p>Second paragraph</p>
</body>
</html>`;

    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(3);
    expect(regions[0].tagName).toBe('h1');
    expect(regions[0].originalContent).toBe('Title');
    expect(regions[1].tagName).toBe('p');
    expect(regions[1].originalContent).toBe('First paragraph');
    expect(regions[2].tagName).toBe('p');
    expect(regions[2].originalContent).toBe('Second paragraph');
  });

  it('handles nested inline elements', () => {
    const html = '<p>Hello <strong>bold</strong> world</p>';
    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(1);
    expect(regions[0].originalContent).toBe('Hello <strong>bold</strong> world');
  });

  it('handles list items', () => {
    const html = '<ul><li>First</li><li>Second</li></ul>';
    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(2);
    expect(regions[0].tagName).toBe('li');
    expect(regions[0].originalContent).toBe('First');
    expect(regions[1].originalContent).toBe('Second');
  });

  it('extracts regions from all editable tags', () => {
    const html = `
      <h1>H1</h1>
      <h2>H2</h2>
      <h3>H3</h3>
      <p>Para</p>
      <blockquote>Quote</blockquote>
      <table><tr><td>Cell</td></tr></table>
      <dl><dt>Term</dt><dd>Def</dd></dl>
    `;

    const regions = parseEditableRegions(html);
    const tags = regions.map(r => r.tagName);

    expect(tags).toContain('h1');
    expect(tags).toContain('h2');
    expect(tags).toContain('h3');
    expect(tags).toContain('p');
    expect(tags).toContain('blockquote');
    expect(tags).toContain('td');
    expect(tags).toContain('dt');
    expect(tags).toContain('dd');
  });

  it('handles empty elements', () => {
    const html = '<p></p>';
    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(1);
    expect(regions[0].originalContent).toBe('');
    expect(regions[0].startOffset).toBe(regions[0].endOffset);
  });

  it('preserves whitespace in content', () => {
    const html = '<p>  spaced  content  </p>';
    const regions = parseEditableRegions(html);

    expect(regions[0].originalContent).toBe('  spaced  content  ');
  });

  it('handles self-closing void elements without breaking', () => {
    const html = '<p>Before <br> after</p>';
    const regions = parseEditableRegions(html);

    expect(regions).toHaveLength(1);
    expect(regions[0].originalContent).toBe('Before <br> after');
  });
});

describe('extractDoctype', () => {
  it('extracts standard DOCTYPE', () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';
    expect(extractDoctype(html)).toBe('<!DOCTYPE html>');
  });

  it('extracts HTML4 DOCTYPE', () => {
    const html = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><html></html>';
    const doctype = extractDoctype(html);
    expect(doctype).toContain('DOCTYPE');
    expect(doctype).toContain('HTML 4.01');
  });

  it('returns default DOCTYPE when missing', () => {
    const html = '<html><head></head><body></body></html>';
    expect(extractDoctype(html)).toBe('<!DOCTYPE html>');
  });
});

describe('surgicalReplace', () => {
  it('returns original when no regions are dirty', () => {
    const html = '<p>Hello</p>';
    const regions = parseEditableRegions(html);

    const result = surgicalReplace(html, regions);
    expect(result).toBe(html);
  });

  it('replaces single dirty region', () => {
    const html = '<p>Hello</p>';
    const regions = parseEditableRegions(html);

    regions[0].currentContent = 'Goodbye';
    regions[0].isDirty = true;

    const result = surgicalReplace(html, regions);
    expect(result).toBe('<p>Goodbye</p>');
  });

  it('replaces multiple dirty regions', () => {
    const html = '<p>First</p><p>Second</p>';
    const regions = parseEditableRegions(html);

    regions[0].currentContent = 'One';
    regions[0].isDirty = true;
    regions[1].currentContent = 'Two';
    regions[1].isDirty = true;

    const result = surgicalReplace(html, regions);
    expect(result).toBe('<p>One</p><p>Two</p>');
  });

  it('preserves unchanged regions byte-for-byte', () => {
    const html = `<p class="intro">Keep this</p>
<p>Change this</p>
<p>Also keep this</p>`;

    const regions = parseEditableRegions(html);

    // Only modify the middle paragraph
    regions[1].currentContent = 'Changed!';
    regions[1].isDirty = true;

    const result = surgicalReplace(html, regions);

    // Unchanged parts should be identical
    expect(result).toContain('<p class="intro">Keep this</p>');
    expect(result).toContain('<p>Also keep this</p>');
    expect(result).toContain('<p>Changed!</p>');
    expect(result).not.toContain('Change this');
  });

  it('handles content that changes length', () => {
    const html = '<p>Short</p><p>Also short</p>';
    const regions = parseEditableRegions(html);

    regions[0].currentContent = 'This is now much longer content';
    regions[0].isDirty = true;

    const result = surgicalReplace(html, regions);
    expect(result).toBe('<p>This is now much longer content</p><p>Also short</p>');
  });

  it('handles HTML entities in edited content', () => {
    const html = '<p>Original</p>';
    const regions = parseEditableRegions(html);

    regions[0].currentContent = '&lt;script&gt;';
    regions[0].isDirty = true;

    const result = surgicalReplace(html, regions);
    expect(result).toBe('<p>&lt;script&gt;</p>');
  });

  it('preserves comments and scripts outside editable regions', () => {
    const html = `<!-- comment -->
<script>const x = 1;</script>
<p>Editable</p>
<!-- another comment -->`;

    const regions = parseEditableRegions(html);
    regions[0].currentContent = 'Changed';
    regions[0].isDirty = true;

    const result = surgicalReplace(html, regions);
    expect(result).toContain('<!-- comment -->');
    expect(result).toContain('<script>const x = 1;</script>');
    expect(result).toContain('<!-- another comment -->');
    expect(result).toContain('<p>Changed</p>');
  });
});

describe('EDITABLE_TAGS', () => {
  it('includes all expected block text elements', () => {
    expect(EDITABLE_TAGS).toContain('p');
    expect(EDITABLE_TAGS).toContain('h1');
    expect(EDITABLE_TAGS).toContain('h2');
    expect(EDITABLE_TAGS).toContain('h3');
    expect(EDITABLE_TAGS).toContain('h4');
    expect(EDITABLE_TAGS).toContain('h5');
    expect(EDITABLE_TAGS).toContain('h6');
    expect(EDITABLE_TAGS).toContain('li');
    expect(EDITABLE_TAGS).toContain('td');
    expect(EDITABLE_TAGS).toContain('th');
    expect(EDITABLE_TAGS).toContain('blockquote');
    expect(EDITABLE_TAGS).toContain('figcaption');
  });

  it('does not include structural elements', () => {
    expect(EDITABLE_TAGS).not.toContain('div');
    expect(EDITABLE_TAGS).not.toContain('section');
    expect(EDITABLE_TAGS).not.toContain('article');
    expect(EDITABLE_TAGS).not.toContain('nav');
    expect(EDITABLE_TAGS).not.toContain('header');
    expect(EDITABLE_TAGS).not.toContain('footer');
  });
});
