import type { QueueItem, MediaItem } from '../shared/types';
import { MAX_QUEUE_SIZE } from '../shared/types';

/**
 * Sequential FIFO Queue Manager
 * Processes one media item at a time, prioritizing:
 * 1. Manually selected media (priority 0)
 * 2. Visible viewport media (priority 1)
 * 3. Autoplay media (priority 2)
 * 4. Background/offscreen media (priority 3)
 */
export class QueueManager {
  private queue: QueueItem[] = [];
  private processing = false;
  private paused = false;
  private scannedHashes = new Set<string>();
  private onProcess: ((item: QueueItem) => Promise<void>) | null = null;
  private onStatusChange: (() => void) | null = null;

  setProcessor(fn: (item: QueueItem) => Promise<void>) {
    this.onProcess = fn;
  }

  setStatusCallback(fn: () => void) {
    this.onStatusChange = fn;
  }

  /** Add media to queue with deduplication */
  enqueue(media: MediaItem, isManual = false): boolean {
    // Check duplicate by hash or src
    const key = media.hash || media.src;
    if (this.scannedHashes.has(key)) return false;
    if (this.queue.some((q) => (q.media.hash || q.media.src) === key)) return false;
    if (this.queue.length >= MAX_QUEUE_SIZE) return false;

    const priority = isManual ? 0 : media.isVisible ? 1 : 2;
    const item: QueueItem = {
      media,
      priority,
      addedAt: Date.now(),
      isManual,
    };

    // Insert sorted by priority (lower = higher priority)
    const insertIdx = this.queue.findIndex((q) => q.priority > priority);
    if (insertIdx === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIdx, 0, item);
    }

    this.onStatusChange?.();
    this.processNext();
    return true;
  }

  /** Move a manual scan to front of queue */
  prioritize(mediaId: string) {
    const idx = this.queue.findIndex((q) => q.media.id === mediaId);
    if (idx > 0) {
      const [item] = this.queue.splice(idx, 1);
      item.priority = 0;
      item.isManual = true;
      this.queue.unshift(item);
      this.onStatusChange?.();
    }
  }

  /** Remove items whose DOM elements no longer exist */
  pruneRemoved() {
    const before = this.queue.length;
    this.queue = this.queue.filter((q) => {
      if (!q.media.element) return true;
      return document.contains(q.media.element);
    });
    if (this.queue.length !== before) {
      this.onStatusChange?.();
    }
  }

  /** Pause processing */
  pause() {
    this.paused = true;
    this.onStatusChange?.();
  }

  /** Resume processing */
  resume() {
    this.paused = false;
    this.onStatusChange?.();
    this.processNext();
  }

  /** Clear queue and cache */
  clear() {
    this.queue = [];
    this.scannedHashes.clear();
    this.processing = false;
    this.onStatusChange?.();
  }

  /** Get current queue length */
  get length() {
    return this.queue.length;
  }

  get isPaused() {
    return this.paused;
  }

  get isProcessing() {
    return this.processing;
  }

  get currentItem(): QueueItem | null {
    return this.processing ? (this.queue[0] ?? null) : null;
  }

  /** Mark a hash as already scanned */
  markScanned(key: string) {
    this.scannedHashes.add(key);
  }

  isAlreadyScanned(key: string): boolean {
    return this.scannedHashes.has(key);
  }

  /** Process next item in queue sequentially */
  private async processNext() {
    if (this.processing || this.paused || this.queue.length === 0 || !this.onProcess) {
      return;
    }

    this.processing = true;
    this.onStatusChange?.();

    while (this.queue.length > 0 && !this.paused) {
      const item = this.queue[0];

      // Skip if DOM element was removed
      if (item.media.element && !document.contains(item.media.element)) {
        this.queue.shift();
        continue;
      }

      try {
        await this.onProcess(item);
        const key = item.media.hash || item.media.src;
        this.scannedHashes.add(key);
      } catch (err) {
        console.warn('[TruthLens] Scan error:', err);
      }

      this.queue.shift();
      this.onStatusChange?.();
    }

    this.processing = false;
    this.onStatusChange?.();
  }
}
