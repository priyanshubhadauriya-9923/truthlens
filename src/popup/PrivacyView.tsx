import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Lock, Eye, Trash2, Server } from 'lucide-react';

interface PrivacyViewProps {
  onBack: () => void;
}

export function PrivacyView({ onBack }: PrivacyViewProps) {
  const handleClearAll = () => {
    try {
      chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
      chrome.storage.local.clear();
    } catch {
      // Demo mode
    }
  };

  const principles = [
    {
      icon: Shield,
      title: 'Privacy-First Architecture',
      desc: 'All primary analysis happens locally in your browser. No media is uploaded without your explicit consent.',
    },
    {
      icon: Lock,
      title: 'Encrypted Storage',
      desc: 'Detection results are encrypted locally and auto-deleted after 30 days.',
    },
    {
      icon: Eye,
      title: 'No Tracking',
      desc: 'TruthLens does not track your browsing activity. We only analyze media content when requested.',
    },
    {
      icon: Server,
      title: 'Optional Cloud Analysis',
      desc: 'Deep analysis via our servers is opt-in only. Media is anonymized and not retained.',
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
        <h2 className="text-sm font-semibold text-white">Privacy & Security</h2>
      </div>

      <div className="space-y-2.5">
        {principles.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card !p-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={14} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-200 mb-0.5">{p.title}</h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Clear All Data */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-4 pt-3 border-t border-slate-700/50"
      >
        <button
          onClick={handleClearAll}
          className="btn-danger w-full justify-center"
        >
          <Trash2 size={14} />
          Clear All Data
        </button>
        <p className="text-[9px] text-slate-500 text-center mt-2">
          This will permanently delete all detection history, cache, and settings.
        </p>
      </motion.div>
    </div>
  );
}
