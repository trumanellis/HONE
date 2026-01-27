/**
 * Image Overlay Manager - Creates overlay controls in the parent document
 * to avoid CSP restrictions in the iframe
 */

export interface ImageOverlayCallbacks {
  onReplace: (image: HTMLImageElement) => void;
  onRemove: (image: HTMLImageElement) => void;
}

interface ImageOverlay {
  image: HTMLImageElement;
  wrapper: HTMLDivElement;
}

export class ImageOverlayManager {
  private container: HTMLDivElement;
  private iframe: HTMLIFrameElement | null = null;
  private overlays: ImageOverlay[] = [];
  private callbacks: ImageOverlayCallbacks;
  private scrollHandler: () => void;
  private resizeObserver: ResizeObserver;

  constructor(parentContainer: HTMLElement, callbacks: ImageOverlayCallbacks) {
    this.callbacks = callbacks;

    // Create overlay container in parent document
    this.container = document.createElement('div');
    this.container.className = 'hone-image-overlay-container';
    parentContainer.appendChild(this.container);

    // Bind scroll handler
    this.scrollHandler = this.updatePositions.bind(this);

    // Create resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updatePositions();
    });
  }

  attach(iframe: HTMLIFrameElement): void {
    this.detach();
    this.iframe = iframe;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Find all images and create overlays
    const images = doc.querySelectorAll('img');
    images.forEach((img) => {
      this.createOverlay(img as HTMLImageElement);
    });

    // Listen for scroll in iframe
    doc.addEventListener('scroll', this.scrollHandler, true);
    iframe.contentWindow?.addEventListener('scroll', this.scrollHandler);

    // Observe iframe for resize
    this.resizeObserver.observe(iframe);

    // Initial position update
    this.updatePositions();
  }

  detach(): void {
    if (this.iframe?.contentDocument) {
      this.iframe.contentDocument.removeEventListener('scroll', this.scrollHandler, true);
      this.iframe.contentWindow?.removeEventListener('scroll', this.scrollHandler);
    }

    this.resizeObserver.disconnect();

    // Remove all overlays
    this.overlays.forEach(({ wrapper }) => wrapper.remove());
    this.overlays = [];
    this.iframe = null;
  }

  private createOverlay(image: HTMLImageElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'hone-image-overlay';

    // Replace button
    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'hone-image-btn';
    replaceBtn.title = 'Replace Image';
    replaceBtn.type = 'button';
    replaceBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    replaceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onReplace(image);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'hone-image-btn delete';
    deleteBtn.title = 'Remove Image';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onRemove(image);
      // Remove this overlay
      this.removeOverlayForImage(image);
    });

    wrapper.appendChild(replaceBtn);
    wrapper.appendChild(deleteBtn);
    this.container.appendChild(wrapper);

    this.overlays.push({ image, wrapper });
  }

  private removeOverlayForImage(image: HTMLImageElement): void {
    const index = this.overlays.findIndex((o) => o.image === image);
    if (index !== -1) {
      this.overlays[index].wrapper.remove();
      this.overlays.splice(index, 1);
    }
  }

  private updatePositions(): void {
    if (!this.iframe) return;

    const iframeRect = this.iframe.getBoundingClientRect();

    this.overlays.forEach(({ image, wrapper }) => {
      // Check if image still exists in DOM
      if (!image.isConnected) {
        wrapper.style.display = 'none';
        return;
      }

      const imgRect = image.getBoundingClientRect();

      // Position relative to parent container
      const top = iframeRect.top + imgRect.top;
      const left = iframeRect.left + imgRect.left;
      const width = imgRect.width;
      const height = imgRect.height;

      // Hide if image is outside iframe viewport or too small
      if (
        imgRect.bottom < 0 ||
        imgRect.top > iframeRect.height ||
        imgRect.right < 0 ||
        imgRect.left > iframeRect.width ||
        width < 50 ||
        height < 50
      ) {
        wrapper.style.display = 'none';
        return;
      }

      wrapper.style.display = 'flex';
      wrapper.style.top = `${top}px`;
      wrapper.style.left = `${left}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
    });
  }

  destroy(): void {
    this.detach();
    this.container.remove();
  }
}
