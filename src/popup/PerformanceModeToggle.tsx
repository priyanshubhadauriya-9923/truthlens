import { motion } from 'framer-motion';
import { Gauge, Zap, Target, type LucideIcon } from 'lucide-react';
import type { PerformanceMode } from '../shared/types';

interface PerformanceModeToggleProps {
  mode: PerformanceMode;
  onChange: (mode: PerformanceMode) => void;
}

const modes: { id: PerformanceMode; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'fast', label: 'Fast', icon: Zap, desc: 'Quick heuristics' },
  { id: 'balanced', label: 'Balanced', icon: Gauge, desc: 'Default mode' },
  { id: 'high-accuracy', label: 'Accurate', icon: Target, desc: 'Deep analysis' },
];

export function PerformanceModeToggle({ mode, onChange }: PerformanceModeToggleProps) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Performance Mode
      </h2>
      <div className="glass-card !p-2 flex gap-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(m.id)}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg text-center transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mode-bg"
                  className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon size={14} className="relative z-10" />
              <span className="text-[10px] font-medium relative z-10">{m.label}</span>
              <span className="text-[9px] text-slate-500 relative z-10">{m.desc}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
