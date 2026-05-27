/**
 * TruthLens Service Worker (Background Script)
 *
 * Handles:
 * - Context menu registration
 * - Monthly cleanup alarm
 * - Message routing between content scripts and popup
 * - Detection history persistence
 */

import { MONTHLY_CLEANUP_ALARM } from '../shared/types';
import type { DetectionEntry } from '../shared/types';

// ─── Extension Install / Update ───────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menu first to avoid duplicate ID errors
  chrome.contextMenus.remove('truthlens-scan', () => void chrome.runtime.lastError);
  // Register context menu
  chrome.contextMenus.create({
    id: 'truthlens-scan',
    title: 'Scan with TruthLens',
    contexts: ['image', 'video', 'audio'],
  });

  // Set up monthly cleanup alarm
  chrome.alarms.create(MONTHLY_CLEANUP_ALARM, {
    periodInMinutes: 60 * 24, // Check daily
  });

  // Initialize default settings
  chrome.storage.local.get('truthlens_settings', (result) => {
    if (!result.truthlens_settings) {
      chrome.storage.local.set({
        truthlens_settings: {
          performanceMode: 'balanced',
          autoScan: true,
          localOnlyMode: false,
          disableCloudAnalysis: false,
          showBadges: true,
          developerMode: false,
          scanImages: true,
          scanVideos: true,
          scanAudio: true,
        },
      });
    }
  });

  console.log('[TruthLens] Extension installed/updated');
});

// ─── Context Menu Handler ─────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'truthlens-scan' && tab?.id) {
    // Send manual scan request to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'MANUAL_SCAN',
      payload: {
        src: info.srcUrl,
        mediaType: info.mediaType,
      },
    });
  }
});

// ─── Monthly Cleanup ──────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MONTHLY_CLEANUP_ALARM) {
    cleanupExpiredEntries();
  }
});

async function cleanupExpiredEntries() {
  const result = await chrome.storage.local.get('truthlens_history');
  if (result.truthlens_history) {
    const now = Date.now();
    const entries = (result.truthlens_history as DetectionEntry[]).filter(
      (e) => e.expiresAt > now
    );
    await chrome.storage.local.set({ truthlens_history: entries });
    console.log(`[TruthLens] Cleaned up expired entries. Remaining: ${entries.length}`);
  }
}

// ─── Message Handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_RESULT': {
      // Store suspicious/deepfake results in history
      const entry = message.payload?.entry as DetectionEntry;
      if (entry) {
        chrome.storage.local.get('truthlens_history', (result) => {
          const history = (result.truthlens_history as DetectionEntry[]) || [];
          history.unshift(entry);
          // Keep max 500 entries
          const trimmed = history.slice(0, 500);
          chrome.storage.local.set({ truthlens_history: trimmed });
        });
      }
      sendResponse({ ok: true });
      break;
    }

    case 'GET_PAGE_STATUS': {
      // Forward to active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'GET_PAGE_STATUS' },
            (response) => {
              sendResponse(response || null);
            }
          );
        } else {
          sendResponse(null);
        }
      });
      return true; // async response
    }

    case 'SCAN_PAGE':
    case 'PAUSE_SCANNING':
    case 'RESUME_SCANNING':
    case 'CLEAR_CACHE': {
      // Forward to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            sendResponse(response || { ok: true });
          });
        }
      });
      return true;
    }

    case 'GET_HISTORY': {
      chrome.storage.local.get('truthlens_history', (result) => {
        sendResponse(result.truthlens_history || []);
      });
      return true;
    }

    case 'CLEAR_HISTORY': {
      chrome.storage.local.set({ truthlens_history: [] }, () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'GET_SETTINGS': {
      chrome.storage.local.get('truthlens_settings', (result) => {
        sendResponse(result.truthlens_settings || null);
      });
      return true;
    }

    case 'UPDATE_SETTINGS': {
      chrome.storage.local.set(
        { truthlens_settings: message.payload },
        () => {
          sendResponse({ ok: true });
        }
      );
      return true;
    }

    case 'FETCH_API': {
      fetch(message.payload.url, message.payload.options)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          sendResponse({ ok: true, data });
        })
        .catch((error) => {
          console.error('[TruthLens] Background fetch error:', error);
          sendResponse({ ok: false, error: error.message });
        });
      return true;
    }

    default:
      break;
  }
  return false;
});

console.log('[TruthLens] Service worker initialized');
