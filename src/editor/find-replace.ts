/**
 * Find & Replace Bar Component
 *
 * Provides search and replace functionality for HONE editor.
 * Highlights matches within iframe content and supports navigation.
 */

export interface FindReplaceOptions {
  onClose?: () => void;
}

export class FindReplaceBar {
  private container: HTMLElement;
  private findInput: HTMLInputElement;
  private replaceInput: HTMLInputElement;
  private matchCount: HTMLElement;
  private caseSensitiveBtn: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private currentMatchIndex: number = 0;
  private totalMatches: number = 0;
  private caseSensitive: boolean = false;
  private onCloseCallback?: () => void;

  constructor(parent: HTMLElement, options: FindReplaceOptions = {}) {
    this.onCloseCallback = options.onClose;
    this.container = this.createContainer();
    parent.appendChild(this.container);

    // Get references to created elements
    this.findInput = this.container.querySelector('.find-input') as HTMLInputElement;
    this.replaceInput = this.container.querySelector('.replace-input') as HTMLInputElement;
    this.matchCount = this.container.querySelector('.match-count') as HTMLElement;
    this.caseSensitiveBtn = this.container.querySelector('.case-sensitive-btn') as HTMLElement;

    this.attachEventListeners();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'find-replace-bar';
    container.innerHTML = `
      <div class="find-replace-row">
        <input type="text" class="find-input" placeholder="find" autocomplete="off" spellcheck="false" />
        <button class="prev-btn" title="Previous match">↑</button>
        <button class="next-btn" title="Next match">↓</button>
        <span class="match-count">-</span>
        <button class="case-sensitive-btn" title="Case sensitive">Aa</button>
        <button class="close-btn" title="Close">×</button>
      </div>
      <div class="replace-replace-row" style="display: none;">
        <input type="text" class="replace-input" placeholder="replace" autocomplete="off" spellcheck="false" />
        <button class="replace-btn">replace</button>
        <button class="replace-all-btn">replace all</button>
      </div>
    `;
    return container;
  }

