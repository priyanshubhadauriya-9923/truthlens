import { motion } from 'framer-motion';
import { Scan, Pause, Play, Trash2, LayoutDashboard } from 'lucide-react';
import type { PageStatus } from '../shared/types';

interface QuickActionsProps {
  status: PageStatus;
  onAction: (action: string) => void;
}

export function QuickActions({ status, onAction }: QuickActionsProps) {
  const actions = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      variant: 'secondary' as const,
    },
    {
      id: 'scan',
      label: 'Analyze Page',
      icon: Scan,
      variant: 'primary' as const,
    },
    {
      id: 'pause',
      label: status.isPaused ? 'Resume' : 'Pause',
      icon: status.isPaused ? Play : Pause,
      variant: 'secondary' as const,
    },
    {
      id: 'clear',
      label: 'Clear',
      icon: Trash2,
      variant: 'danger' as const,
    },
  ];

  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Quick Actions
      </h2>
      <div className="grid grid-cols-4 gap-1.5">
        {actions.map((action, i) => {
          const Icon = action.icon;
          const variantClass =
            action.variant === 'primary'
              ? 'btn-primary'
              : action.variant === 'danger'
              ? 'btn-danger'
              : 'btn-secondary';

          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAction(action.id)}
              className={`${variantClass} flex-col !gap-1 !py-2.5 !px-2 !text-[10px]`}
            >
              <Icon size={15} />
              <span>{action.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
