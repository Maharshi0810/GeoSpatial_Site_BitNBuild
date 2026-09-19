import React from 'react';
import {
  Trophy,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Loader2,
} from 'lucide-react';
import { CandidateSite } from '@/mocks/mockDataService';
import { CompareResult } from '@/hooks/useCompareApi';

export interface ComparePanelProps {
  sites: CandidateSite[];
  compareResult: CompareResult | null;
  isLoading: boolean;
  onRemoveSite: (id: string) => void;
  onClearSites: () => void;
  onRunCompare: () => void;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({
  sites,
  compareResult,
  isLoading,
  onRemoveSite,
  onClearSites,
  onRunCompare,
}) => {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top action row inside comparison tray */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">
            {sites.length} {sites.length === 1 ? 'Site' : 'Sites'} in comparison queue
          </span>
          <span className="text-[11px] text-slate-500">
            (click candidate locations on map and select &quot;Add to comparison&quot;)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {sites.length > 0 && (
            <button
              onClick={onClearSites}
              className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-red-700 hover:bg-slate-100 rounded-chip transition-colors flex items-center gap-1"
              title="Clear all candidate sites"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}

          <button
            onClick={onRunCompare}
            disabled={sites.length < 2 || isLoading}
            className={`px-3 py-1 text-xs font-semibold rounded-btn transition-colors flex items-center gap-1.5 shadow-sm ${
              sites.length < 2
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 text-surface'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Comparison ({sites.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Summary Banner (if analysis was run) */}
      {compareResult && (
        <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-btn flex items-center gap-2.5 text-xs">
          <div className="w-6 h-6 rounded-full bg-brand-600 text-surface flex items-center justify-center shrink-0">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-brand-900 mr-1.5">Best Candidate Identified:</span>
            <span className="text-brand-800">{compareResult.comparisonSummary}</span>
          </div>
          {compareResult.bestSite && (
            <span className="px-2 py-0.5 bg-brand-600 text-surface font-mono font-semibold rounded-chip text-[11px] shrink-0">
              {compareResult.bestSite}
            </span>
          )}
        </div>
      )}

      {/* Horizontal Cards Reel */}
      <div className="flex-1 flex items-stretch gap-3 overflow-x-auto pb-1">
        {sites.map((site) => {
          const evalSite = compareResult?.sites.find(
            (s) => s.id === site.id || s.label === site.name
          );
          const isBest =
            compareResult?.bestSite &&
            (compareResult.bestSite === site.name || evalSite?.label === compareResult.bestSite);

          return (
            <div
              key={site.id}
              className={`w-64 shrink-0 p-3 bg-surface rounded-btn flex flex-col justify-between transition-all border ${
                isBest
                  ? 'border-brand-600 ring-2 ring-brand-500/20 shadow-md'
                  : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex flex-col max-w-[170px]">
                    <span className="font-semibold text-ink text-xs truncate" title={site.name}>
                      {site.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-base font-bold text-brand-600 leading-none">
                        {evalSite ? evalSite.score : site.score}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">/100</span>
                    </div>
                    {evalSite?.grade && (
                      <span className="text-[10px] font-mono font-semibold text-slate-600">
                        Grade {evalSite.grade}
                      </span>
                    )}
                  </div>
                </div>

                {isBest && (
                  <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-semibold rounded-chip">
                    <Sparkles className="w-3 h-3 text-brand-600" />
                    <span>Top Ranked Site</span>
                  </div>
                )}
              </div>

              {/* Card Bottom: Site Type + Remove button */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="px-1.5 py-0.5 bg-canvas border border-slate-200 text-slate-600 rounded-chip text-[10px] font-mono uppercase">
                  {site.siteType.replace('_', ' ')}
                </span>

                <button
                  onClick={() => onRemoveSite(site.id)}
                  className="text-slate-400 hover:text-red-700 p-1 hover:bg-slate-100 rounded-chip transition-colors flex items-center gap-1"
                  title="Remove candidate"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Add More Slot Placeholder */}
        {sites.length < 6 && (
          <div className="w-48 shrink-0 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-btn flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center transition-colors">
            <Plus className="w-5 h-5 mb-1 text-slate-400" />
            <span className="font-medium text-[11px]">Select site on map</span>
            <span className="text-[10px] text-slate-400 mt-0.5">to queue for comparison</span>
          </div>
        )}
      </div>
    </div>
  );
};
