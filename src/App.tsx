import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PopupHeader } from './popup/PopupHeader';
import { StatusPanel } from './popup/StatusPanel';
import { QuickActions } from './popup/QuickActions';
import { QueueStatus } from './popup/QueueStatus';
import { PerformanceModeToggle } from './popup/PerformanceModeToggle';
import { SettingsView } from './popup/SettingsView';
import { PrivacyView } from './popup/PrivacyView';
import type { PageStatus, Settings, PerformanceMode } from './shared/types';

type View = 'main' | 'settings' | 'privacy';

function App() {
  const [view, setView] = useState<View>('main');
  const [status, setStatus] = useState<PageStatus>({
    totalMedia: 0,
    scannedCount: 0,
    suspiciousCount: 0,
    deepfakeCount: 0,
    authenticCount: 0,
    isScanning: false,
    isPaused: false,
    isOffline: false,
    currentlyScanning: null,
    queueLength: 0,
    averageScanSpeed: 0,
  });
  const [settings, setSettings] = useState<Settings>({
    performanceMode: 'balanced',
    autoScan: true,
    localOnlyMode: false,
    disableCloudAnalysis: false,
    showBadges: true,
    developerMode: false,
    scanImages: true,
    scanVideos: true,
    scanAudio: true,
  });

  // Load status and settings from service worker
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get page status
        chrome.runtime.sendMessage(
          { type: 'GET_PAGE_STATUS' },
          (response) => {
            if (response) setStatus(response);
          }
        );

        // Get settings
        chrome.runtime.sendMessage(
          { type: 'GET_SETTINGS' },
          (response) => {
            if (response) setSettings((prev) => ({ ...prev, ...response }));
          }
        );
      } catch {
        // Not in extension context — use empty data
        setStatus({
          totalMedia: 0,
          scannedCount: 0,
          suspiciousCount: 0,
          deepfakeCount: 0,
          authenticCount: 0,
          isScanning: false,
          isPaused: false,
          isOffline: false,
          currentlyScanning: null,
          queueLength: 0,
          averageScanSpeed: 0,
        });
      }
    };

    loadData();

    // Poll for status updates
    const interval = setInterval(() => {
      try {
        chrome.runtime.sendMessage(
          { type: 'GET_PAGE_STATUS' },
          (response) => {
            if (response) setStatus(response);
          }
        );
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleAction = (action: string) => {
    try {
      switch (action) {
        case 'scan':
          chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
          break;
        case 'pause':
          chrome.runtime.sendMessage({
            type: status.isPaused ? 'RESUME_SCANNING' : 'PAUSE_SCANNING',
          });
          setStatus((s) => ({ ...s, isPaused: !s.isPaused }));
          break;
        case 'clear':
          chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
          setStatus((s) => ({
            ...s,
            totalMedia: 0,
            scannedCount: 0,
            suspiciousCount: 0,
            deepfakeCount: 0,
            authenticCount: 0,
            queueLength: 0,
            isScanning: false,
            currentlyScanning: null,
          }));
          break;
        case 'dashboard':
          chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
          break;
      }
    } catch {
      // Ignored if not in extension context
    }
  };

  const handleModeChange = (mode: PerformanceMode) => {
    const updated = { ...settings, performanceMode: mode };
    setSettings(updated);
    try {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: updated });
    } catch {
      // Ignored if not in extension context
    }
  };

  const handleSettingsUpdate = (partial: Partial<Settings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    try {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: updated });
    } catch {
      // Ignored if not in extension context
    }
  };

  return (
    <div className="popup-container">
      <PopupHeader
        onSettingsClick={() => setView(view === 'settings' ? 'main' : 'settings')}
        onPrivacyClick={() => setView(view === 'privacy' ? 'main' : 'privacy')}
        currentView={view}
      />

      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 space-y-3"
          >
            <StatusPanel status={status} />
            <QuickActions
              status={status}
              onAction={handleAction}
            />
            <QueueStatus status={status} />
            <PerformanceModeToggle
              mode={settings.performanceMode}
              onChange={handleModeChange}
            />

            {/* Redirect links */}
            <div className="flex gap-2 pt-1">
              <a
                href="https://truthlens.ai/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 text-center text-xs"
              >
                SaaS Dashboard ↗
              </a>
              <a
                href="https://truthlens.ai/analyze"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 text-center text-xs"
              >
                Analysis Website ↗
              </a>
            </div>
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <SettingsView
              settings={settings}
              onUpdate={handleSettingsUpdate}
              onBack={() => setView('main')}
            />
          </motion.div>
        )}

        {view === 'privacy' && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <PrivacyView onBack={() => setView('main')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
