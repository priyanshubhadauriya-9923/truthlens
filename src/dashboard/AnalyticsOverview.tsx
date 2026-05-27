import { motion } from 'framer-motion';
import { Scan, AlertTriangle, ShieldAlert, Globe, TrendingUp, Activity } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { AnalyticsSummary } from '../shared/types';

interface AnalyticsOverviewProps {
  analytics: AnalyticsSummary;
}

export function AnalyticsOverview({ analytics }: AnalyticsOverviewProps) {
  const statCards = [
    {
      label: 'Total Scans',
      value: analytics.totalScans.toLocaleString(),
      icon: Scan,
      color: 'text-blue-400',
      bg: 'from-blue-500/10 to-blue-600/5',
    },
    {
      label: 'Suspicious',
      value: analytics.suspiciousDetections.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-amber-600/5',
    },
    {
      label: 'Deepfake Risk',
      value: analytics.deepfakeDetections.toLocaleString(),
      icon: ShieldAlert,
      color: 'text-red-400',
      bg: 'from-red-500/10 to-red-600/5',
    },
    {
      label: 'Detection Rate',
      value: analytics.totalScans > 0
        ? `${Math.round(((analytics.suspiciousDetections + analytics.deepfakeDetections) / analytics.totalScans) * 100)}%`
        : '0%',
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/10 to-emerald-600/5',
    },
  ];

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Analytics Overview</h2>
        <p className="text-sm text-slate-400">Detection trends and flagged domain insights</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center`}>
                  <Icon size={18} className={stat.color} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
              <div className="text-xs text-slate-400 font-medium mt-1">{stat.label}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card col-span-2"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Scan Trends (7 Days)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.scanTrends}>
                <defs>
                  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="flagGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.2)" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#scanGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="flagged"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#flagGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Most Flagged Domains</h3>
          </div>
          <div className="space-y-3">
            {analytics.mostFlaggedDomains.slice(0, 5).map((domain, i) => (
              <div key={domain.domain} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-xs text-slate-300 truncate">{domain.domain}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">{domain.totalScans} scans</span>
                  <div className={`risk-pill ${domain.riskScore > 60 ? 'deepfake' : domain.riskScore > 30 ? 'suspicious' : 'authentic'}`}>
                    {Math.round(domain.riskScore)}%
                  </div>
                </div>
              </div>
            ))}
            {analytics.mostFlaggedDomains.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No domain data yet</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
