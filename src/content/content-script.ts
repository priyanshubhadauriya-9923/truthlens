/**
 * TruthLens Content Script
 *
 * Injected into every webpage. Orchestrates:
 * 1. Media discovery
 * 2. Sequential queue processing
 * 3. Badge rendering
 * 4. Communication with service worker
 */

import { discoverMedia, observeDOM } from './media-detector';
import { QueueManager } from '../queue-system/queue-manager';
import { detectMedia } from '../detection/detection-engine';
import {
  showScanningOverlay,
  removeScanningOverlay,
  attachBadge,
  removeAllBadges,
} from '../badge-engine/badge-renderer';
import type { MediaItem, ScanResult, PageStatus } from '../shared/types';
import { MONTHLY_TTL_MS } from '../shared/types';
import { uid, debounce } from '../shared/utils';
import contentStyles from './content-styles.css?inline';

// ─── Inject styles ────────────────────────────────────────────

const styleEl = document.createElement('style');
styleEl.textContent = contentStyles;
document.head.appendChild(styleEl);

// ─── State ────────────────────────────────────────────────────

const queue = new QueueManager();
const scanResults = new Map<string, ScanResult>();
const autoScanEnabled = true;
let totalMediaFound = 0;

// ─── Status Reporter ──────────────────────────────────────────

function getPageStatus(): PageStatus {
  let suspiciousCount = 0;
  let deepfakeCount = 0;
  let authenticCount = 0;
  let totalDuration = 0;

  for (const result of scanResults.values()) {
    if (result.riskLevel === 'suspicious') suspiciousCount++;
    if (result.riskLevel === 'deepfake') deepfakeCount++;
    if (result.riskLevel === 'authentic') authenticCount++;
    totalDuration += result.scanDuration;
  }

  const scannedCount = scanResults.size;
  return {
    totalMedia: totalMediaFound,
    scannedCount,
    suspiciousCount,
    deepfakeCount,
    authenticCount,
    isScanning: queue.isProcessing,
    isPaused: queue.isPaused,
    isOffline: !navigator.onLine,
    currentlyScanning: queue.currentItem?.media.src.slice(0, 80) || null,
    queueLength: queue.length,
    averageScanSpeed: scannedCount > 0 ? Math.round(totalDuration / scannedCount) : 0,
  };
}

// ─── Queue Processor ──────────────────────────────────────────

queue.setProcessor(async (item) => {
  if (!navigator.onLine) {
    queue.pause();
    return;
  }

  const { media } = item;

  if (media.element && document.contains(media.element)) {
    showScanningOverlay(media.element, media.id);
  }

  const result = await detectMedia(media);
  scanResults.set(media.id, result);

  if (media.element && document.contains(media.element)) {
    removeScanningOverlay(media.element, media.id);
    attachBadge(media.element, result);
  }

  if (result.riskLevel !== 'authentic') {
    try {
      chrome.runtime.sendMessage({
        type: 'SCAN_RESULT',
        payload: {
          result,
          entry: {
            id: uid(),
            result,
            createdAt: Date.now(),
            expiresAt: Date.now() + MONTHLY_TTL_MS,
          },
        },
      });
    } catch {
      // Not in extension context
    }
  }
});

queue.setStatusCallback(() => {
  try {
    chrome.runtime.sendMessage({
      type: 'PAGE_STATUS',
      payload: getPageStatus(),
    });
  } catch {
    // Popup not open
  }
});

// ─── Initialization ───────────────────────────────────────────

function scanPage() {
  const media = discoverMedia();
  totalMediaFound = media.length;

  for (const item of media) {
    queue.enqueue(item);
  }
}

function handleNewMedia(newMedia: MediaItem[]) {
  for (const item of newMedia) {
    totalMediaFound++;
    if (autoScanEnabled) {
      queue.enqueue(item);
    }
  }
}

// ─── Message Handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_PAGE_STATUS':
      sendResponse(getPageStatus());
      break;

    case 'SCAN_PAGE':
      removeAllBadges();
      scanResults.clear();
      queue.clear();
      scanPage();
      sendResponse({ ok: true });
      break;

    case 'PAUSE_SCANNING':
      queue.pause();
      sendResponse({ ok: true });
      break;

    case 'RESUME_SCANNING':
      queue.resume();
      sendResponse({ ok: true });
      break;

    case 'CLEAR_CACHE':
      removeAllBadges();
      scanResults.clear();
      queue.clear();
      totalMediaFound = 0;
      sendResponse({ ok: true });
      break;

    case 'MANUAL_SCAN': {
      const mediaId = message.payload?.mediaId;
      if (mediaId) {
        queue.prioritize(mediaId);
      }
      sendResponse({ ok: true });
      break;
    }

    default:
      break;
  }
  return true;
});

// ─── Context Menu Handler ─────────────────────────────────────

window.addEventListener('message', (event) => {
  if (event.data?.type === 'TRUTHLENS_CONTEXT_SCAN') {
    // Handled by background script via context menu
  }
});

// ─── Start ────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(scanPage, 1000);
  });
} else {
  setTimeout(scanPage, 1000);
}

// Handle online/offline connection state
window.addEventListener('offline', () => {
  queue.pause();
  try {
    chrome.runtime.sendMessage({ type: 'PAGE_STATUS', payload: getPageStatus() });
  } catch {}
});

window.addEventListener('online', () => {
  if (autoScanEnabled) queue.resume();
  try {
    chrome.runtime.sendMessage({ type: 'PAGE_STATUS', payload: getPageStatus() });
  } catch {}
});

observeDOM(debounce(handleNewMedia, 1000) as (newMedia: MediaItem[]) => void);

window.addEventListener(
  'scroll',
  debounce(() => {
    queue.pruneRemoved();
  }, 2000) as EventListener,
  { passive: true }
);

console.log('[TruthLens] Content script initialized');
