import { motion } from 'framer-motion';
import { Image, Video, Music, ExternalLink, Trash2, Filter, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DetectionEntry } from '../shared/types';
import { BADGE_LABELS } from '../shared/types';

interface DetectionHistoryProps {
  entries: DetectionEntry[];
  filters: {
    riskLevel: string;
    mediaType: string;
    domain: string;
    dateRange: string;
  };
  domains: string[];
  onFilterChange: (f: Partial<DetectionHistoryProps['filters']>) => void;
  onSelectEntry: (e: DetectionEntry) => void;
  onClearHistory: () => void;
}

const mediaTypeIcons = {
  image: Image,
  video: Video,
  audio: Music,
};

export function DetectionHistory({
  entries,
  filters,
  domains,
  onFilterChange,
  onSelectEntry,
  onClearHistory,
}: DetectionHistoryProps) {
  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Detection History</h2>
          <p className="text-sm text-slate-400">{entries.length} flagged detections recorded</p>
        </div>
        <button onClick={onClearHistory} className="btn-danger text-xs">
          <Trash2 size={13} />
          Clear All
        </button>
      </div>

      <div className="glass-card !p-3 flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        <select
          value={filters.riskLevel}
          onChange={(e) => onFilterChange({ riskLevel: e.target.value })}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Risk Levels</option>
          <option value="suspicious">Suspicious</option>
          <option value="deepfake">Deepfake Risk</option>
        </select>
        <select
          value={filters.mediaType}
          onChange={(e) => onFilterChange({ mediaType: e.target.value })}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Media Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </select>
        <select
          value={filters.domain}
          onChange={(e) => onFilterChange({ domain: e.target.value })}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {entries.map((entry, i) => {
          const TypeIcon = mediaTypeIcons[entry.result.mediaType];
          const isDeepfake = entry.result.riskLevel === 'deepfake';
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              whileHover={{ scale: 1.002 }}
              onClick={() => onSelectEntry(entry)}
              className="glass-card !p-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDeepfake ? 'bg-red-500/10' : 'bg-amber-500/10'
                }`}>
                  <TypeIcon size={18} className={isDeepfake ? 'text-red-400' : 'text-amber-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`risk-pill ${entry.result.riskLevel} text-[10px]`}>
                      {BADGE_LABELS[entry.result.riskLevel]} • {Math.round(entry.result.confidence * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Globe size={10} />
                    <span className="truncate">{entry.result.domain}</span>
                    <span className="text-slate-600">·</span>
                    <span>{entry.result.modelUsed}</span>
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          );
        })}
        {entries.length === 0 && (
          <div className="glass-card text-center py-12">
            <ShieldAlert size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No flagged detections yet</p>
            <p className="text-xs text-slate-500 mt-1">Only suspicious and deepfake-risk media are recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldAlert({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
