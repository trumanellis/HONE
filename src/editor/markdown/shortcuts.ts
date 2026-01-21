type MarkdownFormat = 'bold' | 'italic' | 'code';

const formatMarkers: Record<MarkdownFormat, string> = {
  bold: '**',
  italic: '*',
  code: '`',
};

export function applyMarkdownFormat(doc: Document, format: MarkdownFormat): void {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  const marker = formatMarkers[format];

  if (!selectedText) {
    // No selection - insert markers with cursor between them
    const markerNode = doc.createTextNode(marker + marker);
    range.insertNode(markerNode);

    // Position cursor between markers
    const newRange = doc.createRange();
    newRange.setStart(markerNode, marker.length);
    newRange.setEnd(markerNode, marker.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return;
  }

  // Check if text is already wrapped with this marker
  const isWrapped = selectedText.startsWith(marker) && selectedText.endsWith(marker);

  let newText: string;
  if (isWrapped && selectedText.length > marker.length * 2) {
    // Remove markers
    newText = selectedText.slice(marker.length, -marker.length);
  } else {
    // Add markers
    newText = marker + selectedText + marker;
  }

  // Replace the selection
  range.deleteContents();
  const textNode = doc.createTextNode(newText);
  range.insertNode(textNode);

  // Select the new text (excluding markers if we added them)
  const newRange = doc.createRange();
  if (!isWrapped) {
    newRange.setStart(textNode, marker.length);
    newRange.setEnd(textNode, newText.length - marker.length);
  } else {
    newRange.selectNodeContents(textNode);
  }
  selection.removeAllRanges();
  selection.addRange(newRange);
}
