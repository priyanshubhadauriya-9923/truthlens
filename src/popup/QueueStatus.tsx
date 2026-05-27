import { motion } from 'framer-motion';
import { Loader2, Clock, Layers } from 'lucide-react';
import type { PageStatus } from '../shared/types';

interface QueueStatusProps {
  status: PageStatus;
}

export function QueueStatus({ status }: QueueStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card !p-3"
    >
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Queue Status
      </h2>

      <div className="space-y-2">
        {/* Currently scanning */}
        <div className="flex items-center gap-2">
          {status.isScanning ? (
            <Loader2 size={13} className="text-blue-400 animate-spin" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
          )}
          <span className="text-[11px] text-slate-300 truncate flex-1">
            {status.currentlyScanning
              ? decodeURIComponent(status.currentlyScanning.split('/').pop() || 'Unknown media')
              : 'No media scanning'}
          </span>
        </div>

        {/* Queue stats */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-400">
              {status.queueLength} in queue
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-400">
              Avg: {status.averageScanSpeed}ms
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {status.totalMedia > 0 && (
          <div className="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(
                  (status.scannedCount / status.totalMedia) * 100,
                  100
                )}%`,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
