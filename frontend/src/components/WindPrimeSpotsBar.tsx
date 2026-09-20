import React from 'react';
import { Zap } from 'lucide-react';

export interface PrimeSpotItem {
  id: string;
  name: string;
  short_name: string;
  lat: number;
  lng: number;
  speed_ms: number;
  tier: string;
  cuf_pct: number;
  highlight: string;
}

interface WindPrimeSpotsBarProps {
  primeSpots: PrimeSpotItem[];
  onSelectSpot: (spot: PrimeSpotItem) => void;
  selectedSpotId?: string | null;
}

export const WindPrimeSpotsBar: React.FC<WindPrimeSpotsBarProps> = ({
  primeSpots,
  onSelectSpot,
  selectedSpotId,
}) => {
  if (!primeSpots || primeSpots.length === 0) return null;

  return (
    <div className="bg-surface/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 max-w-full overflow-x-auto select-none pointer-events-auto transition-all">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 pr-1.5 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] tracking-tight uppercase text-slate-500 dark:text-slate-400">Wind Corridors</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {primeSpots.map((spot) => {
          const isSelected = selectedSpotId === spot.id;
          return (
            <button
              key={spot.id}
              onClick={() => onSelectSpot(spot)}
              title={`${spot.name} — ${spot.speed_ms} m/s (${spot.tier})`}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/40'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 border border-slate-200/60 dark:border-slate-700/50'
              }`}
            >
              <Zap className={`w-3 h-3 ${isSelected ? 'text-amber-300' : 'text-amber-500'}`} />
              <span>{spot.short_name}</span>
              <span className={`font-mono text-[10px] px-1 rounded ${
                isSelected 
                  ? 'bg-red-700/80 text-white' 
                  : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
              }`}>
                {spot.speed_ms}m/s
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
