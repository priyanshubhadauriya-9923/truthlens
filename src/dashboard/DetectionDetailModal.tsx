import { motion } from 'framer-motion';
import { X, Globe, Clock, Cpu, Zap, Download, FileText, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DetectionEntry } from '../shared/types';
import { BADGE_COLORS, BADGE_LABELS } from '../shared/types';
import { formatDistanceToNow } from 'date-fns';

interface DetectionDetailModalProps {
  entry: DetectionEntry;
  onClose: () => void;
}

const RiskIcon: Record<string, LucideIcon> = {
  authentic: CheckCircle,
  suspicious: AlertTriangle,
  deepfake: ShieldAlert,
};

export function DetectionDetailModal({ entry, onClose }: DetectionDetailModalProps) {
  const { result } = entry;
  const Icon = RiskIcon[result.riskLevel];
  const riskColor = BADGE_COLORS[result.riskLevel];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg glass-card !p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${riskColor}15` }}
            >
              <Icon size={24} style={{ color: riskColor }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{BADGE_LABELS[result.riskLevel]}</h3>
              <p className="text-sm text-slate-400">
                {Math.round(result.confidence * 100)}% confidence score
              </p>
            </div>
          </div>

          {/* Confidence bar */}
          <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(result.confidence * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: riskColor }}
            />
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={Globe} label="Domain" value={result.domain} />
            <DetailItem icon={Clock} label="Scanned" value={formatDistanceToNow(result.timestamp, { addSuffix: true })} />
            <DetailItem icon={Cpu} label="AI Model" value={result.modelUsed} />
            <DetailItem icon={Zap} label="Scan Duration" value={`${result.scanDuration}ms`} />
          </div>

          {/* Detection Reasons */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Detection Reasons
            </h4>
            <div className="space-y-1.5">
              {result.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scan Source */}
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-white/5">
            <span>Scan source: {result.scanSource === 'local' ? 'Local analysis' : result.scanSource === 'cloud' ? 'Cloud analysis' : 'Hybrid analysis'}</span>
            <span className="text-slate-700">·</span>
            <span>Media: {result.mediaType}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2">
          <button className="btn-secondary flex-1 text-xs justify-center">
            <Download size={12} />
            Export PDF
          </button>
          <button className="btn-secondary flex-1 text-xs justify-center">
            <FileText size={12} />
            Copy Report
          </button>
          <a
            href={result.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 text-xs justify-center"
          >
            Open Page
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="glass-light rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-slate-500" />
        <span className="text-[10px] text-slate-500 font-medium">{label}</span>
      </div>
      <span className="text-xs text-slate-200 font-medium truncate block">{value}</span>
    </div>
  );
}
