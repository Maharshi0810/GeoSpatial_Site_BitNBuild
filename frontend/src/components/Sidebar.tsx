import React, { useState } from 'react';
import {
  Target,
  Scale,
  Clock,
  Layers,
  Sliders,
  Maximize2,
  Minimize2,
  Plus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Crosshair,
  Building2,
  Factory,
  Landmark,
  Anchor,
  Store,
  ChevronRight,
  Radar as RadarIcon
} from 'lucide-react';
import { ScoreResponse, CandidateSite } from '@/mocks/mockDataService';
import { formatCoordinates, formatPopulation } from '@/utils/format';
import { LoadingOverlay, ScorePanelSkeleton } from '@/components/LoadingOverlay';
import { BreakdownChart } from '@/components/BreakdownChart';
import { ComparePanel } from '@/components/ComparePanel';
import { CompareResult } from '@/hooks/useCompareApi';
import { IsochronePanel } from '@/components/IsochronePanel';
import { IsochroneState } from '@/hooks/useIsochrone';
import { AnalysisMode } from '@/components/MapView';

export type SidebarTab = 'score' | 'compare' | 'catchment' | 'layers';

export interface BenchmarkSite {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const GUJARAT_BENCHMARKS: BenchmarkSite[] = [
  {
    id: 'bench-sg-highway',
    name: 'SG Highway Commercial Corridor',
    category: 'Commercial / Retail',
    lat: 23.0378,
    lng: 72.5112,
    icon: Building2,
    description: 'Ahmedabad arterial growth axis with premier retail density and corporate offices.',
  },
  {
    id: 'bench-sanand-gidc',
    name: 'Sanand GIDC Industrial Estate',
    category: 'Industrial / Auto',
    lat: 22.9868,
    lng: 72.3814,
    icon: Factory,
    description: 'Mega automotive manufacturing hub with heavy freight accessibility.',
  },
  {
    id: 'bench-gift-city',
    name: 'GIFT City FinTech Zone',
    category: 'FinTech / Smart City',
    lat: 23.1601,
    lng: 72.6841,
    icon: Landmark,
    description: 'India’s premier international financial services and high-density tech corridor.',
  },
  {
    id: 'bench-mundra-sez',
    name: 'Mundra Port SEZ Logistics',
    category: 'Maritime / Logistics',
    lat: 22.8394,
    lng: 69.7214,
    icon: Anchor,
    description: 'Deep-water port terminal and multi-modal container freight logistics center.',
  },
  {
    id: 'bench-alkapuri',
    name: 'Alkapuri Central Hub, Vadodara',
    category: 'Urban Commercial',
    lat: 22.3106,
    lng: 73.1812,
    icon: Store,
    description: 'High-income urban consumer catchment with dense commercial and civic amenities.',
  },
];

export interface LayerItem {
  id: string;
  name: string;
  source: string;
  vintage: string;
  visible: boolean;
  opacity: number;
}

export interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Score state
  selectedLocation: { lat: number; lng: number } | null;
  scoreData: ScoreResponse | null;
  isLoadingScore: boolean;
  scoreError: string | null;
  onRetryScore: () => void;
  // Compare state
  candidateSites: CandidateSite[];
  compareResult: CompareResult | null;
  isComparing: boolean;
  onAddCurrentSite: () => void;
  onRemoveSite: (id: string) => void;
  onClearSites: () => void;
  onRunCompare: () => void;
  // Isochrone state
  isochroneState: IsochroneState;
  // Spatial & Layer state
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  layers: LayerItem[];
  onToggleLayer: (layerId: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  // Facility weights
  siteType: string;
  onSiteTypeChange: (type: string) => void;
  // Benchmark selection
  onSelectBenchmark: (benchmark: BenchmarkSite) => void;
  onQueueAllBenchmarks: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  selectedLocation,
  scoreData,
  isLoadingScore,
  scoreError,
  onRetryScore,
  candidateSites,
  compareResult,
  isComparing,
  onAddCurrentSite,
  onRemoveSite,
  onClearSites,
  onRunCompare,
  isochroneState,
  analysisMode,
  onAnalysisModeChange,
  layers,
  onToggleLayer,
  onLayerOpacityChange,
  siteType,
  onSiteTypeChange,
  onSelectBenchmark,
  onQueueAllBenchmarks,
}) => {
  const [showRadar, setShowRadar] = useState<boolean>(false);
  const [showBenchmarkDropdown, setShowBenchmarkDropdown] = useState<boolean>(false);

  // Helper for score grade
  const getGrade = (score: number) => {
    if (score >= 85) return { grade: 'A', label: 'Prime Site', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    if (score >= 70) return { grade: 'B', label: 'Strong Candidate', color: 'text-brand-700 bg-brand-50 border-brand-300' };
    if (score >= 55) return { grade: 'C', label: 'Moderate Fit', color: 'text-amber-700 bg-amber-50 border-amber-300' };
    return { grade: 'D', label: 'High Risk', color: 'text-red-700 bg-red-50 border-red-300' };
  };

  /* ---------------- Collapsed Analyst Rail (52px) ---------------- */
  if (isCollapsed) {
    return (
      <aside className="w-[52px] h-full bg-surface border-l border-slate-200 flex flex-col items-center py-3 z-30 select-none shadow-sm transition-all duration-200">
        {/* Expand Toggle */}
        <button
          onClick={onToggleCollapse}
          className="p-2 mb-3 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors"
          title="Expand Analyst Sidebar"
          aria-label="Expand Analyst Sidebar"
        >
          <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <div className="w-6 h-px bg-slate-200 mb-3" />

        {/* Tab Quick Rail */}
        <div className="flex flex-col gap-2 w-full px-1.5">
          <button
            onClick={() => {
              onToggleCollapse();
              onTabChange('score');
            }}
            className={`w-full aspect-square rounded-btn flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'score'
                ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
            }`}
            title="Score & Breakdown"
          >
            <Target className="w-4 h-4" strokeWidth={activeTab === 'score' ? 2 : 1.75} />
            {scoreData && (
              <span className="text-[10px] font-mono leading-none mt-0.5 font-bold">
                {scoreData.score}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              onToggleCollapse();
              onTabChange('compare');
            }}
            className={`w-full aspect-square rounded-btn flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'compare'
                ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
            }`}
            title={`Compare Candidates (${candidateSites.length})`}
          >
            <Scale className="w-4 h-4" strokeWidth={activeTab === 'compare' ? 2 : 1.75} />
            {candidateSites.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-600" />
            )}
          </button>

          <button
            onClick={() => {
              onToggleCollapse();
              onTabChange('catchment');
            }}
            className={`w-full aspect-square rounded-btn flex flex-col items-center justify-center transition-colors ${
              activeTab === 'catchment'
                ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
            }`}
            title="Travel Time Catchment & Isochrones"
          >
            <Clock className="w-4 h-4" strokeWidth={activeTab === 'catchment' ? 2 : 1.75} />
          </button>

          <button
            onClick={() => {
              onToggleCollapse();
              onTabChange('layers');
            }}
            className={`w-full aspect-square rounded-btn flex flex-col items-center justify-center transition-colors ${
              activeTab === 'layers'
                ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
            }`}
            title="Layers & Weight Sliders"
          >
            <Layers className="w-4 h-4" strokeWidth={activeTab === 'layers' ? 2 : 1.75} />
          </button>
        </div>
      </aside>
    );
  }

  /* ---------------- Expanded Analyst Sidebar (380px) ---------------- */
  return (
    <aside className="w-[380px] h-full bg-surface border-l border-slate-200 flex flex-col z-30 select-none shadow-sm transition-all duration-200">
      {/* Sidebar Header & Tab Navigation */}
      <div className="border-b border-slate-200 bg-surface">
        <div className="h-10 px-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              Analyst Workbench
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-chip bg-slate-100 text-slate-600">
              Gujarat GIS
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowBenchmarkDropdown(!showBenchmarkDropdown)}
              className="px-2 py-0.5 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-chip border border-brand-200 transition-colors flex items-center gap-1"
              title="Load pre-computed benchmark locations across Gujarat"
            >
              <Building2 className="w-3 h-3" />
              <span>Benchmarks</span>
            </button>

            <button
              onClick={onToggleCollapse}
              className="p-1 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors"
              title="Collapse sidebar to icon rail"
              aria-label="Collapse sidebar"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gujarat Benchmark Dropdown Tray */}
        {showBenchmarkDropdown && (
          <div className="p-2.5 bg-canvas border-b border-slate-200 flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Gujarat Candidate Benchmarks
              </span>
              <button
                onClick={() => {
                  onQueueAllBenchmarks();
                  onTabChange('compare');
                  setShowBenchmarkDropdown(false);
                }}
                className="text-[10px] text-brand-700 hover:underline font-medium"
              >
                Queue all into Compare
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-0.5">
              {GUJARAT_BENCHMARKS.map((bench) => {
                const IconComponent = bench.icon;
                return (
                  <button
                    key={bench.id}
                    onClick={() => {
                      onSelectBenchmark(bench);
                      setShowBenchmarkDropdown(false);
                    }}
                    className="flex items-start gap-2 p-2 rounded-btn bg-surface hover:bg-slate-100 text-left border border-slate-200 transition-colors group"
                  >
                    <div className="p-1 rounded bg-brand-50 text-brand-700 shrink-0 mt-0.5 group-hover:bg-brand-600 group-hover:text-surface transition-colors">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-ink truncate">{bench.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {bench.lat.toFixed(2)}, {bench.lng.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">{bench.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Selector Buttons */}
        <div className="grid grid-cols-4 p-1 gap-1 bg-canvas">
          <button
            onClick={() => onTabChange('score')}
            className={`py-1.5 px-2 text-xs font-medium rounded-chip flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'score'
                ? 'bg-surface text-brand-700 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-ink hover:bg-slate-100'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Score</span>
          </button>

          <button
            onClick={() => onTabChange('compare')}
            className={`py-1.5 px-2 text-xs font-medium rounded-chip flex items-center justify-center gap-1.5 transition-colors relative ${
              activeTab === 'compare'
                ? 'bg-surface text-brand-700 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-ink hover:bg-slate-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Compare</span>
            {candidateSites.length > 0 && (
              <span className="ml-0.5 px-1 py-0.2 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-700">
                {candidateSites.length}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('catchment')}
            className={`py-1.5 px-2 text-xs font-medium rounded-chip flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'catchment'
                ? 'bg-surface text-brand-700 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-ink hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Rings</span>
          </button>

          <button
            onClick={() => onTabChange('layers')}
            className={`py-1.5 px-2 text-xs font-medium rounded-chip flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'layers'
                ? 'bg-surface text-brand-700 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-ink hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Layers</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-4 text-xs">
        {/* ================= TAB 1: SCORE & BREAKDOWN ================= */}
        {activeTab === 'score' && (
          <>
            {isLoadingScore ? (
              <div className="relative py-8">
                <LoadingOverlay message="Evaluating multi-criteria readiness factors..." />
                <ScorePanelSkeleton />
              </div>
            ) : scoreError ? (
              <div className="p-4 bg-red-700/5 border border-red-700/20 rounded-btn flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Scoring service alert</span>
                </div>
                <p className="text-slate-700">{scoreError}</p>
                <button
                  onClick={onRetryScore}
                  className="self-start px-3 py-1 bg-surface border border-slate-200 rounded-chip text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  Retry calculation
                </button>
              </div>
            ) : scoreData ? (
              <>
                {/* Location Banner */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-ink truncate">{scoreData.locationName}</span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {formatCoordinates(scoreData.coordinates.lat, scoreData.coordinates.lng)}
                    </span>
                  </div>
                  {(() => {
                    const gradeInfo = getGrade(scoreData.score);
                    return (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-chip border shrink-0 ${gradeInfo.color}`}
                      >
                        Grade {gradeInfo.grade} · {gradeInfo.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Main Score Meter Card */}
                <div className="flex flex-col gap-2.5 p-3.5 bg-canvas border border-slate-200 rounded-btn shadow-xs">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-ink font-mono tracking-tight leading-none">
                        {scoreData.score}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">/ 100</span>
                    </div>
                    {scoreData.percentile && (
                      <span className="text-[11px] font-medium text-slate-600">
                        Top {100 - scoreData.percentile}% in metro
                      </span>
                    )}
                  </div>

                  {/* Progress Meter Bar */}
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${scoreData.score}%` }}
                    />
                  </div>

                  {scoreData.cappedBy && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Score restricted by {scoreData.cappedBy}</span>
                    </div>
                  )}
                </div>

                {/* Factor Breakdown Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      5-Factor Spatial Evaluation
                    </span>
                    <button
                      onClick={() => setShowRadar(!showRadar)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-chip transition-colors flex items-center gap-1 border ${
                        showRadar
                          ? 'bg-brand-50 border-brand-600 text-brand-700'
                          : 'bg-surface border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Toggle Multi-Criteria Radar Chart"
                    >
                      <RadarIcon className="w-3 h-3 text-brand-600" />
                      <span>{showRadar ? 'Hide Radar' : 'View Radar'}</span>
                    </button>
                  </div>

                  {/* Radar Chart (Recharts) */}
                  {showRadar && (
                    <div className="border border-slate-200 rounded-btn p-2 bg-canvas">
                      <BreakdownChart
                        breakdown={scoreData.breakdown}
                        score={scoreData.score}
                        grade={getGrade(scoreData.score).grade}
                      />
                    </div>
                  )}

                  {/* Factor Cards */}
                  <div className="flex flex-col gap-1.5">
                    {scoreData.breakdown.map((factor) => (
                      <div
                        key={factor.factorId}
                        className="p-2.5 bg-surface border border-slate-200 rounded-chip flex flex-col gap-1 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-ink">{factor.label}</span>
                          <span className="font-mono text-slate-700">
                            +{factor.contribution} pts
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${factor.normalized * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{factor.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Constraints Section */}
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    Site Feasibility Constraints
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {scoreData.constraints.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 p-2 bg-canvas border border-slate-200 rounded-chip text-xs"
                      >
                        {c.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">{c.label}</span>
                          <span className="text-[11px] text-slate-500">{c.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Accessibility Teaser */}
                {scoreData.accessibility && (
                  <div className="flex flex-col gap-2 p-2.5 bg-sky-50/50 border border-sky-200 rounded-btn">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">Drive-time reach</span>
                      <button
                        onClick={() => onTabChange('catchment')}
                        className="text-[11px] text-brand-700 hover:underline font-medium flex items-center gap-0.5"
                      >
                        <span>Inspect Isochrone Rings</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {scoreData.accessibility.map((band) => (
                        <div key={band.minutes} className="p-1.5 bg-surface rounded-chip border border-sky-100">
                          <p className="text-[10px] text-slate-500">{band.minutes} min</p>
                          <p className="font-mono text-xs font-semibold text-ink">
                            {formatPopulation(band.population)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 mt-auto">
                  <button
                    onClick={onAddCurrentSite}
                    className="flex-1 h-9 bg-brand-600 hover:bg-brand-700 text-surface text-xs font-semibold rounded-btn transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Queue for comparison</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
                <Crosshair className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
                <div className="flex flex-col gap-1 max-w-[240px]">
                  <p className="font-semibold text-ink">
                    {selectedLocation
                      ? `Target: ${formatCoordinates(selectedLocation.lat, selectedLocation.lng)}`
                      : 'No site selected'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Click anywhere on the Gujarat map, or choose a benchmark site above.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= TAB 2: CANDIDATE COMPARE ================= */}
        {activeTab === 'compare' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                Multi-Site Benchmark Comparison
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {candidateSites.length} of 6 slots
              </span>
            </div>

            <ComparePanel
              sites={candidateSites}
              compareResult={compareResult}
              isLoading={isComparing}
              onRemoveSite={onRemoveSite}
              onClearSites={onClearSites}
              onRunCompare={onRunCompare}
            />

            {candidateSites.length === 0 && (
              <div className="p-4 bg-canvas border border-dashed border-slate-300 rounded-btn text-center flex flex-col items-center gap-2">
                <Scale className="w-6 h-6 text-slate-400" />
                <p className="text-xs text-slate-600">No candidates queued yet.</p>
                <button
                  onClick={onQueueAllBenchmarks}
                  className="px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-chip text-xs font-semibold hover:bg-brand-100 transition-colors"
                >
                  Load 5 Gujarat Benchmarks
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: ACCESSIBILITY & CATCHMENT ================= */}
        {activeTab === 'catchment' && (
          <div className="flex flex-col gap-4">
            <IsochronePanel isochroneState={isochroneState} />
          </div>
        )}

        {/* ================= TAB 4: LAYERS & WEIGHTS ================= */}
        {activeTab === 'layers' && (
          <div className="flex flex-col gap-4">
            {/* Spatial Analysis Mode Switcher */}
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                Spatial Overlay Mode
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 bg-canvas border border-slate-200 rounded-btn">
                {(['points', 'h3', 'clusters', 'hotspots'] as AnalysisMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onAnalysisModeChange(mode)}
                    className={`py-1 text-[11px] font-medium rounded-chip capitalize transition-colors ${
                      analysisMode === mode
                        ? 'bg-brand-600 text-surface font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                    }`}
                  >
                    {mode === 'h3' ? 'H3 Hex' : mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Geospatial Layers Toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  Gujarat Vector Layers
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {layers.filter((l) => l.visible).length} active
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className="p-2.5 bg-canvas border border-slate-200 rounded-chip flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={() => onToggleLayer(layer.id)}
                          className="rounded text-brand-600 focus:ring-brand-600"
                        />
                        <span className="font-medium text-xs text-ink">{layer.name}</span>
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">{layer.opacity}%</span>
                    </div>

                    {layer.visible && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
                        <span className="text-[10px] text-slate-500">Opacity</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={layer.opacity}
                          onChange={(e) => onLayerOpacityChange(layer.id, parseInt(e.target.value, 10))}
                          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Facility Weights Profile Presets */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  Scoring Presets
                </span>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'ev_charging', label: 'EV Station' },
                  { id: 'retail', label: 'Retail Store' },
                  { id: 'warehouse', label: 'Warehouse' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onSiteTypeChange(preset.id)}
                    className={`py-1.5 px-2 text-[11px] font-medium border rounded-chip transition-colors ${
                      siteType === preset.id
                        ? 'bg-brand-50 border-brand-600 text-brand-700 font-semibold'
                        : 'bg-surface border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