  private attachEventListeners(): void {
    // Find input
    this.findInput.addEventListener('input', () => this.performFind());
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.findPrevious();
        } else {
          this.findNext();
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Replace input
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.replace();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Navigation buttons
    const prevBtn = this.container.querySelector('.prev-btn') as HTMLButtonElement;
    const nextBtn = this.container.querySelector('.next-btn') as HTMLButtonElement;
    prevBtn.addEventListener('click', () => this.findPrevious());
    nextBtn.addEventListener('click', () => this.findNext());

    // Case sensitive toggle
    this.caseSensitiveBtn.addEventListener('click', () => {
      this.caseSensitive = !this.caseSensitive;
      this.caseSensitiveBtn.classList.toggle('active', this.caseSensitive);
      this.performFind();
    });

    // Replace buttons
    const replaceBtn = this.container.querySelector('.replace-btn') as HTMLButtonElement;
    const replaceAllBtn = this.container.querySelector('.replace-all-btn') as HTMLButtonElement;
    replaceBtn.addEventListener('click', () => this.replace());
    replaceAllBtn.addEventListener('click', () => this.replaceAll());

    // Close button
    const closeBtn = this.container.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.close());
  }

  public setIframe(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
  }

  public open(mode: 'find' | 'replace' = 'find'): void {
    this.container.style.display = 'flex';

    const replaceRow = this.container.querySelector('.replace-replace-row') as HTMLElement;
    if (mode === 'replace') {
      replaceRow.style.display = 'flex';
    } else {
      replaceRow.style.display = 'none';
    }

    // Focus find input and select any existing text
    this.findInput.focus();
    this.findInput.select();

    // If there's a selection in the iframe, use it as the initial search term
    if (this.iframe?.contentWindow) {
      const selection = this.iframe.contentWindow.getSelection();
      if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString();
        if (selectedText) {
          this.findInput.value = selectedText;
          this.performFind();
        }
      }
    }
  }

  public close(): void {
    this.container.style.display = 'none';
    this.clearHighlights();
    this.findInput.value = '';
    this.replaceInput.value = '';
    this.currentMatchIndex = 0;
    this.totalMatches = 0;
    this.updateMatchCount();

    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public isOpen(): boolean {
    return this.container.style.display !== 'none';
  }

  private performFind(): void {
    const searchText = this.findInput.value;

    if (!searchText || !this.iframe?.contentDocument) {
      this.clearHighlights();
      this.totalMatches = 0;
      this.currentMatchIndex = 0;
      this.updateMatchCount();
      return;
    }

    this.clearHighlights();
    this.highlightMatches(searchText);

    if (this.totalMatches > 0) {
      this.currentMatchIndex = 0;
      this.scrollToMatch(0);
    }

    this.updateMatchCount();
  }

  private highlightMatches(searchText: string): void {
    if (!this.iframe?.contentDocument) return;

    const doc = this.iframe.contentDocument;
    const body = doc.body;

    // Create a TreeWalker to find all text nodes
    const walker = doc.createTreeWalker(
      body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip text nodes in script, style, and our highlight marks
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (tagName === 'script' || tagName === 'style' || tagName === 'mark') {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip empty or whitespace-only nodes
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Process each text node and wrap matches
    let matchIndex = 0;
    const flags = this.caseSensitive ? 'g' : 'gi';
    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, flags);

    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      const matches = Array.from(text.matchAll(regex));

      if (matches.length === 0) return;

      // Create a document fragment to hold the new nodes
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach((match) => {
        const matchStart = match.index!;
        const matchEnd = matchStart + match[0].length;

        // Add text before match
        if (matchStart > lastIndex) {
          fragment.appendChild(doc.createTextNode(text.substring(lastIndex, matchStart)));
        }

        // Create highlight mark for match
        const mark = doc.createElement('mark');
        mark.className = 'hone-find-highlight';
        mark.setAttribute('data-match-index', matchIndex.toString());
        mark.textContent = text.substring(matchStart, matchEnd);
        fragment.appendChild(mark);

        matchIndex++;
        lastIndex = matchEnd;
      });

      // Add remaining text after last match
      if (lastIndex < text.length) {
        fragment.appendChild(doc.createTextNode(text.substring(lastIndex)));
      }

      // Replace the text node with the fragment
      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    this.totalMatches = matchIndex;
  }

  private clearHighlights(): void {
    if (!this.iframe?.contentDocument) return;

    const marks = this.iframe.contentDocument.querySelectorAll('mark.hone-find-highlight');
    marks.forEach((mark) => {
      const text = mark.textContent || '';
      const textNode = this.iframe!.contentDocument!.createTextNode(text);
      mark.parentNode?.replaceChild(textNode, mark);
    });

    // Normalize to merge adjacent text nodes
    this.iframe.contentDocument.body.normalize();
  }

  private scrollToMatch(index: number): void {
    if (!this.iframe?.contentDocument || this.totalMatches === 0) return;

    // Remove current class from all marks
    const allMarks = this.iframe.contentDocument.querySelectorAll('mark.hone-find-highlight');
    allMarks.forEach((mark) => mark.classList.remove('current'));

    // Add current class to the target mark
    const targetMark = this.iframe.contentDocument.querySelector(
      `mark.hone-find-highlight[data-match-index="${index}"]`
    );

    if (targetMark) {
      targetMark.classList.add('current');
      targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private findNext(): void {
    if (this.totalMatches === 0) return;

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.totalMatches;
    this.scrollToMatch(this.currentMatchIndex);
    this.updateMatchCount();
  }

  private findPrevious(): void {
    if (this.totalMatches === 0) return;

    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.totalMatches) % this.totalMatches;
    this.scrollToMatch(this.currentMatchIndex);
    this.updateMatchCount();
  }

  private updateMatchCount(): void {
    if (this.totalMatches === 0) {
      this.matchCount.textContent = this.findInput.value ? 'no matches' : '-';
      this.matchCount.classList.remove('has-matches');
    } else {
      this.matchCount.textContent = `${this.currentMatchIndex + 1} / ${this.totalMatches}`;
      this.matchCount.classList.add('has-matches');
    }
  }

  private replace(): void {
    if (!this.iframe?.contentDocument || this.totalMatches === 0) return;

    const replaceText = this.replaceInput.value;
    const currentMark = this.iframe.contentDocument.querySelector(
      `mark.hone-find-highlight.current`
    );

    if (currentMark) {
      const textNode = this.iframe.contentDocument.createTextNode(replaceText);
      currentMark.parentNode?.replaceChild(textNode, currentMark);

      // Trigger dirty state
      this.iframe.contentDocument.dispatchEvent(new Event('input', { bubbles: true }));

      // Re-perform find to update match count
      this.performFind();
    }
  }

  private replaceAll(): void {
    if (!this.iframe?.contentDocument || this.totalMatches === 0) return;

    const replaceText = this.replaceInput.value;
    const allMarks = Array.from(
      this.iframe.contentDocument.querySelectorAll('mark.hone-find-highlight')
    );

    allMarks.forEach((mark) => {
      const doc = this.iframe?.contentDocument;
      if (!doc) return;
      const textNode = doc.createTextNode(replaceText);
      mark.parentNode?.replaceChild(textNode, mark);
    });

    // Normalize to merge adjacent text nodes
    this.iframe.contentDocument.body.normalize();

    // Trigger dirty state
    this.iframe.contentDocument.dispatchEvent(new Event('input', { bubbles: true }));

    // Clear and update UI
    this.totalMatches = 0;
    this.currentMatchIndex = 0;
    this.updateMatchCount();
  }

  public destroy(): void {
    this.clearHighlights();
    this.container.remove();
  }
}

export function createFindReplaceBar(
  parent: HTMLElement,
  options: FindReplaceOptions = {}
): FindReplaceBar {
  return new FindReplaceBar(parent, options);
}
