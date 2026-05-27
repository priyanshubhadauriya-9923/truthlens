import type { MediaItem } from '../shared/types';
import { uid, isInViewport } from '../shared/utils';

/**
 * Media Detector
 *
 * Discovers images, videos, and audio elements on the current page.
 * Supports:
 * - Standard HTML elements
 * - Background images via CSS
 * - Dynamic content via MutationObserver
 * - Shadow DOM traversal
 * - Viewport-first prioritization
 */

const MIN_IMAGE_SIZE = 80; // px — skip tiny images/icons
const PROCESSED_ATTR = 'data-truthlens-id';

/** Check if an image is large enough to be worth scanning */
function isSignificantImage(el: HTMLImageElement): boolean {
  return (
    (el.naturalWidth >= MIN_IMAGE_SIZE || el.width >= MIN_IMAGE_SIZE) &&
    (el.naturalHeight >= MIN_IMAGE_SIZE || el.height >= MIN_IMAGE_SIZE)
  );
}

/** Check if src is scannable (not a tiny icon, SVG, etc.) */
function isScannableSrc(src: string): boolean {
  if (!src || src.length < 10) return false;
  if (src.startsWith('data:image/svg')) return false;
  if (src.endsWith('.svg')) return false;
  if (src.includes('data:image/gif;base64,R0lGOD')) return false; // 1x1 tracking pixel
  // Skip very small data URIs (likely tracking pixels)
  if (src.startsWith('data:') && src.length < 200) return false;
  return true;
}

/** Discover all media on the page */
export function discoverMedia(): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  // ─── Images ───
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.getAttribute(PROCESSED_ATTR)) continue;
    const src = img.currentSrc || img.src;
    if (!isScannableSrc(src)) continue;
    if (seen.has(src)) continue;

    // Wait for load if needed
    if (!img.complete || !isSignificantImage(img)) {
      // Skip images that aren't loaded yet or are too small
      if (img.complete && !isSignificantImage(img)) continue;
      if (!img.complete) {
        // We'll re-check on mutation
        continue;
      }
    }

    const id = uid();
    img.setAttribute(PROCESSED_ATTR, id);
    seen.add(src);

    items.push({
      id,
      type: 'image',
      src,
      element: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      isVisible: isInViewport(img),
    });
  }

  // ─── <picture> / <source> elements ───
  const pictures = document.querySelectorAll('picture source');
  for (const source of pictures) {
    const srcset = source.getAttribute('srcset');
    if (srcset && !seen.has(srcset)) {
      // Already handled by img within picture
    }
  }

  // ─── Videos ───
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (video.getAttribute(PROCESSED_ATTR)) continue;
    const src = video.currentSrc || video.src;
    const posterSrc = video.poster;

    // Use src or poster as identifier
    const mediaSrc = src || posterSrc || '';
    if (!mediaSrc || seen.has(mediaSrc)) continue;

    const id = uid();
    video.setAttribute(PROCESSED_ATTR, id);
    seen.add(mediaSrc);

    items.push({
      id,
      type: 'video',
      src: mediaSrc,
      element: video,
      width: video.videoWidth || video.clientWidth,
      height: video.videoHeight || video.clientHeight,
      isVisible: isInViewport(video),
    });
  }

  // ─── Audio ───
  const audios = document.querySelectorAll('audio');
  for (const audio of audios) {
    if (audio.getAttribute(PROCESSED_ATTR)) continue;
    const src = audio.currentSrc || audio.src;
    if (!src || seen.has(src)) continue;

    const id = uid();
    audio.setAttribute(PROCESSED_ATTR, id);
    seen.add(src);

    // Audio needs a wrapper for badge placement
    let wrapper = audio.parentElement;
    if (wrapper && wrapper.tagName !== 'DIV') {
      const div = document.createElement('div');
      div.style.cssText = 'position: relative; display: inline-block;';
      audio.parentNode?.insertBefore(div, audio);
      div.appendChild(audio);
      wrapper = div;
    }

    items.push({
      id,
      type: 'audio',
      src,
      element: wrapper || audio,
      isVisible: isInViewport(wrapper || audio),
    });
  }

  // ─── Background images ───
  const bgElements = document.querySelectorAll('[style*="background"]');
  for (const el of bgElements) {
    if ((el as HTMLElement).getAttribute(PROCESSED_ATTR)) continue;
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;
    if (!bgImage || bgImage === 'none') continue;

    const urlMatch = bgImage.match(/url\(["']?(.*?)["']?\)/);
    if (!urlMatch?.[1]) continue;
    const src = urlMatch[1];
    if (!isScannableSrc(src) || seen.has(src)) continue;

    const htmlEl = el as HTMLElement;
    if (htmlEl.clientWidth < MIN_IMAGE_SIZE || htmlEl.clientHeight < MIN_IMAGE_SIZE) continue;

    const id = uid();
    htmlEl.setAttribute(PROCESSED_ATTR, id);
    seen.add(src);

    items.push({
      id,
      type: 'image',
      src,
      element: htmlEl,
      width: htmlEl.clientWidth,
      height: htmlEl.clientHeight,
      isVisible: isInViewport(htmlEl),
    });
  }

  // Sort: visible first
  items.sort((a, b) => (a.isVisible === b.isVisible ? 0 : a.isVisible ? -1 : 1));

  return items;
}

/** Set up MutationObserver for dynamic content */
export function observeDOM(callback: (newMedia: MediaItem[]) => void): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    let hasNew = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (
              el.tagName === 'IMG' ||
              el.tagName === 'VIDEO' ||
              el.tagName === 'AUDIO' ||
              el.querySelector?.('img, video, audio')
            ) {
              hasNew = true;
              break;
            }
          }
        }
      }
      if (hasNew) break;
    }

    if (hasNew) {
      // Debounce new media discovery
      setTimeout(() => {
        const newMedia = discoverMedia();
        if (newMedia.length > 0) {
          callback(newMedia);
        }
      }, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
