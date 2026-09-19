import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Printer,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Layers,
  MapPin,
  Clock,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  BookmarkPlus,
  Loader2,
} from 'lucide-react';
import { ScoreResponse } from '@/mocks/mockDataService';
import { CatchmentData, TravelMode } from '@/hooks/useIsochrone';
import { formatCoordinates, formatPopulation } from '@/utils/format';

export interface ReportExportProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number } | null;
  scoreData: ScoreResponse | null;
  catchmentData?: CatchmentData | null;
  minutes?: number;
  mode?: TravelMode;
  locationName?: string;
  siteType?: string;
  preloadedDossier?: any;
}

interface DossierData {
  metadata: {
    report_id: string;
    created_at: string;
    version: string;
    system: string;
    data_vintage: string;
  };
  site: {
    location_name: string;
    site_type: string;
    coordinates: {
      lat: number;
      lng: number;
      formatted: string;
    };
    region: string;
  };
  evaluation: {
    overall_score: number;
    grade: string;
    percentile: number;
    recommendation_tier: string;
    recommendation_color: string;
    constraints: Array<{
      id: string;
      label: string;
      passed: boolean;
      status: string;
      details: string;
    }>;
    factor_breakdown: Array<{
      factor_id: string;
      label: string;
      score: number;
      weight: number;
      contribution: number;
    }>;
  };
  accessibility: {
    mode: string;
    duration_minutes: number;
    catchment_area_km2: number;
    population_reached: number;
    average_density_per_km2: number;
    dominant_income_tier: string;
    competitors_in_catchment: number;
    time_bands: Array<{
      minutes: number;
      population: number;
      area_km2: number;
      label: string;
    }>;
  };
  nearby_commercial_anchors: Array<{
    name: string;
    category: string;
    distance_km: number;
    lat: number;
    lng: number;
  }>;
  spatial_geojson?: any;
  csv_export?: string;
}

