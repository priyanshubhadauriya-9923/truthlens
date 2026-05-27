import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardHeader } from './DashboardHeader';
import { AnalyticsOverview } from './AnalyticsOverview';
import { DetectionHistory } from './DetectionHistory';
import { DetectionDetailModal } from './DetectionDetailModal';
import { DashboardSettings } from './DashboardSettings';
import type { DetectionEntry, AnalyticsSummary } from '../shared/types';

type DashboardView = 'overview' | 'history' | 'settings';



const computeAnalytics = (entries: DetectionEntry[]): AnalyticsSummary => {
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

  const now = Date.now();
  const scanTrends = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayEntries = entries.filter(
      (e) => e.createdAt >= dayStart && e.createdAt < dayEnd
    );
    return {
      date: new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      scans: dayEntries.length,
      flagged: dayEntries.filter((e) => e.result.riskLevel !== 'authentic').length,
    };
  });

  return {
    totalScans: entries.length,
    suspiciousDetections: entries.filter((e) => e.result.riskLevel === 'suspicious').length,
    deepfakeDetections: entries.filter((e) => e.result.riskLevel === 'deepfake').length,
    mostFlaggedDomains,
    scanTrends,
  };
};

export default function DashboardApp() {
  const [view, setView] = useState<DashboardView>('overview');
  const [entries, setEntries] = useState<DetectionEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DetectionEntry | null>(null);
  const [filters, setFilters] = useState({
    riskLevel: 'all' as string,
    mediaType: 'all' as string,
    domain: 'all' as string,
    dateRange: '7d' as string,
  });

  // Sync state with chrome.storage on mount and listen for real-time changes
  useEffect(() => {
    let cancelled = false;

    const loadHistory = () => {
      try {
        chrome.runtime.sendMessage(
          { type: 'GET_HISTORY' },
          (response: unknown) => {
            if (cancelled) return;
            const data =
              response && Array.isArray(response)
                ? (response as DetectionEntry[])
                : [];
            setEntries(data);
            setAnalytics(computeAnalytics(data));
          }
        );
      } catch {
        // Ignored if not in extension context
      }
    };

    loadHistory();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.truthlens_history && !cancelled) {
        const data = (changes.truthlens_history.newValue as DetectionEntry[]) || [];
        const now = Date.now();
        const valid = data.filter((e) => e.expiresAt > now);
        setEntries(valid);
        setAnalytics(computeAnalytics(valid));
      }
    };

    try {
      if (chrome?.storage?.local?.onChanged) {
        chrome.storage.local.onChanged.addListener(handleStorageChange);
      }
    } catch {
      // Ignored
    }

    return () => {
      cancelled = true;
      try {
        if (chrome?.storage?.local?.onChanged) {
          chrome.storage.local.onChanged.removeListener(handleStorageChange);
        }
      } catch {}
    };
  }, []);
  
  const handleClearHistory = () => {
    try {
      chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    } catch {
      // Demo mode
    }
    setEntries([]);
    setAnalytics(null);
  };

  const filteredEntries = entries.filter((e) => {
    if (filters.riskLevel !== 'all' && e.result.riskLevel !== filters.riskLevel) return false;
    if (filters.mediaType !== 'all' && e.result.mediaType !== filters.mediaType) return false;
    if (filters.domain !== 'all' && e.result.domain !== filters.domain) return false;
    return true;
  });

  const uniqueDomains = [...new Set(entries.map((e) => e.result.domain))];

  return (
    <div className="dashboard-container min-h-screen">
              <DashboardHeader view={view} onViewChange={(v) => setView(v as DashboardView)} />

      <main className="max-w-7xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {view === 'overview' && analytics && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <AnalyticsOverview analytics={analytics} />
            </motion.div>
          )}

          {(view === 'overview' || view === 'history') && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, delay: view === 'overview' ? 0.1 : 0 }}
            >
              <DetectionHistory
                entries={filteredEntries}
                filters={filters}
                domains={uniqueDomains}
                onFilterChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
                onSelectEntry={setSelectedEntry}
                onClearHistory={handleClearHistory}
              />
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <DashboardSettings />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <DetectionDetailModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
