import { create } from 'zustand';
import type {
  PageStatus,
  Settings,
  DetectionEntry,
  AnalyticsSummary,
} from './types';

// ─── Settings Store ───────────────────────────────────────────

interface SettingsStore {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  loadSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
  performanceMode: 'balanced',
  autoScan: true,
  localOnlyMode: false,
  disableCloudAnalysis: false,
  showBadges: true,
  developerMode: false,
  scanImages: true,
  scanVideos: true,
  scanAudio: true,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  setSettings: (partial) =>
    set((state) => {
      const next = { ...state.settings, ...partial };
      // Persist to chrome.storage
      try {
        chrome.storage.local.set({ truthlens_settings: next });
      } catch {
        // Not in extension context
      }
      return { settings: next };
    }),
  loadSettings: async () => {
    try {
      const result = await chrome.storage.local.get('truthlens_settings');
      if (result.truthlens_settings) {
        set({ settings: { ...defaultSettings, ...(result.truthlens_settings as Partial<Settings>) } });
      }
    } catch {
      // Not in extension context - use defaults
    }
  },
}));

// ─── Page Status Store ────────────────────────────────────────

interface PageStatusStore {
  status: PageStatus;
  setStatus: (s: Partial<PageStatus>) => void;
  reset: () => void;
}

const defaultStatus: PageStatus = {
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
};

export const usePageStatusStore = create<PageStatusStore>((set) => ({
  status: defaultStatus,
  setStatus: (partial) =>
    set((state) => ({ status: { ...state.status, ...partial } })),
  reset: () => set({ status: defaultStatus }),
}));

// ─── Detection History Store ──────────────────────────────────

interface HistoryStore {
  entries: DetectionEntry[];
  setEntries: (e: DetectionEntry[]) => void;
  addEntry: (e: DetectionEntry) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => {
    const next = [entry, ...get().entries];
    set({ entries: next });
    try {
      chrome.storage.local.set({ truthlens_history: next });
    } catch {
      // Not in extension context
    }
  },
  removeEntry: (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    try {
      chrome.storage.local.set({ truthlens_history: next });
    } catch {
      // Not in extension context
    }
  },
  clearAll: () => {
    set({ entries: [] });
    try {
      chrome.storage.local.set({ truthlens_history: [] });
    } catch {
      // Not in extension context
    }
  },
  loadFromStorage: async () => {
    try {
      const result = await chrome.storage.local.get('truthlens_history');
      if (result.truthlens_history) {
        // Filter expired entries
        const now = Date.now();
        const valid = (result.truthlens_history as DetectionEntry[]).filter(
          (e) => e.expiresAt > now
        );
        set({ entries: valid });
      }
    } catch {
      // Not in extension context
    }
  },
}));

// ─── Analytics Store ──────────────────────────────────────────

interface AnalyticsStore {
  analytics: AnalyticsSummary;
  computeAnalytics: () => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  analytics: {
    totalScans: 0,
    suspiciousDetections: 0,
    deepfakeDetections: 0,
    mostFlaggedDomains: [],
    scanTrends: [],
  },
  computeAnalytics: () => {
    const entries = useHistoryStore.getState().entries;
    const domainMap = new Map<string, { suspicious: number; deepfake: number; total: number }>();

    for (const entry of entries) {
      const d = entry.result.domain;
      const current = domainMap.get(d) || { suspicious: 0, deepfake: 0, total: 0 };
      current.total++;
      if (entry.result.riskLevel === 'suspicious') current.suspicious++;
      if (entry.result.riskLevel === 'deepfake') current.deepfake++;
      domainMap.set(d, current);
    }

    const mostFlaggedDomains = Array.from(domainMap.entries())
      .map(([domain, stats]) => ({
        domain,
        totalScans: stats.total,
        suspiciousCount: stats.suspicious,
        deepfakeCount: stats.deepfake,
        riskScore: ((stats.suspicious + stats.deepfake * 2) / Math.max(stats.total, 1)) * 100,
        lastScan: Date.now(),
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    // Compute trends (last 7 days)
    const now = Date.now();
    const scanTrends: { date: string; scans: number; flagged: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * 86400000;
      const dayEnd = dayStart + 86400000;
      const dayEntries = entries.filter(
        (e) => e.createdAt >= dayStart && e.createdAt < dayEnd
      );
      scanTrends.push({
        date: new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        scans: dayEntries.length,
        flagged: dayEntries.filter(
          (e) => e.result.riskLevel !== 'authentic'
        ).length,
      });
    }

    set({
      analytics: {
        totalScans: entries.length,
        suspiciousDetections: entries.filter(
          (e) => e.result.riskLevel === 'suspicious'
        ).length,
        deepfakeDetections: entries.filter(
          (e) => e.result.riskLevel === 'deepfake'
        ).length,
        mostFlaggedDomains,
        scanTrends,
      },
    });
  },
}));

// ─── UI Store ─────────────────────────────────────────────────

type PopupView = 'status' | 'dashboard' | 'settings' | 'privacy';

interface UIStore {
  view: PopupView;
  setView: (v: PopupView) => void;
  detailModalEntry: DetectionEntry | null;
  setDetailModal: (e: DetectionEntry | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  view: 'status',
  setView: (view) => set({ view }),
  detailModalEntry: null,
  setDetailModal: (detailModalEntry) => set({ detailModalEntry }),
}));
