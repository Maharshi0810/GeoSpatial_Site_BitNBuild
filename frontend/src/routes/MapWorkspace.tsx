import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sliders,
  Maximize2,
  Minimize2,
  Search,
  Crosshair,
  Compass,
  AlertCircle,
  FileDown,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { mockDataService, ScoreResponse } from '@/mocks/mockDataService';
import { formatCoordinates, formatPopulation, formatContribution } from '@/utils/format';
import { LoadingOverlay, ScorePanelSkeleton } from '@/components/LoadingOverlay';
import { MapView, AnalysisMode } from '@/components/MapView';
import { HotspotLegend } from '@/components/HotspotLegend';
import { useSpatialAnalytics } from '@/hooks/useSpatialAnalytics';

export const MapWorkspace: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>({
    lat: 23.0378,
    lng: 72.5112,
  });
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isLayersCollapsed, setIsLayersCollapsed] = useState<boolean>(false);
  const [isScoreCollapsed, setIsScoreCollapsed] = useState<boolean>(false);
  const [isCompareExpanded, setIsCompareExpanded] = useState<boolean>(false);

  // Active filter chip states
  const [activeFilter, setActiveFilter] = useState<string>('fast_dc');

  // Phase 2B Spatial Analysis Mode
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('points');
  const spatialData = useSpatialAnalytics();

  useEffect(() => {
    if (selectedLocation) {
      loadScore(selectedLocation.lat, selectedLocation.lng);
    }
  }, []);

  const loadScore = async (lat: number, lng: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mockDataService.fetchScoreForLocation(lat, lng);
      setScoreData(data);
    } catch {
      setError('Scoring failed. The analytical service returned an unexpected response. Retry, or pick a different location.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterChips = [
    { id: 'fast_dc', label: 'Fast DC' },
    { id: 'power_50kw', label: '≥ 50 kW' },
    { id: 'grid_capacity', label: 'Grid capacity' },
    { id: 'highway_access', label: 'Highway access' },
  ];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-canvas">
      {/* Main 3-Column Analyst Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Panel: Layers & Weights (300px or 48px collapsed rail) */}
        <aside
          className={`h-full bg-surface border-r border-slate-200 transition-all duration-150 ease-out z-20 flex flex-col ${
            isLayersCollapsed ? 'w-12' : 'w-[300px]'
          }`}
        >
          {/* Header */}
          <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-ink">
            {!isLayersCollapsed && <span>Layers & Weights</span>}
            <button
              onClick={() => setIsLayersCollapsed(!isLayersCollapsed)}
              className="p-1 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors ml-auto"
              title={isLayersCollapsed ? 'Expand layers panel' : 'Collapse layers panel'}
              aria-label={isLayersCollapsed ? 'Expand layers panel' : 'Collapse layers panel'}
            >
              {isLayersCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsed Rail Content */}
          {isLayersCollapsed ? (
            <div className="flex flex-col items-center gap-3 pt-3 text-slate-500">
              <button
                onClick={() => setIsLayersCollapsed(false)}
                className="p-2 hover:bg-slate-100 hover:text-brand-600 rounded-chip transition-colors"
                title="Geospatial Layers"
              >
                <Layers className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setIsLayersCollapsed(false)}
                className="p-2 hover:bg-slate-100 hover:text-brand-600 rounded-chip transition-colors"
                title="Scoring Weights"
              >
                <Sliders className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            /* Expanded Panel Content */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 text-xs">
              {/* Layer Section */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-600" strokeWidth={1.75} />
                    <span>Geographic layers (5 active)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  {[
                    { name: 'Demographics & population', source: 'Census India', vintage: '2023', opacity: 80 },
                    { name: 'Transportation & roads', source: 'OSM Overpass', vintage: '2024', opacity: 95 },
                    { name: 'Points of interest & retail', source: 'Commercial Registry', vintage: '2024', opacity: 70 },
                    { name: 'Land use & zoning', source: 'AUDA Master Plan', vintage: '2021', opacity: 85 },
                    { name: 'Environmental & flood risk', source: 'Central Water Commission', vintage: '2023', opacity: 60 },
                  ].map((layer, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-canvas border border-slate-200 rounded-chip flex flex-col gap-1.5 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" defaultChecked className="rounded text-brand-600 focus:ring-brand-600" />
                          <span className="font-medium text-ink">{layer.name}</span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-mono">{layer.opacity}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pl-5">
                        <span>{layer.source} · {layer.vintage}</span>
                        <div className="w-2 h-2 rounded-full bg-brand-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-200" />

              {/* Weights Section */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-brand-600" strokeWidth={1.75} />
                    <span>Factor weights (sum: 100%)</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mt-1">
                  {['Retail', 'Warehouse', 'EV charging'].map((preset) => (
                    <button
                      key={preset}
                      className={`px-2 py-1 text-[11px] font-medium border rounded-chip transition-colors ${
                        preset === 'EV charging'
                          ? 'bg-brand-50 border-brand-600 text-brand-700'
                          : 'bg-surface border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </aside>

        {/* Center: Map Canvas Container */}
        <main className="flex-1 h-full relative flex flex-col items-center justify-between p-4 bg-[#E5ECF0]">
          {/* Floating Top Search Bar & Profile Filter Chips */}
          <div className="w-full max-w-xl z-20 flex flex-col gap-2">
            <div className="h-10 bg-surface border border-slate-200 rounded-panel shadow-float px-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Search an address, ward, or paste coordinates (e.g. 23.0378, 72.5112)"
                defaultValue="SG Highway, Bodakdev, Ahmedabad"
                className="w-full bg-transparent text-xs text-ink placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* Horizontal Filter Row (4px radius, 28px tall, no pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {filterChips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={`h-7 px-3 text-xs font-medium rounded-chip transition-colors whitespace-nowrap shadow-sm ${
                    activeFilter === chip.id
                      ? 'bg-brand-600 text-surface'
                      : 'bg-surface text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive MapLibre Map View with Spatial Analytics Layers */}
          <div className="absolute inset-0 z-0">
            <MapView
              selectedLocation={selectedLocation}
              onMapClick={(coords) => {
                setSelectedLocation(coords);
                loadScore(coords.lat, coords.lng);
              }}
              analysisMode={analysisMode}
              h3Data={spatialData.h3Data}
              clusterData={spatialData.clusterData}
              hotspotData={spatialData.hotspotData}
            />
          </div>

          {/* Floating Hotspot / H3 Legend */}
          {(analysisMode === 'hotspots' || analysisMode === 'h3') && (
            <HotspotLegend mode={analysisMode} />
          )}

          {/* Right Floating Stacked Map Controls (38px circular controls) */}
          <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
            <button
              className="w-[38px] h-[38px] rounded-full bg-surface border border-slate-200 shadow-float flex items-center justify-center text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              title="Recentre to Ahmedabad"
              aria-label="Recentre to Ahmedabad"
              onClick={() => {
                setSelectedLocation({ lat: 23.0225, lng: 72.5714 });
                loadScore(23.0225, 72.5714);
              }}
            >
              <Compass className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              className="w-[38px] h-[38px] rounded-full bg-surface border border-slate-200 shadow-float flex items-center justify-center text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              title="Centre on SG Highway Corridor"
              aria-label="Centre on SG Highway Corridor"
              onClick={() => {
                setSelectedLocation({ lat: 23.0378, lng: 72.5112 });
                loadScore(23.0378, 72.5112);
              }}
            >
              <Crosshair className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Bottom Analysis Mode Bar (Points / H3 Hexbins / DBSCAN Clusters / Hot Spots) */}
          <div className="z-20 bg-surface/95 backdrop-blur-sm border border-slate-200 rounded-btn shadow-float p-1 flex items-center gap-1 text-xs">
            {[
              { id: 'points' as AnalysisMode, label: 'Points' },
              { id: 'h3' as AnalysisMode, label: 'H3 hexbins' },
              { id: 'clusters' as AnalysisMode, label: 'DBSCAN clusters' },
              { id: 'hotspots' as AnalysisMode, label: 'Getis-Ord hot spots' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setAnalysisMode(mode.id)}
                className={`px-3 py-1 font-medium rounded-chip transition-colors ${
                  analysisMode === mode.id
                    ? 'bg-brand-600 text-surface shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </main>

        {/* Right Panel: Readiness Score & Breakdown (380px or 48px collapsed rail) */}
        <aside
          className={`h-full bg-surface border-l border-slate-200 transition-all duration-150 ease-out z-20 flex flex-col ${
            isScoreCollapsed ? 'w-12' : 'w-[380px]'
          }`}
        >
          {/* Header */}
          <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-ink">
            {!isScoreCollapsed && <span>Site Readiness Score</span>}
            <button
              onClick={() => setIsScoreCollapsed(!isScoreCollapsed)}
              className="p-1 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors ml-auto"
              title={isScoreCollapsed ? 'Expand readiness panel' : 'Collapse readiness panel'}
              aria-label={isScoreCollapsed ? 'Expand readiness panel' : 'Collapse readiness panel'}
            >
              {isScoreCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsed Rail Content */}
          {isScoreCollapsed ? (
            <div className="flex flex-col items-center gap-3 pt-3 text-slate-500">
              <button
                onClick={() => setIsScoreCollapsed(false)}
                className="w-8 h-8 rounded-btn bg-brand-50 text-brand-700 font-mono font-semibold flex items-center justify-center text-xs"
                title="View Score"
              >
                {scoreData ? scoreData.score : '--'}
              </button>
            </div>
          ) : (
            /* Expanded Panel Content */
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              {isLoading ? (
                <div className="relative py-4">
                  <LoadingOverlay message="Evaluating candidate location..." />
                  <ScorePanelSkeleton />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-700/5 border border-red-700/20 rounded-btn flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>Scoring failed</span>
                  </div>
                  <p className="text-slate-700">{error}</p>
                  <button
                    onClick={() => selectedLocation && loadScore(selectedLocation.lat, selectedLocation.lng)}
                    className="self-start px-3 py-1 bg-surface border border-slate-200 rounded-chip text-xs font-medium hover:bg-slate-100 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : scoreData ? (
                <>
                  {/* Location line */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{scoreData.locationName}</span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {formatCoordinates(scoreData.coordinates.lat, scoreData.coordinates.lng)}
                    </span>
                  </div>

                  {/* Score meter horizontal bar */}
                  <div className="flex flex-col gap-2 p-3 bg-canvas border border-slate-200 rounded-btn">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[32px] font-semibold text-ink font-mono tracking-tight leading-none">
                          {scoreData.score}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">/ 100</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-chip bg-brand-50 text-brand-700">
                        Strong candidate
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-600 transition-all duration-300 ease-out"
                        style={{ width: `${scoreData.score}%` }}
                      />
                    </div>

                    {scoreData.percentile && (
                      <p className="text-[11px] text-slate-500">
                        Above the {scoreData.percentile}th percentile of scored locations in this city.
                      </p>
                    )}
                  </div>

                  {/* Factor breakdown */}
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      Factor breakdown
                    </span>

                    <div className="flex flex-col gap-2">
                      {scoreData.breakdown.map((factor) => (
                        <div
                          key={factor.factorId}
                          className="p-2.5 bg-surface border border-slate-200 rounded-chip flex flex-col gap-1 hover:border-slate-300 transition-colors cursor-pointer"
                          title="Click to highlight geometry on map"
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-ink">{factor.label}</span>
                            <span
                              className={`font-mono text-xs ${
                                factor.contribution >= 0 ? 'text-brand-600 font-semibold' : 'text-red-700'
                              }`}
                            >
                              {formatContribution(factor.contribution)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{factor.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Constraints Check */}
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      Threshold constraints
                    </span>

                    <div className="flex flex-col gap-1.5">
                      {scoreData.constraints.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-xs py-1">
                          {c.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" strokeWidth={1.75} />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium text-ink">{c.label}</span>
                            <span className="text-[11px] text-slate-500">{c.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accessibility Summary */}
                  {scoreData.accessibility && (
                    <div className="flex flex-col gap-2 p-2.5 bg-canvas border border-slate-200 rounded-btn">
                      <span className="font-semibold text-slate-700 text-xs">Drive-time catchment</span>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {scoreData.accessibility.map((band) => (
                          <div key={band.minutes} className="p-1.5 bg-surface rounded-chip border border-slate-200">
                            <p className="text-[10px] text-slate-500">{band.minutes} min</p>
                            <p className="font-mono text-xs font-semibold text-ink">
                              {formatPopulation(band.population)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions (Section 5.2) */}
                  <div className="flex items-center gap-2 pt-2 mt-auto border-t border-slate-200">
                    <button className="flex-1 h-9 bg-brand-600 hover:bg-brand-700 text-surface text-xs font-semibold rounded-btn transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                      <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>Add to comparison</span>
                    </button>
                    <button className="h-9 px-3 bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-btn transition-colors flex items-center gap-1.5">
                      <FileDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Export</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Crosshair className="w-6 h-6 text-slate-400" strokeWidth={1.75} />
                  <p>Click anywhere on the map to score a location.</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Compare Tray (Section 5.1: collapsed 36px / expanded 220px) */}
      <section className="bg-surface border-t border-slate-200 transition-all duration-150 ease-out z-30 flex flex-col">
        <div
          onClick={() => setIsCompareExpanded(!isCompareExpanded)}
          className="h-9 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none text-xs text-slate-700"
        >
          <div className="flex items-center gap-2 font-semibold text-ink">
            <span>Candidate Comparison Tray</span>
            <span className="text-[11px] font-normal text-slate-500 font-mono">(1 site selected)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {isCompareExpanded ? 'Collapse' : 'Compare candidates side by side'}
            </span>
            {isCompareExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        {isCompareExpanded && (
          <div className="h-[184px] p-4 border-t border-slate-100 flex items-center gap-4 overflow-x-auto bg-canvas">
            <div className="w-64 h-full p-3 bg-surface border border-brand-600/30 rounded-btn flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink text-xs truncate">SG Highway Hub</span>
                  <span className="font-mono text-sm font-bold text-brand-600">78</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">23.0378, 72.5112</p>
              </div>

              <div className="text-[11px] flex flex-col gap-1">
                <div className="flex justify-between text-slate-500">
                  <span>Pop. reach:</span>
                  <span className="font-mono text-ink">94,000 (10m)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Constraints:</span>
                  <span className="text-brand-600 font-medium">All passed</span>
                </div>
              </div>

              <button className="text-[11px] text-slate-500 hover:text-red-700 text-left transition-colors">
                Remove
              </button>
            </div>

            <div className="w-64 h-full border-2 border-dashed border-slate-200 rounded-btn flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
              <Plus className="w-5 h-5 mb-1 text-slate-400" />
              <span>Click another site on map to add to compare</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
