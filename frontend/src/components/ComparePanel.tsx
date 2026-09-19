import React, { useState } from "react";
import {
  Trophy,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Loader2,
  CheckCircle2,
  MapPin,
  Target,
} from "lucide-react";
import { CandidateSite, ScoreResponse } from "@/mocks/mockDataService";
import { CompareResult } from "@/hooks/useCompareApi";

export interface ComparePanelProps {
  sites: CandidateSite[];
  compareResult: CompareResult | null;
  isLoading: boolean;
  onRemoveSite: (id: string) => void;
  onClearSites: () => void;
  onRunCompare: () => void;
  /** Current scored location - enables "Add current site" from within Compare tab */
  currentSite?: ScoreResponse | null;
  onAddCurrentSite?: () => void;
  /** Navigate to score tab so user can pick a site from the map */
  onGoToScore?: () => void;
  /** Map picking mode */
  isPickingSite?: boolean;
  onStartPickSite?: () => void;
  onCancelPickSite?: () => void;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({
  sites,
  compareResult,
  isLoading,
  onRemoveSite,
  onClearSites,
  onRunCompare,
  currentSite,
  onAddCurrentSite,
  onGoToScore,
  isPickingSite = false,
  onStartPickSite,
  onCancelPickSite,
}) => {
  const [addedFeedback, setAddedFeedback] = useState(false);

  const handleAddCurrent = () => {
    if (!onAddCurrentSite) return;
    onAddCurrentSite();
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  // Check if the current site is already in the queue
  const currentAlreadyAdded = currentSite
    ? sites.some(
        (s) =>
          Math.abs(s.lat - currentSite.coordinates.lat) < 0.0001 &&
          Math.abs(s.lng - currentSite.coordinates.lng) < 0.0001
      )
    : false;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top action row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">
            {sites.length} {sites.length === 1 ? "Site" : "Sites"} queued
          </span>
          {sites.length < 2 && (
            <span className="text-[11px] text-slate-500">
              (need at least 2 to compare)
            </span>
          )}
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
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-surface"
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

      {/* Active picking helper banner */}
      {isPickingSite && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-brand-950/60 border border-brand-500/60 rounded-btn text-xs text-brand-300 animate-pulse">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-400 shrink-0 animate-bounce" />
            <span className="font-semibold text-white">Click any point on the map</span>
            <span className="text-slate-300">to add it to comparison</span>
          </div>
          {onCancelPickSite && (
            <button
              onClick={onCancelPickSite}
              className="text-[11px] underline text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Add current site quick bar — visible when there is a scored location not yet queued */}
      {currentSite && !currentAlreadyAdded && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-btn text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
              <Target className="w-3 h-3 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-ink truncate text-[11px]">
                {currentSite.locationName}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Score: {currentSite.score}/100
              </span>
            </div>
          </div>
          <button
            onClick={handleAddCurrent}
            disabled={addedFeedback}
            className={`shrink-0 h-7 px-2.5 text-[11px] font-semibold rounded-chip transition-all flex items-center gap-1 ${
              addedFeedback
                ? "bg-emerald-600 text-white"
                : "bg-brand-600 hover:bg-brand-700 text-white"
            }`}
            title="Add current map location to comparison"
          >
            {addedFeedback ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>Add this site</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Already-added notice */}
      {currentSite && currentAlreadyAdded && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-btn text-[11px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Current location already queued</span>
        </div>
      )}

      {/* Comparison Summary Banner */}
      {compareResult && (
        <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-btn flex items-center gap-2.5 text-xs">
          <div className="w-6 h-6 rounded-full bg-brand-600 text-surface flex items-center justify-center shrink-0">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-brand-900 mr-1.5">Best Candidate:</span>
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
              className={`w-56 shrink-0 p-3 bg-surface rounded-btn flex flex-col justify-between transition-all border ${
                isBest
                  ? "border-brand-600 ring-2 ring-brand-500/20 shadow-md"
                  : "border-slate-200 shadow-sm hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex flex-col max-w-[140px]">
                    <span className="font-semibold text-ink text-xs truncate" title={site.name}>
                      {site.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-0.5">
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
                    <span>Top Ranked</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="px-1.5 py-0.5 bg-canvas border border-slate-200 text-slate-600 rounded-chip text-[10px] font-mono uppercase">
                  {site.siteType.replace("_", " ")}
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

        {/* Add More Slot — clickable, triggers site selection on map */}
        {sites.length < 6 && (
          <button
            onClick={isPickingSite ? onCancelPickSite : (onStartPickSite || onGoToScore)}
            className={`w-52 shrink-0 border-2 border-dashed rounded-btn flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer group ${
              isPickingSite
                ? "border-brand-500 bg-brand-950/40 text-brand-300 ring-2 ring-brand-500/30 animate-pulse"
                : "border-slate-800 hover:border-brand-500 bg-canvas hover:bg-brand-950/20 text-slate-400 hover:text-brand-300"
            }`}
            title={
              isPickingSite
                ? "Click anywhere on the map to select, or click here to cancel"
                : "Click to select a site on the map"
            }
          >
            {isPickingSite ? (
              <>
                <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center mb-1.5 text-brand-400">
                  <MapPin className="w-4 h-4 animate-bounce" />
                </div>
                <span className="font-semibold text-xs text-brand-300">
                  Click map to select
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Pick any Gujarat point
                </span>
                <span className="mt-2 px-2 py-0.5 bg-brand-600/20 text-brand-300 rounded text-[9px] font-mono">
                  Tap to cancel
                </span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full border border-dashed border-current flex items-center justify-center mb-1.5 group-hover:border-brand-400 group-hover:scale-105 transition-all">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs leading-tight group-hover:text-brand-300">
                  Select site on map
                </span>
                <span className="text-[10px] opacity-75 mt-0.5">
                  to queue for comparison
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
