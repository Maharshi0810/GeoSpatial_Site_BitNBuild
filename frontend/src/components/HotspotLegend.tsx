import React from 'react';
import { Info } from 'lucide-react';

interface HotspotLegendProps {
  mode: 'hotspots' | 'h3';
}

export const HotspotLegend: React.FC<HotspotLegendProps> = ({ mode }) => {
  if (mode === 'h3') {
    return (
      <div className="absolute bottom-16 right-4 z-20 bg-surface/95 backdrop-blur-md border border-slate-200/80 rounded-btn p-3 shadow-float text-xs max-w-xs transition-all duration-200">
        <div className="flex items-center gap-1.5 font-semibold text-ink mb-1.5">
          <Info className="w-3.5 h-3.5 text-brand-600" />
          <span>H3 Hexagonal Aggregation</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-2">
          Uber H3 Resolution 7 grid cells aggregated by spatial density & commercial activity.
        </p>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">High Density</span>
            <span className="font-mono text-slate-500">80 - 100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500" />
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>Low (0)</span>
            <span>Median</span>
            <span>Peak</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-16 right-4 z-20 bg-surface/95 backdrop-blur-md border border-slate-200/80 rounded-btn p-3 shadow-float text-xs max-w-xs transition-all duration-200">
      <div className="flex items-center gap-1.5 font-semibold text-ink mb-1.5">
        <Info className="w-3.5 h-3.5 text-brand-600" />
        <span>Getis-Ord Gi* Hotspot Analysis</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">
        Statistical significance test for spatial clustering of high (hot) and low (cold) values.
      </p>
      
      <div className="flex flex-col gap-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]" />
          <span className="font-medium text-slate-800">Hot Spot (99% confidence)</span>
          <span className="ml-auto font-mono text-slate-400 text-[10px]">z &gt; +2.58</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
          <span className="text-slate-700">Hot Spot (95% confidence)</span>
          <span className="ml-auto font-mono text-slate-400 text-[10px]">z &gt; +1.96</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#94a3b8]" />
          <span className="text-slate-500">Neutral (Not significant)</span>
          <span className="ml-auto font-mono text-slate-400 text-[10px]">|z| &lt; 1.65</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#06b6d4]" />
          <span className="text-slate-700">Cold Spot (95% confidence)</span>
          <span className="ml-auto font-mono text-slate-400 text-[10px]">z &lt; -1.96</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
          <span className="font-medium text-slate-800">Cold Spot (99% confidence)</span>
          <span className="ml-auto font-mono text-slate-400 text-[10px]">z &lt; -2.58</span>
        </div>
      </div>
    </div>
  );
};
