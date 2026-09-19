/**
 * DrawToolbar — Phase 3B polygon/rectangle drawing toolbar for custom catchment zones.
 *
 * Owner: Daksh [D]
 *
 * Provides:
 * - Polygon freeform drawing mode (click vertices, double-click to close)
 * - Rectangle bounding-box drawing mode (click two diagonal corners)
 * - Clear drawn geometry
 * - Live area readout in km² via @turf/turf
 * - "Score Polygon" CTA that fires the onScorePolygon callback
 */

import React from 'react';
import { Pentagon, Square, Trash2, Target } from 'lucide-react';

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
  isScoring?: boolean;
}

export const DrawToolbar: React.FC<DrawToolbarProps> = ({
  drawMode,
  onSetDrawMode,
  drawnPolygon,
  vertexCount,
  onClear,
  onScorePolygon,
  isScoring = false,
}) => {
  const isDrawing = drawMode !== 'none';

  return (
    <div className="absolute left-4 bottom-20 z-30 flex flex-col gap-2">
      {/* Main toolbar card */}
      <div
        className="flex flex-col gap-1.5 p-2 rounded-xl border shadow-2xl backdrop-blur-md"
        style={{
          background: 'rgba(15, 23, 42, 0.88)',
          borderColor: 'rgba(71, 85, 105, 0.5)',
        }}
      >
        {/* Label */}
        <span
          className="text-[10px] font-semibold uppercase tracking-widest px-1"
          style={{ color: '#94a3b8' }}
        >
          Draw Tools
        </span>

        {/* Polygon button */}
        <button
          onClick={() => onSetDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            drawMode === 'polygon'
              ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
              : 'text-slate-300 hover:bg-slate-700/60 hover:text-slate-100'
          }`}
          title="Draw polygon — click vertices, double-click to close"
        >
          <Pentagon className="w-4 h-4" strokeWidth={1.75} />
          <span>Polygon</span>
        </button>

        {/* Rectangle button */}
        <button
          onClick={() => onSetDrawMode(drawMode === 'rectangle' ? 'none' : 'rectangle')}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            drawMode === 'rectangle'
              ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
              : 'text-slate-300 hover:bg-slate-700/60 hover:text-slate-100'
          }`}
          title="Draw rectangle — click two diagonal corners"
        >
          <Square className="w-4 h-4" strokeWidth={1.75} />
          <span>Rectangle</span>
        </button>

        {/* Clear button */}
        <button
          onClick={onClear}
          disabled={!drawnPolygon && vertexCount === 0}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-slate-400 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear drawn geometry"
        >
          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
          <span>Clear</span>
        </button>
      </div>

      {/* Live HUD — vertex count + area */}
      {(isDrawing || drawnPolygon) && (
        <div
          className="flex flex-col gap-1 p-2 rounded-xl border text-xs"
          style={{
            background: 'rgba(15, 23, 42, 0.88)',
            borderColor: 'rgba(71, 85, 105, 0.5)',
          }}
        >
          {isDrawing && !drawnPolygon && (
            <div className="flex items-center gap-1.5 text-cyan-300">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-medium">
                {drawMode === 'polygon'
                  ? `${vertexCount} vertices — double-click to close`
                  : vertexCount === 0
                  ? 'Click first corner'
                  : 'Click opposite corner'}
              </span>
            </div>
          )}

          {drawnPolygon && (
            <>
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium">Area</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {drawnPolygon.areaKm2 < 1
                    ? `${(drawnPolygon.areaKm2 * 1000).toFixed(0)} ha`
                    : `${drawnPolygon.areaKm2.toFixed(2)} km²`}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Centroid</span>
                <span className="font-mono text-[11px]">
                  {drawnPolygon.centroid[1].toFixed(4)}, {drawnPolygon.centroid[0].toFixed(4)}
                </span>
              </div>

              {/* Score CTA */}
              <button
                onClick={onScorePolygon}
                disabled={isScoring}
                className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 bg-cyan-500 hover:bg-cyan-400 text-slate-900 active:scale-95 disabled:opacity-50"
              >
                <Target className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{isScoring ? 'Scoring...' : 'Score Polygon Catchment'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DrawToolbar;
