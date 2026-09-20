/**
 * DrawToolbar — Windows Snipping Tool-style Floating Toolbar for Custom Area Selection & Catchment Scoring.
 *
 * Owner: Daksh [D]
 *
 * Features:
 * - Windows Snipping Tool-style clean floating white pill at top-center of map
 * - Clear active mode indicators with step-by-step guidance
 * - Dedicated "Done" button so users don't have to rely solely on double-clicking
 * - Disables conflicting map actions during active drawing
 * - Accidental-click protection: finished polygons are locked and won't reset on map clicks
 * - "Score Area" button directly on the bar and in HUD
 * - "Clear" and "Exit" buttons to cleanly restore normal map navigation
 */

import React from 'react';
import {
  Pentagon,
  Square,
  Trash2,
  Target,
  Check,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export type DrawMode = 'none' | 'polygon' | 'rectangle';

export interface DrawnPolygon {
  /** GeoJSON coordinates ring [[lng,lat], ...] */
  coordinates: number[][];
  /** Area in square kilometers */
  areaKm2: number;
  /** Centroid [lng, lat] */
  centroid: [number, number];
}

export interface DrawToolbarProps {
  drawMode: DrawMode;
  onSetDrawMode: (mode: DrawMode) => void;
  drawnPolygon: DrawnPolygon | null;
  vertexCount: number;
  onClear: () => void;
  onScorePolygon: () => void;
  onFinishPolygon?: () => void;
  onClose?: () => void;
  isScoring?: boolean;
  scoringError?: string | null;
}

export const DrawToolbar: React.FC<DrawToolbarProps> = ({
  drawMode,
  onSetDrawMode,
  drawnPolygon,
  vertexCount,
  onClear,
  onScorePolygon,
  onFinishPolygon,
  onClose,
  isScoring = false,
  scoringError = null,
}) => {
  const isDrawing = drawMode !== 'none';
  const hasShape = !!drawnPolygon;
  const isPolygonMode = drawMode === 'polygon';
  const isRectangleMode = drawMode === 'rectangle';
  const canFinishPolygon = isPolygonMode && vertexCount >= 3;

  return (
    <>
      {/* 1. Windows Snipping Tool-Style Floating Bar (Top-Center of Map) */}
      {(isDrawing || hasShape) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 shadow-2xl border border-slate-200/90 dark:border-slate-700/90 rounded-full px-3 py-1.5 flex items-center gap-2 select-none ring-1 ring-black/5">
            {/* Tool Mode Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-full">
              <button
                type="button"
                onClick={() => onSetDrawMode('polygon')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isPolygonMode
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-ink hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="Polygon tool: click to add points, click Done to close"
              >
                <Pentagon className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Polygon</span>
              </button>

              <button
                type="button"
                onClick={() => onSetDrawMode('rectangle')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isRectangleMode
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-ink hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="Rectangle tool: click 2 opposite corners"
              >
                <Square className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Rectangle</span>
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Instruction / Live Status Readout */}
            <div className="flex items-center gap-2 px-1 text-xs">
              {isDrawing && !hasShape && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping shrink-0" />
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    {isPolygonMode ? (
                      vertexCount === 0 ? (
                        'Click map to start polygon'
                      ) : vertexCount < 3 ? (
                        `Added ${vertexCount} point${vertexCount > 1 ? 's' : ''} · click next corner`
                      ) : (
                        `Added ${vertexCount} points · click Done to close`
                      )
                    ) : vertexCount === 0 ? (
                      'Click 1st corner'
                    ) : (
                      'Click opposite corner to finish'
                    )}
                  </span>
                </div>
              )}

              {hasShape && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Area:{' '}
                    {drawnPolygon.areaKm2 < 1
                      ? `${(drawnPolygon.areaKm2 * 100).toFixed(1)} ha`
                      : `${drawnPolygon.areaKm2.toFixed(2)} km²`}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    (Locked & Protected)
                  </span>
                </div>
              )}
            </div>

            {/* Action: Done Button (Explicit polygon closure) */}
            {canFinishPolygon && onFinishPolygon && (
              <button
                type="button"
                onClick={onFinishPolygon}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-full transition-all shadow-xs"
                title="Finish and close polygon"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span>Done</span>
              </button>
            )}

            {/* Action: Score Area Button */}
            {hasShape && (
              <button
                type="button"
                onClick={onScorePolygon}
                disabled={isScoring}
                className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white text-xs font-semibold rounded-full transition-all shadow-xs disabled:opacity-50"
                title="Calculate readiness score for this custom zone"
              >
                <Target className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{isScoring ? 'Scoring...' : 'Score Area'}</span>
              </button>
            )}

            {/* Action: Clear Button */}
            {(isDrawing || hasShape) && (
              <button
                type="button"
                onClick={onClear}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition-colors"
                title="Clear drawn shape"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Action: Close / Exit Snipping Mode */}
            <button
              type="button"
              onClick={onClose || (() => onSetDrawMode('none'))}
              className="p-1.5 text-slate-400 hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ml-0.5"
              title="Close draw mode and return to map navigation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scoring Error Message Banner */}
          {scoringError && (
            <div className="mt-1.5 px-3 py-1 bg-red-600 text-white rounded-full text-center text-xs font-medium shadow-md">
              {scoringError}
            </div>
          )}
        </div>
      )}

      {/* 2. Bottom-Left Quick Trigger Card (When not in full snipping mode) */}
      {!isDrawing && !hasShape && (
        <div className="absolute left-4 bottom-28 z-20">
          <div
            className="flex items-center gap-1.5 p-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all hover:scale-105"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              borderColor: 'rgba(71, 85, 105, 0.5)',
            }}
          >
            <button
              type="button"
              onClick={() => onSetDrawMode('polygon')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-xs cursor-pointer"
              title="Activate Custom Area Drawing Tool"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Draw Catchment</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DrawToolbar;
