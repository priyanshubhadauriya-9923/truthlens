import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Cloud, Trash2, Download, Code2, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Settings } from '../shared/types';

const DASHBOARD_DEFAULTS: Settings = {
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

export function DashboardSettings() {
  const [settings, setSettings] = useState<Settings>(DASHBOARD_DEFAULTS);

  useEffect(() => {
    try {
      chrome.storage.local.get('truthlens_settings', (result: Record<string, unknown>) => {
        const stored = result.truthlens_settings as Partial<Settings> | undefined;
        if (stored) {
          setSettings((prev) => ({ ...prev, ...stored }));
        }
      });
    } catch {
      // Not in extension context
    }
  }, []);

  const toggleSetting = (key: keyof Settings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    try {
      chrome.storage.local.set({ truthlens_settings: updated });
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: updated });
    } catch {
      // Not in extension context
    }
  };


  const sections = [
    {
      title: 'Privacy & Security',
      icon: Lock,
      items: [
        { key: 'localOnlyMode' as const, label: 'Local-Only Mode', desc: 'All analysis stays in your browser. No data ever leaves.', icon: Shield },
        { key: 'disableCloudAnalysis' as const, label: 'Disable Cloud Analysis', desc: 'Prevent any server-side inference requests.', icon: Cloud },
      ],
    },
    {
      title: 'Display',
      icon: Eye,
      items: [
        { key: 'showBadges' as const, label: 'Show Media Badges', desc: 'Display detection badges on scanned media.', icon: Eye },
        { key: 'autoScan' as const, label: 'Auto-Scan Pages', desc: 'Automatically scan media on page load.', icon: Bell },
      ],
    },
    {
      title: 'Advanced',
      icon: Code2,
      items: [
        { key: 'developerMode' as const, label: 'Developer Mode', desc: 'Show raw confidence logs and inference timing.', icon: Code2 },
      ],
    },
  ];

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Dashboard Settings</h2>
        <p className="text-sm text-slate-400">Configure scanning behavior, privacy, and display preferences</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          {sections.map((section, si) => {
            const SectionIcon = section.icon;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.1 }}
                className="glass-card"
              >
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                  <SectionIcon size={15} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-slate-200">{section.title}</h3>
                </div>
                <div className="space-y-3">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.key} className="flex items-center justify-between">
                        <div className="flex items-start gap-2.5">
                          <ItemIcon size={14} className="text-slate-400 mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-slate-200">{item.label}</div>
                            <div className="text-[10px] text-slate-500">{item.desc}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleSetting(item.key)}
                          className={`toggle ${settings[item.key] ? 'active' : ''}`}
                        >
                          <div className="toggle-knob" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card"
          >
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Data Management</h3>
            <div className="space-y-3">
              <button className="btn-secondary w-full justify-center text-xs">
                <Download size={13} />
                Export Detection History (CSV)
              </button>
              <button className="btn-secondary w-full justify-center text-xs">
                <Download size={13} />
                Export Detection History (PDF)
              </button>
              <button className="btn-danger w-full justify-center text-xs">
                <Trash2 size={13} />
                Clear All Detection Data
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-3">
              Detection data is stored locally and auto-deleted after 30 days.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card"
          >
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Privacy Notice</h3>
            <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <p>
                TruthLens prioritizes your privacy. All primary detection happens locally in your browser.
              </p>
              <p>
                Only suspicious media may be sent to our servers for deep analysis — and only with your
                explicit consent or if you enable cloud analysis.
              </p>
              <p>
                We do not track, store, or share your browsing activity. Detection history is stored
                locally and automatically expires after 30 days.
                <a href="/privacy" className="text-blue-400 hover:text-blue-300 ml-1">Learn more →</a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
