import { motion } from 'framer-motion';
import { Image, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import type { PageStatus } from '../shared/types';

interface StatusPanelProps {
  status: PageStatus;
}

export function StatusPanel({ status }: StatusPanelProps) {
  const stats = [
    {
      label: 'Total Media',
      value: status.totalMedia,
      icon: Image,
      color: 'text-blue-400',
      bg: 'from-blue-500/10 to-blue-600/5',
    },
    {
      label: 'Scanned',
      value: status.scannedCount,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/10 to-emerald-600/5',
    },
    {
      label: 'Suspicious',
      value: status.suspiciousCount,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-amber-600/5',
    },
    {
      label: 'Deepfake Risk',
      value: status.deepfakeCount,
      icon: ShieldAlert,
      color: 'text-red-400',
      bg: 'from-red-500/10 to-red-600/5',
    },
  ];

  return (
    <div>
      {status.isOffline && (
        <div className="mb-3 p-2 rounded-md bg-red-500/10 border border-red-500/20 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-red-400">
            <ShieldAlert size={14} />
            <span className="text-xs font-semibold">No Internet Connection</span>
          </div>
          <p className="text-[10px] text-red-400/80 leading-tight">
            Media scanning is paused. Please connect to the internet to resume detection.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Current Page
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={`status-dot ${
              status.isScanning ? 'active' : status.isPaused ? 'paused' : 'idle'
            }`}
          />
          <span className="text-[10px] text-slate-400 font-medium">
            {status.isScanning ? 'Scanning' : status.isPaused ? 'Paused' : 'Idle'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="glass-card !p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-6 h-6 rounded-md bg-gradient-to-br ${stat.bg} flex items-center justify-center`}
                >
                  <Icon size={13} className={stat.color} />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{stat.label}</span>
              </div>
              <div className="text-lg font-bold text-white tracking-tight">{stat.value}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