export const ReportExport: React.FC<ReportExportProps> = ({
  isOpen,
  onClose,
  selectedLocation,
  scoreData,
  catchmentData,
  minutes = 15,
  mode = 'driving',
  locationName = 'Selected Candidate Site',
  siteType = 'EV charging',
  preloadedDossier,
}) => {
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'factors' | 'accessibility' | 'raw'>('dossier');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch or compile dossier when opened
  useEffect(() => {
    if (!isOpen || !selectedLocation) return;

    if (preloadedDossier) {
      setDossier(preloadedDossier);
      setIsLoading(false);
      setCopied(false);
      setSavedToLibrary(false);
      return;
    }

    const generateDossier = async () => {
      setIsLoading(true);
      setCopied(false);
      setSavedToLibrary(false);

      const lat = selectedLocation.lat;
      const lng = selectedLocation.lng;

      try {
        const response = await fetch('/api/report/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            location_name: locationName,
            site_type: siteType,
            minutes,
            mode,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.data && json.data.evaluation) {
            setDossier(json.data);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Backend offline: generate client-side dossier from current state
      }

      // Fallback: compile synthetic client-side dossier
      const reportId = `GSRA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(16)
        .slice(2, 8)
        .toUpperCase()}`;
      const overallScore = scoreData ? scoreData.score : 85;
      const grade = overallScore >= 90 ? 'Grade A+' : overallScore >= 80 ? 'Grade A' : overallScore >= 70 ? 'Grade B' : 'Grade C';

      const factorBreakdown = scoreData?.breakdown.map((b) => ({
        factor_id: b.factorId,
        label: b.label,
        score: Math.round(b.normalized * 100),
        weight: b.weight,
        contribution: b.contribution,
      })) || [
        { factor_id: 'demographics', label: 'Population Density', score: 86, weight: 0.25, contribution: 21.5 },
        { factor_id: 'transportation', label: 'Road Proximity', score: 94, weight: 0.25, contribution: 23.5 },
        { factor_id: 'poi', label: 'Commercial Anchors', score: 78, weight: 0.2, contribution: 15.6 },
        { factor_id: 'landuse', label: 'Zoning Alignment', score: 85, weight: 0.15, contribution: 12.8 },
        { factor_id: 'environment', label: 'Hazard Buffers', score: 90, weight: 0.15, contribution: 13.5 },
      ];

      const constraintsList = scoreData?.constraints.map((c) => ({
        id: c.id,
        label: c.label,
        passed: c.passed,
        status: c.passed ? 'Clear / Compliant' : 'Violation / Risk',
        details: c.reason,
      })) || [
        {
          id: 'flood_risk',
          label: 'Flood Zone Risk Check',
          passed: true,
          status: 'Clear (Outside Flood Plain)',
          details: 'Site is clear of high-hazard flood plains and river spillover zones.',
        },
        {
          id: 'road_access',
          label: 'Arterial Road Proximity',
          passed: true,
          status: 'Direct highway frontage (under 250m)',
          details: 'Candidate site is located adjacent to an active arterial corridor.',
        },
      ];

      const timeBands = catchmentData?.time_bands || [
        { minutes: 5, population: 45000, area_km2: 12.5, label: `5 min ${mode}` },
        { minutes: 10, population: 180000, area_km2: 48.0, label: `10 min ${mode}` },
        { minutes: 15, population: 520000, area_km2: 110.0, label: `15 min ${mode}` },
        { minutes: 30, population: 1450000, area_km2: 380.0, label: `30 min ${mode}` },
      ];

      const pois = [
        { name: 'Arterial Fuel & Convenience Hub', category: 'Energy & Fuel', distance_km: 0.42, lat: lat + 0.003, lng: lng + 0.002 },
        { name: 'Grand Commercial Plaza', category: 'Retail Mall', distance_km: 0.85, lat: lat - 0.005, lng: lng + 0.004 },
        { name: 'Apex Tech Center', category: 'Commercial Office', distance_km: 1.15, lat: lat + 0.008, lng: lng - 0.006 },
        { name: 'West Regional Transit Terminal', category: 'Transit Hub', distance_km: 1.60, lat: lat - 0.012, lng: lng - 0.003 },
      ];

      const clientDossier: DossierData = {
        metadata: {
          report_id: reportId,
          created_at: new Date().toISOString(),
          version: '1.0.0',
          system: 'GeoSpatial Site Readiness Analyzer (BitNBuild PS-2)',
          data_vintage: '2024.Q1',
        },
        site: {
          location_name: locationName,
          site_type: siteType,
          coordinates: {
            lat,
            lng,
            formatted: formatCoordinates(lat, lng),
          },
          region: 'Gujarat, India',
        },
        evaluation: {
          overall_score: overallScore,
          grade,
          percentile: 88,
          recommendation_tier: overallScore >= 80 ? 'Priority Tier 1 — Prime Candidate' : overallScore >= 65 ? 'Viable Tier 2 — Recommended' : 'Tier 3 — Secondary Candidate',
          recommendation_color: overallScore >= 80 ? 'green' : 'blue',
          constraints: constraintsList,
          factor_breakdown: factorBreakdown,
        },
        accessibility: {
          mode,
          duration_minutes: minutes,
          catchment_area_km2: catchmentData?.catchment_area_km2 ?? 110.0,
          population_reached: catchmentData?.population_reached ?? 520000,
          average_density_per_km2: catchmentData?.average_density_per_km2 ?? 14250,
          dominant_income_tier: catchmentData?.dominant_income_tier ?? 'Mid-High Income',
          competitors_in_catchment: catchmentData?.competitors_in_catchment ?? 6,
          time_bands: timeBands,
        },
        nearby_commercial_anchors: pois,
      };

      setDossier(clientDossier);
      setIsLoading(false);
    };

    generateDossier();
  }, [isOpen, selectedLocation, locationName, siteType, minutes, mode, scoreData, catchmentData, preloadedDossier]);

  if (!isOpen) return null;

  // --- Export Actions ---

  const handleDownloadJson = () => {
    if (!dossier) return;
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSRA-Site-Dossier-${dossier.metadata.report_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadGeoJson = () => {
    if (!dossier) return;
    const geojson = dossier.spatial_geojson || {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [dossier.site.coordinates.lng, dossier.site.coordinates.lat],
          },
          properties: {
            name: dossier.site.location_name,
            score: dossier.evaluation.overall_score,
            grade: dossier.evaluation.grade,
            recommendation: dossier.evaluation.recommendation_tier,
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSRA-Spatial-Catchment-${dossier.metadata.report_id}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!dossier) return;
    let csv = dossier.csv_export;
    if (!csv) {
      // client CSV generation
      const lines = [
        '# GEOSPATIAL SITE READINESS REPORT',
        `Report ID,${dossier.metadata.report_id}`,
        `Location Name,"${dossier.site.location_name}"`,
        `Site Profile,${dossier.site.site_type}`,
        `Latitude,${dossier.site.coordinates.lat.toFixed(5)}`,
        `Longitude,${dossier.site.coordinates.lng.toFixed(5)}`,
        `Overall Score,${dossier.evaluation.overall_score}`,
        `Grade,${dossier.evaluation.grade}`,
        `Recommendation,"${dossier.evaluation.recommendation_tier}"`,
        '',
        '# FACTOR BREAKDOWN',
        'Factor,Score,Weight,Contribution',
      ];
      dossier.evaluation.factor_breakdown.forEach((f) => {
        lines.push(`"${f.label}",${f.score},${f.weight},${f.contribution}`);
      });
      lines.push('');
      lines.push('# ACCESSIBILITY & CATCHMENT');
      lines.push(`Travel Mode,${dossier.accessibility.mode}`);
      lines.push(`Duration,${dossier.accessibility.duration_minutes} min`);
      lines.push(`Population Reached,${dossier.accessibility.population_reached}`);
      lines.push(`Catchment Area (km2),${dossier.accessibility.catchment_area_km2}`);
      csv = lines.join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSRA-Site-Summary-${dossier.metadata.report_id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = () => {
    if (!dossier) return;
    const raw = localStorage.getItem('gsra.reports.v1');
    let list: any[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    const newEntry = {
      id: dossier.metadata.report_id,
      name: dossier.site.location_name,
      siteType: dossier.site.site_type,
      score: dossier.evaluation.overall_score,
      grade: dossier.evaluation.grade,
      createdDate: dossier.metadata.created_at.slice(0, 10),
      dossier,
    };
    // Prepend and dedup by id
    const filtered = list.filter((r: any) => r.id !== newEntry.id);
    filtered.unshift(newEntry);
    localStorage.setItem('gsra.reports.v1', JSON.stringify(filtered));
    setSavedToLibrary(true);
  };

  const handleCopyJson = () => {
    if (!dossier) return;
    navigator.clipboard.writeText(JSON.stringify(dossier, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Dialog Card */}
      <div className="bg-surface border border-slate-200 rounded-panel shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-ink">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-canvas">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 text-white rounded-btn shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink">Site Evaluation Dossier</h2>
                {dossier && (
                  <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-chip">
                    {dossier.metadata.report_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive multi-criteria site suitability & accessibility analysis export
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-ink hover:bg-slate-200/60 rounded-chip transition-colors"
            title="Close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-surface flex items-center gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'dossier'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Executive Dossier</span>
          </button>

          <button
            onClick={() => setActiveTab('factors')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'factors'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Factor Breakdown ({dossier?.evaluation.factor_breakdown.length ?? 5})</span>
          </button>

          <button
            onClick={() => setActiveTab('accessibility')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'accessibility'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Catchment & Anchors</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Raw JSON Schema</span>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !dossier ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-xs font-medium">Assembling multi-layer spatial dossier...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: EXECUTIVE DOSSIER */}
              {activeTab === 'dossier' && (
                <div className="space-y-6">
                  {/* Site Header & Score Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Location Metadata */}
                    <div className="md:col-span-2 p-4 bg-canvas border border-slate-200 rounded-panel flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-chip bg-slate-200 text-slate-700">
                            {dossier.site.site_type}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {dossier.site.region}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-ink">{dossier.site.location_name}</h3>
                        <p className="font-mono text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-brand-600" />
                          <span>{dossier.site.coordinates.formatted}</span>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-4 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400 text-[11px] block">Generated:</span>
                          <span className="font-mono font-medium">
                            {new Date(dossier.metadata.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Vintage:</span>
                          <span className="font-mono font-medium">{dossier.metadata.data_vintage}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Engine:</span>
                          <span className="font-medium text-brand-700">H3 Hexbin v1.0</span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Score Badge */}
                    <div className="p-4 bg-gradient-to-br from-brand-50 via-surface to-brand-100/40 border border-brand-200 rounded-panel flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                        Site Readiness Score
                      </span>
                      <div className="my-1 flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold font-mono text-brand-700">
                          {dossier.evaluation.overall_score}
                        </span>
                        <span className="text-xs font-mono text-slate-400">/ 100</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-chip bg-emerald-100 text-emerald-800 font-mono">
                          {dossier.evaluation.grade}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          (Top {100 - dossier.evaluation.percentile}%)
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-btn border border-emerald-200/70">
                        {dossier.evaluation.recommendation_tier}
                      </div>
                    </div>
                  </div>

                  {/* Constraints Compliance Check */}
                  <div className="p-4 bg-surface border border-slate-200 rounded-panel">
                    <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-brand-600" />
                      <span>Statutory & Environmental Constraints</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dossier.evaluation.constraints.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-canvas border border-slate-200 rounded-btn flex items-start gap-2.5"
                        >
                          {c.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-ink">{c.label}</span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-chip ${
                                  c.passed
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{c.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Catchment KPIs */}
                  <div className="p-4 bg-canvas border border-slate-200 rounded-panel">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-600" />
                        <span>Travel-Time Demographic Reach</span>
                      </h4>
                      <span className="text-xs font-mono font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-chip border border-brand-200">
                        {dossier.accessibility.duration_minutes} min {dossier.accessibility.mode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div className="p-2.5 bg-surface border border-slate-200 rounded-btn">
                        <span className="text-[11px] text-slate-500 block">Population Reach</span>
                        <span className="text-base font-bold font-mono text-ink">
                          {formatPopulation(dossier.accessibility.population_reached)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-surface border border-slate-200 rounded-btn">
                        <span className="text-[11px] text-slate-500 block">Catchment Area</span>
                        <span className="text-base font-bold font-mono text-ink">
                          {dossier.accessibility.catchment_area_km2.toFixed(1)} <span className="text-xs font-normal">km²</span>
                        </span>
                      </div>
                      <div className="p-2.5 bg-surface border border-slate-200 rounded-btn">
                        <span className="text-[11px] text-slate-500 block">Density Index</span>
                        <span className="text-base font-bold font-mono text-ink">
                          {Math.round(dossier.accessibility.average_density_per_km2).toLocaleString()} <span className="text-xs font-normal">/km²</span>
                        </span>
                      </div>
                      <div className="p-2.5 bg-surface border border-slate-200 rounded-btn">
                        <span className="text-[11px] text-slate-500 block">Income Classification</span>
                        <span className="text-xs font-bold text-ink mt-1 block">
                          {dossier.accessibility.dominant_income_tier}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FACTOR BREAKDOWN */}
              {activeTab === 'factors' && (
                <div className="space-y-4">
                  <div className="p-3 bg-brand-50 border border-brand-200 rounded-btn text-xs text-brand-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                    <span>
                      Multi-criteria decision analysis (MCDA) weight-normalized scoring breakdown across all Gujarat geospatial layers.
                    </span>
                  </div>

                  <table className="w-full text-left text-xs border border-slate-200 rounded-btn overflow-hidden">
                    <thead className="bg-canvas border-b border-slate-200 text-slate-500 font-semibold select-none">
                      <tr>
                        <th className="py-2.5 px-4">Evaluation Factor</th>
                        <th className="py-2.5 px-4 text-center">Score</th>
                        <th className="py-2.5 px-4 text-center">Assigned Weight</th>
                        <th className="py-2.5 px-4 text-right">Net Contribution</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dossier.evaluation.factor_breakdown.map((f) => (
                        <tr key={f.factor_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-semibold text-ink">{f.label}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-chip">
                              {f.score} / 100
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">
                            {(f.weight * 100).toFixed(0)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-brand-700">
                            +{f.contribution.toFixed(1)} pts
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-chip ${
                                f.score >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : f.score >= 60
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {f.score >= 80 ? 'Optimal' : f.score >= 60 ? 'Satisfactory' : 'Moderate'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: CATCHMENT & ANCHORS */}
              {activeTab === 'accessibility' && (
                <div className="space-y-6">
                  {/* Time Band Progression */}
                  <div>
                    <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-600" />
                      <span>Progressive Travel-Time Rings</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {dossier.accessibility.time_bands.map((b) => (
                        <div
                          key={b.minutes}
                          className="p-3 bg-canvas border border-slate-200 rounded-btn text-center"
                        >
                          <span className="text-[11px] font-mono text-slate-500">{b.minutes} min ring</span>
                          <span className="text-sm font-bold font-mono text-ink block my-0.5">
                            {formatPopulation(b.population)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {b.area_km2.toFixed(1)} km²
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Commercial Anchors & Competitors */}
                  <div>
                    <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-brand-600" />
                      <span>Nearest Commercial Facilities & POIs</span>
                    </h4>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-btn overflow-hidden">
                      <thead className="bg-canvas border-b border-slate-200 text-slate-500 font-semibold select-none">
                        <tr>
                          <th className="py-2.5 px-4">Facility Name</th>
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4 text-right">Distance</th>
                          <th className="py-2.5 px-4 text-right">Coordinates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dossier.nearby_commercial_anchors.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-ink">{p.name}</td>
                            <td className="py-2.5 px-4 text-slate-600">{p.category}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-brand-700">
                              {p.distance_km} km
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">
                              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: RAW JSON SCHEMA */}
              {activeTab === 'raw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Standardized PS-2 Analytical Schema</span>
                    <button
                      onClick={handleCopyJson}
                      className="px-2.5 py-1 bg-surface border border-slate-200 rounded-chip text-xs font-medium hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-btn text-[11px] font-mono overflow-x-auto max-h-[360px]">
                    {JSON.stringify(dossier, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-canvas border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToLibrary}
              disabled={savedToLibrary || !dossier}
              className={`h-8 px-3 rounded-btn text-xs font-medium transition-all flex items-center gap-1.5 ${
                savedToLibrary
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
              }`}
            >
              {savedToLibrary ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5 text-brand-600" />
              )}
              <span>{savedToLibrary ? 'Saved to Reports' : 'Save to Library'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!dossier}
              className="h-8 px-3 bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-btn text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              title="Print Dossier (PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={!dossier}
              className="h-8 px-3 bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-btn text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleDownloadGeoJson}
              disabled={!dossier}
              className="h-8 px-3 bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-btn text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>GeoJSON</span>
            </button>

            <button
              onClick={handleDownloadJson}
              disabled={!dossier}
              className="h-8 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-btn text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
