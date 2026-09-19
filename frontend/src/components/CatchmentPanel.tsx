import React from 'react';
import {
  Users,
  Clock,
  Car,
  Footprints,
  Bike,
  Building2,
  TrendingUp,
  MapPin,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CatchmentData, TravelMode, IsochroneState } from '@/hooks/useIsochrone';
import { formatPopulation } from '@/utils/format';

interface CatchmentPanelProps {
  catchmentData?: CatchmentData | null;
  minutes?: number;
  mode?: TravelMode;
  isLoading?: boolean;
  onMinutesChange?: (mins: number) => void;
  onModeChange?: (mode: TravelMode) => void;
  onOpenReport?: () => void;
  isochroneState?: IsochroneState;
  compact?: boolean;
}

export const CatchmentPanel: React.FC<CatchmentPanelProps> = ({
  catchmentData: propCatchmentData,
  minutes: propMinutes,
  mode: propMode,
  isLoading: propIsLoading,
  onMinutesChange: propOnMinutesChange,
  onModeChange: propOnModeChange,
  onOpenReport,
  isochroneState,
  compact = false,
}) => {
  const catchmentData = isochroneState ? isochroneState.catchmentData : (propCatchmentData ?? null);
  const minutes = isochroneState ? isochroneState.minutes : (propMinutes ?? 15);
  const mode = isochroneState ? isochroneState.mode : (propMode ?? 'driving');
  const isLoading = isochroneState ? isochroneState.isLoading : Boolean(propIsLoading);
  const onMinutesChange = isochroneState ? isochroneState.setMinutes : (propOnMinutesChange ?? (() => {}));
  const onModeChange = isochroneState ? isochroneState.setMode : (propOnModeChange ?? (() => {}));

  const PRESET_MINUTES = [5, 10, 15, 30];

  const travelModes: { id: TravelMode; label: string; icon: React.ReactNode }[] = [
    { id: 'driving', label: 'Driving', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'walking', label: 'Walking', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'cycling', label: 'Cycling', icon: <Bike className="w-3.5 h-3.5" /> },
  ];

  const timeBands = catchmentData?.time_bands || [];
  const maxBandPop = Math.max(...timeBands.map((b) => b.population), 1);
  const reachedPop = catchmentData?.population_reached ?? 0;
  const areaKm2 = catchmentData?.catchment_area_km2 ?? 0;
  const avgDensity = catchmentData?.average_density_per_km2 ?? 0;
  const incomeTier = catchmentData?.dominant_income_tier || 'Mid-Income';
  const competitorCount = catchmentData?.competitors_in_catchment ?? 0;

  return (
    <div className={`flex flex-col gap-4 text-ink ${compact ? '' : 'bg-surface border border-slate-200 rounded-panel p-4 shadow-sm'}`}>
      {/* Header & Status */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-50 text-brand-600 rounded-chip border border-brand-100">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-ink tracking-tight">Demographic Catchment</h3>
            <p className="text-[11px] text-slate-500">Population reach & time-band accessibility</p>
          </div>
        </div>

        {isLoading ? (
          <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-chip animate-pulse flex items-center gap-1 border border-brand-100">
            <Activity className="w-3 h-3 animate-spin" /> Aggregating...
          </span>
        ) : (
          <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-chip border border-emerald-100 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Census Calibrated
          </span>
        )}
      </div>

      {/* Travel Mode Toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-slate-700">Travel Mode</label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-canvas rounded-chip border border-slate-200">
          {travelModes.map((item) => (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-chip text-xs font-medium transition-all ${
                mode === item.id
                  ? 'bg-surface text-brand-700 shadow-sm font-semibold border border-slate-200'
                  : 'text-slate-600 hover:text-ink hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Travel Time Preset Chips & Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-700">Travel Time Threshold</label>
          <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-chip border border-brand-100">
            {minutes} min {mode}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_MINUTES.map((m) => (
            <button
              key={m}
              onClick={() => onMinutesChange(m)}
              className={`py-1 text-xs font-mono rounded-chip transition-all border ${
                minutes === m
                  ? 'bg-brand-600 text-white font-bold border-brand-600 shadow-sm'
                  : 'bg-surface text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        <input
          type="range"
          min={5}
          max={60}
          step={5}
          value={minutes}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mt-1"
        />
      </div>

      {/* Primary Catchment Callout Card */}
      <div className="p-3 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/40 border border-brand-200/80 rounded-btn flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-brand-600" />
          Primary Catchment Population
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-ink tracking-tight">
            {formatPopulation(reachedPop)}
          </span>
          <span className="text-xs text-slate-600">residents reached</span>
        </div>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Within <span className="font-semibold text-ink">{minutes}-minute</span> {mode} reach of this candidate location.
        </p>
      </div>

      {/* 4 KPI Grid Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-canvas border border-slate-200 rounded-btn">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Catchment Area</span>
          </div>
          <span className="font-mono text-sm font-bold text-ink">
            {areaKm2.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">km²</span>
          </span>
        </div>

        <div className="p-2.5 bg-canvas border border-slate-200 rounded-btn">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
            <span>Avg Density</span>
          </div>
          <span className="font-mono text-sm font-bold text-ink">
            {Math.round(avgDensity).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">/km²</span>
          </span>
        </div>

        <div className="p-2.5 bg-canvas border border-slate-200 rounded-btn">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Commercial POIs</span>
          </div>
          <span className="font-mono text-sm font-bold text-ink">
            {competitorCount} <span className="text-[10px] font-normal text-slate-500">anchors</span>
          </span>
        </div>

        <div className="p-2.5 bg-canvas border border-slate-200 rounded-btn">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Dominant Income</span>
          </div>
          <span className="text-xs font-semibold text-ink">
            {incomeTier}
          </span>
        </div>
      </div>

      {/* Progressive Time Band Distribution (Bar Chart representation) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700">Progressive Travel Contours</span>
          <span className="text-[10px] text-slate-500">5 → 30 min bands</span>
        </div>

        <div className="flex flex-col gap-2">
          {timeBands.map((band) => {
            const isSelected = band.minutes === minutes;
            const pct = Math.round((band.population / maxBandPop) * 100);
            return (
              <div
                key={band.minutes}
                onClick={() => onMinutesChange(band.minutes)}
                className={`flex flex-col gap-1 p-2 rounded-btn cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-brand-50/60 border-brand-300 shadow-sm'
                    : 'bg-canvas hover:bg-slate-100/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className={`w-3 h-3 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span className={`font-semibold ${isSelected ? 'text-brand-800' : 'text-slate-700'}`}>
                      {band.minutes} min {mode}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-ink">{formatPopulation(band.population)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({band.area_km2.toFixed(1)} km²)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected ? 'bg-brand-600' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.max(pct, 6)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      {onOpenReport && (
        <button
          onClick={onOpenReport}
          className="mt-2 w-full h-9 bg-surface hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-btn transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
        >
          <Users className="w-3.5 h-3.5 text-brand-600" />
          <span>Export Catchment in Dossier</span>
        </button>
      )}
    </div>
  );
};
