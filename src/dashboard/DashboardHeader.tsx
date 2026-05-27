import { motion } from 'framer-motion';
import { Shield, BarChart3, History, Settings, ExternalLink, type LucideIcon } from 'lucide-react';

interface DashboardHeaderProps {
  view: string;
  onViewChange: (v: string) => void;
}

const navItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function DashboardHeader({ view, onViewChange }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5" />
      <div className="relative max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
            <Shield size={20} className="text-white" />
          </motion.div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">TruthLens</h1>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">Detection Dashboard</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onViewChange(item.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={15} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <a
          href="https://github.com/truthlens"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ExternalLink size={18} />
        </a>
      </div>
    </header>
  );
}
