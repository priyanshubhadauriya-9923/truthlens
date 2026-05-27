import { motion } from 'framer-motion';
import { ArrowLeft, Image, Video, Music, Eye, Cloud, Code2 } from 'lucide-react';
import type { Settings } from '../shared/types';

interface SettingsViewProps {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  onBack: () => void;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`toggle ${checked ? 'active' : ''}`}
    >
      <div className="toggle-knob" />
    </button>
  );
}

export function SettingsView({ settings, onUpdate, onBack }: SettingsViewProps) {
  const settingsItems = [
    {
      section: 'Media Scanning',
      items: [
        {
          label: 'Scan Images',
          key: 'scanImages' as const,
          icon: Image,
          desc: 'Detect deepfake images',
        },
        {
          label: 'Scan Videos',
          key: 'scanVideos' as const,
          icon: Video,
          desc: 'Analyze video frames',
        },
        {
          label: 'Scan Audio',
          key: 'scanAudio' as const,
          icon: Music,
          desc: 'Voice synthesis detection',
        },
      ],
    },
    {
      section: 'Display',
      items: [
        {
          label: 'Show Badges',
          key: 'showBadges' as const,
          icon: Eye,
          desc: 'Display result badges on media',
        },
        {
          label: 'Auto-Scan Pages',
          key: 'autoScan' as const,
          icon: Eye,
          desc: 'Automatically scan on page load',
        },
      ],
    },
    {
      section: 'Privacy',
      items: [
        {
          label: 'Local-Only Mode',
          key: 'localOnlyMode' as const,
          icon: Cloud,
          desc: 'Disable all cloud analysis',
        },
        {
          label: 'Disable Cloud',
          key: 'disableCloudAnalysis' as const,
          icon: Cloud,
          desc: 'No server-side inference',
        },
      ],
    },
    {
      section: 'Developer',
      items: [
        {
          label: 'Developer Mode',
          key: 'developerMode' as const,
          icon: Code2,
          desc: 'Show raw confidence logs',
        },
      ],
    },
  ];

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <ArrowLeft size={16} />
        </motion.button>
        <h2 className="text-sm font-semibold text-white">Settings</h2>
      </div>

      <div className="space-y-4">
        {settingsItems.map((section, si) => (
          <motion.div
            key={section.section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.05 }}
          >
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              {section.section}
            </h3>
            <div className="glass-card !p-0 divide-y divide-slate-700/30">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={14} className="text-slate-400" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{item.desc}</div>
                      </div>
                    </div>
                    <Toggle
                      checked={settings[item.key] as boolean}
                      onChange={(v) => onUpdate({ [item.key]: v })}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
