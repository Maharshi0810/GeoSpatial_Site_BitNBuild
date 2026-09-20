import React from 'react';
import { Wind, Info } from 'lucide-react';

export const WindLegend: React.FC = () => {
  const colorBands = [
    { label: '< 5.0', color: '#3b82f6', tier: 'Low' },
    { label: '5.5', color: '#06b6d4', tier: 'Marginal' },
    { label: '6.2', color: '#22c55e', tier: 'Moderate' },
    { label: '7.0', color: '#facc15', tier: 'Viable' },
    { label: '7.8', color: '#f97316', tier: 'Strong' },
    { label: '8.4+', color: '#b91c1c', tier: 'Prime Tier 1' },
  ];

  return (
    <div className="bg-surface/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-card p-3 shadow-lg max-w-[280px] pointer-events-auto select-none transition-all">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Wind className="w-3.2 h-3.2" strokeWidth={2.2} />
          </div>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Wind Mean Speed
          </span>
        </div>
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50">
          120m Hub
        </span>
      </div>

      {/* Gradient Bar */}
      <div className="relative mb-2">
        <div 
          className="h-3.5 w-full rounded-sm shadow-inner"
          style={{
            background: 'linear-gradient(to right, #3b82f6 0%, #06b6d4 20%, #22c55e 40%, #facc15 65%, #f97316 85%, #b91c1c 100%)'
          }}
        />
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 dark:text-slate-400 mt-1">
          {colorBands.map((band, idx) => (
            <span key={idx} className="tracking-tighter">
              {band.label}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>VORTEX / NIWE Atlas</span>
        </span>
        <span className="font-medium text-amber-600 dark:text-amber-400">
          Unit: m/s
        </span>
      </div>
    </div>
  );
};
