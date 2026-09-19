import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crosshair,
  Compass,
  Layers
} from 'lucide-react';
import * as turf from '@turf/turf';
import { mockDataService, ScoreResponse } from '@/mocks/mockDataService';
import { MapView, AnalysisMode } from '@/components/MapView';
import type { MapViewHandle } from '@/components/MapView';
import { HotspotLegend } from '@/components/HotspotLegend';
import { useSpatialAnalytics } from '@/hooks/useSpatialAnalytics';
import { useCompareApi } from '@/hooks/useCompareApi';
import { useIsochrone } from '@/hooks/useIsochrone';
import { DrawToolbar } from '@/components/DrawToolbar';
import type { DrawMode, DrawnPolygon } from '@/components/DrawToolbar';
import { Sidebar } from '@/components/Sidebar';
import {
  SidebarTab,
  BenchmarkSite,
  LayerItem,
  GUJARAT_BENCHMARKS
} from '@/data/gujaratBenchmarks';
import { ReportExport } from '@/components/ReportExport';
import { SearchBar } from '@/components/SearchBar';
import type { FeatureCollection } from 'geojson';

export interface MapWorkspaceProps {
  siteType?: string;
  onSiteTypeChange?: (type: string) => void;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  siteType: propSiteType,
  onSiteTypeChange: propOnSiteTypeChange,
}) => {
  const mapViewRef = useRef<MapViewHandle>(null);

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>({
    lat: 23.0378,
    lng: 72.5112,
  });
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sidebar Tab & Collapse State
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('score');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Facility Site Type (synchronized with App.tsx)
  const [internalSiteType, setInternalSiteType] = useState<string>('ev_charging');
  const siteType = propSiteType ?? internalSiteType;
  const setSiteType = propOnSiteTypeChange ?? setInternalSiteType;

  // Report Export State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [selectedSiteName, setSelectedSiteName] = useState<string>('SG Highway Commercial Corridor');

  // Compare API hook
  const {
    candidateSites,
    compareResult,
    isLoading: isComparing,
    addSiteFromScore,
    removeSite,
    clearSites,
    runCompare,
  } = useCompareApi();

  // Active filter chip states
  const [activeFilter, setActiveFilter] = useState<string>('fast_dc');

  // Compare site selection state
  const [isPickingForCompare, setIsPickingForCompare] = useState<boolean>(false);
  const [compareNotification, setCompareNotification] = useState<string | null>(null);

  // Keyboard shortcut: Esc exits site picking mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPickingForCompare) {
        setIsPickingForCompare(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPickingForCompare]);

  // Spatial Analysis Mode
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('points');
  const spatialData = useSpatialAnalytics();

  // Isochrone & Catchment Hook
  const isochroneState = useIsochrone(selectedLocation);

  // Geographic Vector Layers State
  const [layers, setLayers] = useState<LayerItem[]>([
    { id: 'demographics', name: 'Demographics & population', source: 'Census India', vintage: '2023', visible: true, opacity: 80 },
    { id: 'transportation', name: 'Transportation & roads', source: 'OSM Overpass', vintage: '2024', visible: true, opacity: 95 },
    { id: 'poi', name: 'Points of interest & retail', source: 'Commercial Registry', vintage: '2024', visible: true, opacity: 70 },
    { id: 'landuse', name: 'Land use & zoning', source: 'AUDA Master Plan', vintage: '2021', visible: true, opacity: 85 },
    { id: 'environment', name: 'Environmental & flood risk', source: 'Central Water Commission', vintage: '2023', visible: true, opacity: 60 },
  ]);

  // Phase 3B Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawVertices, setDrawVertices] = useState<number[][]>([]);
  const [drawnPolygon, setDrawnPolygon] = useState<DrawnPolygon | null>(null);
  const [drawnPolygonGeoJSON, setDrawnPolygonGeoJSON] = useState<FeatureCollection | null>(null);
  const [isPolygonScoring, setIsPolygonScoring] = useState(false);
  const [polygonScore, setPolygonScore] = useState<ScoreResponse | null>(null);
  const [polygonScoreError, setPolygonScoreError] = useState<string | null>(null);
  const rectCornerRef = useRef<number[] | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear drawing state
  const clearDraw = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setDrawMode('none');
    setDrawVertices([]);
    setDrawnPolygon(null);
    setDrawnPolygonGeoJSON(null);
    setPolygonScore(null);
    setPolygonScoreError(null);
    rectCornerRef.current = null;
  }, []);

  // Finalise a closed polygon from coordinates ring
  const finalisePolygon = useCallback((ring: number[][]) => {
    const closed = [...ring, ring[0]];
    const poly = turf.polygon([closed]);
    const areaKm2 = turf.area(poly) / 1_000_000;
    const cent = turf.centroid(poly);
    const centCoords = cent.geometry.coordinates as [number, number];

    setDrawnPolygon({ coordinates: closed, areaKm2, centroid: centCoords });
    setDrawnPolygonGeoJSON({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: poly.geometry, properties: {} }],
    });
    setDrawMode('none');

    // Fit map to polygon bounds
    mapViewRef.current?.fitBounds(closed);
  }, []);

  // Score the drawn polygon catchment
  const scorePolygonCatchment = useCallback(async () => {
    if (!drawnPolygon) return;
    setIsPolygonScoring(true);
    setPolygonScoreError(null);
    try {
      const [lng, lat] = drawnPolygon.centroid;
      const data = await mockDataService.fetchScoreForLocation(lat, lng, siteType, activeFilter);
      setPolygonScore(data);
      setScoreData(data);
      setActiveSidebarTab('score');
      if (isSidebarCollapsed) setIsSidebarCollapsed(false);
    } catch {
      setPolygonScoreError('Polygon catchment scoring failed. Please retry.');
    } finally {
      setIsPolygonScoring(false);
    }
  }, [drawnPolygon, siteType, activeFilter, isSidebarCollapsed]);

  useEffect(() => {
    if (selectedLocation) {
      loadScore(selectedLocation.lat, selectedLocation.lng, siteType, activeFilter);
    }
  }, [siteType, activeFilter]);

  const loadScore = async (
    lat: number,
    lng: number,
    currentType: string = siteType,
    subFilter: string = activeFilter
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mockDataService.fetchScoreForLocation(lat, lng, currentType, subFilter);
      setScoreData(data);
    } catch {
      setError('Scoring service returned an error. Retry or pick another Gujarat location.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLayer = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  const handleSelectBenchmark = (benchmark: BenchmarkSite) => {
    setSelectedLocation({ lat: benchmark.lat, lng: benchmark.lng });
    setSelectedSiteName(benchmark.name);
    mapViewRef.current?.flyTo(benchmark.lng, benchmark.lat, 13.5);
    loadScore(benchmark.lat, benchmark.lng, siteType);
    setActiveSidebarTab('score');
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
  };

  const handleQueueAllBenchmarks = () => {
    GUJARAT_BENCHMARKS.forEach((bench) => {
      addSiteFromScore({
        locationName: bench.name,
        coordinates: { lat: bench.lat, lng: bench.lng },
        siteType,
        score: Math.floor(70 + Math.random() * 22),
        breakdown: [],
        constraints: [],
      } as any);
    });
    setActiveSidebarTab('compare');
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
  };

  const handleAddCurrentSite = () => {
    if (scoreData) {
      addSiteFromScore(scoreData);
      setActiveSidebarTab('compare');
      if (isSidebarCollapsed) {
        setIsSidebarCollapsed(false);
      }
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
      {/* Main Workspace Layout */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Center: Interactive Map Canvas (Full viewport utilization) */}
        <main className="flex-1 h-full relative flex flex-col items-center justify-between p-4 bg-canvas">
          {/* Floating Top Search Bar & Profile Filter Chips */}
          <div className="w-full max-w-xl z-20 flex flex-col gap-2">
            <SearchBar
              currentAddress={selectedSiteName}
              onSelectLocation={(loc) => {
                setSelectedLocation({ lat: loc.lat, lng: loc.lng });
                setSelectedSiteName(loc.name);
                mapViewRef.current?.flyTo(loc.lng, loc.lat, 13.5);
                loadScore(loc.lat, loc.lng, siteType);
                if (isPickingForCompare || activeSidebarTab === 'compare') {
                  mockDataService.fetchScoreForLocation(loc.lat, loc.lng, siteType, activeFilter).then((data) => {
                    addSiteFromScore(data);
                    setCompareNotification(`✓ Added "${data.locationName || loc.name}" (${data.score}/100) to comparison!`);
                    setTimeout(() => setCompareNotification(null), 3500);
                  });
                  setIsPickingForCompare(false);
                } else {
                  setActiveSidebarTab('score');
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                  }
                }
              }}
            />

            {/* Horizontal Filter Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {filterChips.map((chip) => {
                const isActive = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => {
                      const nextFilter = isActive ? '' : chip.id;
                      setActiveFilter(nextFilter);
                      if (selectedLocation) {
                        loadScore(selectedLocation.lat, selectedLocation.lng, siteType, nextFilter);
                      }
                    }}
                    className={`h-7 px-3 text-xs font-medium rounded-chip transition-colors whitespace-nowrap shadow-xs flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-brand-600 text-surface font-semibold'
                        : 'bg-surface text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                    title={isActive ? 'Filter applied to scoring model (click to clear)' : 'Apply filter to scoring model'}
                  >
                    <span>{chip.label}</span>
                    {isActive && (
                      <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono">✓ Active</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Compare Selection Mode Active Banner */}
            {isPickingForCompare && (
              <div className="px-4 py-2 bg-brand-600 text-white shadow-2xl rounded-full flex items-center justify-between gap-3 border border-brand-400 animate-pulse w-full max-w-md mx-auto">
                <div className="flex items-center gap-2 text-xs font-semibold truncate">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                  <span className="truncate">🎯 Click any location on the map to add to comparison</span>
                </div>
                <button
                  onClick={() => setIsPickingForCompare(false)}
                  className="text-xs bg-black/30 hover:bg-black/50 px-2.5 py-0.5 rounded-full font-medium transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Compare Notification Toast */}
            {compareNotification && (
              <div className="px-4 py-1.5 bg-emerald-600 text-white shadow-xl rounded-full flex items-center justify-center gap-2 border border-emerald-400 text-xs font-semibold w-full max-w-md mx-auto transition-all">
                <span>{compareNotification}</span>
              </div>
            )}
          </div>

          {/* Interactive MapLibre Map View */}
          <div className="absolute inset-0 z-0">
            <MapView
              ref={mapViewRef}
              selectedLocation={selectedLocation}
              onMapClick={(coords) => {
                // Intercept clicks during draw mode
                if (drawMode === 'polygon') {
                  if (clickTimerRef.current) {
                    clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = null;
                  }
                  // Debounce single-click so dblclick can cancel adding an extra closing vertex (BUG-03)
                  clickTimerRef.current = setTimeout(() => {
                    setDrawVertices((prev) => [...prev, [coords.lng, coords.lat]]);
                    clickTimerRef.current = null;
                  }, 220);
                  return;
                }
                if (drawMode === 'rectangle') {
                  if (!rectCornerRef.current) {
                    rectCornerRef.current = [coords.lng, coords.lat];
                    setDrawVertices([[coords.lng, coords.lat]]);
                  } else {
                    const [x1, y1] = rectCornerRef.current;
                    const [x2, y2] = [coords.lng, coords.lat];
                    const ring = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
                    finalisePolygon(ring);
                    rectCornerRef.current = null;
                  }
                  return;
                }

                // If in picking mode OR active tab is Compare:
                if (isPickingForCompare || activeSidebarTab === 'compare') {
                  setSelectedLocation(coords);
                  const candidateName = `Candidate Site (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
                  setSelectedSiteName(candidateName);
                  setIsLoading(true);
                  mockDataService.fetchScoreForLocation(coords.lat, coords.lng, siteType, activeFilter)
                    .then((data) => {
                      setScoreData(data);
                      addSiteFromScore(data);
                      setCompareNotification(`✓ Added "${data.locationName || candidateName}" (${data.score}/100) to comparison!`);
                      setTimeout(() => setCompareNotification(null), 3500);
                    })
                    .catch(() => {
                      setError('Failed to score selected candidate location.');
                    })
                    .finally(() => {
                      setIsLoading(false);
                      setIsPickingForCompare(false);
                    });
                  return;
                }

                // Normal site selection click
                setSelectedLocation(coords);
                setSelectedSiteName(`Candidate Site (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
                loadScore(coords.lat, coords.lng, siteType);
                setActiveSidebarTab('score');
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                }
              }}
              onMapDblClick={() => {
                // Cancel pending click to prevent duplicate vertex on polygon close (BUG-03)
                if (clickTimerRef.current) {
                  clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = null;
                }
                if (drawMode === 'polygon') {
                  setDrawVertices((prev) => {
                    if (prev.length >= 3) {
                      finalisePolygon(prev);
                    }
                    return prev;
                  });
                }
              }}
              analysisMode={analysisMode}
              h3Data={spatialData.h3Data}
              clusterData={spatialData.clusterData}
              hotspotData={spatialData.hotspotData}
              isochroneData={isochroneState.isochroneData}
              drawMode={drawMode}
              drawVertices={drawVertices}
              drawnPolygonGeoJSON={drawnPolygonGeoJSON}
              activeLayers={layers.reduce((acc, l) => ({ ...acc, [l.id]: l.visible }), {})}
              layerOpacity={layers.reduce((acc, l) => ({ ...acc, [l.id]: l.opacity / 100 }), {})}
            />
          </div>

          {/* Phase 3B: Draw Toolbar */}
          <DrawToolbar
            drawMode={drawMode}
            onSetDrawMode={(mode) => {
              clearDraw();
              setDrawMode(mode);
            }}
            drawnPolygon={drawnPolygon}
            vertexCount={drawVertices.length}
            onClear={clearDraw}
            onScorePolygon={scorePolygonCatchment}
            isScoring={isPolygonScoring}
            scoringError={polygonScoreError}
          />

          {/* Polygon Score Floating Card */}
          {polygonScore && drawnPolygon && (
            <div
              className="absolute left-4 bottom-[320px] z-20 w-56 p-3 rounded-xl border text-xs flex flex-col gap-2 shadow-float backdrop-blur-md"
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                borderColor: 'rgba(6, 182, 212, 0.4)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 font-semibold uppercase tracking-wider text-[10px]">Polygon Score</span>
                <span className="font-mono text-lg font-bold text-white">{polygonScore.score}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${polygonScore.score}%` }} />
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Area</span>
                <span className="font-mono text-slate-200">{drawnPolygon.areaKm2.toFixed(2)} km²</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Grade</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {polygonScore.score >= 85 ? 'A' : polygonScore.score >= 70 ? 'B' : polygonScore.score >= 55 ? 'C' : 'D'}
                </span>
              </div>
            </div>
          )}

          {/* Floating Hotspot / H3 Legend */}
          {(analysisMode === 'hotspots' || analysisMode === 'h3') && (
            <HotspotLegend mode={analysisMode} />
          )}

          {/* Right Floating Stacked Map Controls */}
          <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
            <button
              className="w-[38px] h-[38px] rounded-full bg-surface border border-slate-200 shadow-float flex items-center justify-center text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              title="Recentre to Ahmedabad Center"
              aria-label="Recentre to Ahmedabad Center"
              onClick={() => {
                const coords = { lat: 23.0225, lng: 72.5714 };
                setSelectedLocation(coords);
                loadScore(coords.lat, coords.lng, siteType);
              }}
            >
              <Compass className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              className="w-[38px] h-[38px] rounded-full bg-surface border border-slate-200 shadow-float flex items-center justify-center text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              title="Centre on SG Highway Corridor"
              aria-label="Centre on SG Highway Corridor"
              onClick={() => {
                const coords = { lat: 23.0378, lng: 72.5112 };
                setSelectedLocation(coords);
                loadScore(coords.lat, coords.lng, siteType);
              }}
            >
              <Crosshair className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              className="w-[38px] h-[38px] rounded-full bg-surface border border-slate-200 shadow-float flex items-center justify-center text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition-colors"
              title="Toggle Vector Layers tab"
              aria-label="Toggle Vector Layers tab"
              onClick={() => {
                setActiveSidebarTab('layers');
                if (isSidebarCollapsed) setIsSidebarCollapsed(false);
              }}
            >
              <Layers className="w-4 h-4" strokeWidth={1.75} />
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
                    ? 'bg-brand-600 text-surface shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </main>

        {/* Unified Tabbed Sidebar Component */}
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          selectedLocation={selectedLocation}
          scoreData={scoreData}
          isLoadingScore={isLoading}
          scoreError={error}
          onRetryScore={() => selectedLocation && loadScore(selectedLocation.lat, selectedLocation.lng, siteType)}
          candidateSites={candidateSites}
          compareResult={compareResult}
          isComparing={isComparing}
          onAddCurrentSite={handleAddCurrentSite}
          onRemoveSite={removeSite}
          onClearSites={clearSites}
          onRunCompare={runCompare}
          isochroneState={isochroneState}
          analysisMode={analysisMode}
          onAnalysisModeChange={setAnalysisMode}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onLayerOpacityChange={handleLayerOpacityChange}
          siteType={siteType}
          onSiteTypeChange={setSiteType}
          onSelectBenchmark={handleSelectBenchmark}
          onQueueAllBenchmarks={handleQueueAllBenchmarks}
          onExportReport={() => setIsReportModalOpen(true)}
          isPickingForCompare={isPickingForCompare}
          onStartPickForCompare={() => setIsPickingForCompare(true)}
          onCancelPickForCompare={() => setIsPickingForCompare(false)}
        />
      </div>

      {/* Bottom Candidate Comparison Tray (Streamlined candidate status bar) */}
      <section className="bg-surface border-t border-slate-200 transition-all duration-150 ease-out z-30 flex flex-col">
        <div className="h-10 px-4 flex items-center justify-between select-none text-xs text-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span>Candidate Comparison</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {candidateSites.length} {candidateSites.length === 1 ? 'site' : 'sites'} queued
              </span>
            </div>

            {/* Candidate site pills */}
            {candidateSites.length > 0 ? (
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto max-w-md py-0.5">
                {candidateSites.map((site) => (
                  <span
                    key={site.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-50 border border-brand-500/20 text-brand-700 text-[11px] font-medium whitespace-nowrap"
                  >
                    <span className="truncate max-w-[120px]">{site.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSite(site.id);
                      }}
                      className="text-brand-700 hover:text-brand-900 ml-0.5 font-bold"
                      title="Remove site"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="hidden md:inline text-[11px] text-slate-500 italic">
                (Add locations or benchmarks to compare readiness)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {candidateSites.length > 0 && (
              <button
                onClick={clearSites}
                className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => {
                setActiveSidebarTab('compare');
                setIsSidebarCollapsed(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Open Compare Panel</span>
              <span className="text-[11px] font-mono">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Phase 3C Comprehensive Site Evaluation Dossier Modal */}
      <ReportExport
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedLocation={selectedLocation}
        scoreData={scoreData}
        catchmentData={isochroneState.catchmentData}
        minutes={isochroneState.minutes}
        mode={isochroneState.mode}
        locationName={selectedSiteName || scoreData?.locationName}
        siteType={siteType}
      />
    </div>
  );
};
