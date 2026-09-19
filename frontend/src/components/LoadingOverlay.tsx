import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  isFullPanel?: boolean;
  className?: string;
}

/**
 * LoadingOverlay component owned by Maharshi (Phase 1C).
 * Provides an accessible, subtle shimmer loading state without blocking map visibility.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Calculating site readiness...',
  isFullPanel = false,
  className = '',
}) => {
  if (!isFullPanel) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`flex items-center gap-2 p-3 bg-surface/90 border border-slate-200 rounded-btn shadow-float backdrop-blur-sm ${className}`}
      >
        <Loader2 className="w-4 h-4 text-brand-600 animate-spin" strokeWidth={1.75} />
        <span className="text-xs text-slate-700 font-medium">{message}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-surface/75 backdrop-blur-[2px] p-6 text-center ${className}`}
    >
      <div className="flex flex-col items-center gap-3 p-4 bg-surface border border-slate-200 rounded-panel shadow-float max-w-xs w-full">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" strokeWidth={1.75} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink">{message}</p>
          <p className="text-xs text-slate-500">Querying geospatial layers and travel models</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton row for score panel factor breakdown loading state.
 */
export const SkeletonFactorRow: React.FC = () => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-none animate-pulse opacity-60">
    <div className="h-3 w-28 bg-slate-200 rounded-chip" />
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 bg-slate-200 rounded-chip" />
      <div className="h-3 w-10 bg-slate-200 rounded-chip" />
    </div>
  </div>
);

/**
 * Skeleton list for score breakdown cards.
 */
export const ScorePanelSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4 p-4 animate-pulse opacity-70">
    <div className="flex items-center gap-3">
      <div className="h-10 w-16 bg-slate-200 rounded-btn" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 w-3/4 bg-slate-200 rounded-chip" />
        <div className="h-2 w-1/2 bg-slate-200 rounded-chip" />
      </div>
    </div>
    <div className="h-2 w-full bg-slate-200 rounded-chip" />
    <div className="flex flex-col gap-2 mt-2">
      <SkeletonFactorRow />
      <SkeletonFactorRow />
      <SkeletonFactorRow />
      <SkeletonFactorRow />
      <SkeletonFactorRow />
    </div>
  </div>
);
