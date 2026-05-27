import { motion } from 'framer-motion';
import { Shield, Settings, Lock, X } from 'lucide-react';

interface PopupHeaderProps {
  onSettingsClick: () => void;
  onPrivacyClick: () => void;
  currentView: string;
}

export function PopupHeader({ onSettingsClick, onPrivacyClick, currentView }: PopupHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield size={18} className="text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-slate-900" />
          </motion.div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">TruthLens</h1>
            <p className="text-[10px] text-slate-400 font-medium">Deepfake Detection Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPrivacyClick}
            className={`p-1.5 rounded-md transition-colors ${
              currentView === 'privacy'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
            title="Privacy"
          >
            {currentView === 'privacy' ? <X size={15} /> : <Lock size={15} />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSettingsClick}
            className={`p-1.5 rounded-md transition-colors ${
              currentView === 'settings'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
            title="Settings"
          >
            {currentView === 'settings' ? <X size={15} /> : <Settings size={15} />}
          </motion.button>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="mt-3 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent" />
    </div>
  );
}
