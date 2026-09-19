import React from 'react';
import {
  Clock,
  Car,
  Footprints,
  Bike,
  Users,
  Maximize2,
  Building2,
  Activity,
  Layers,
} from 'lucide-react';
import { CatchmentData, TravelMode, IsochroneState } from '@/hooks/useIsochrone';
import { formatPopulation } from '@/utils/format';

interface IsochronePanelProps {
  catchmentData?: CatchmentData | null;
  minutes?: number;
  mode?: TravelMode;
  isLoading?: boolean;
  onMinutesChange?: (mins: number) => void;
  onModeChange?: (mode: TravelMode) => void;
  onClose?: () => void;
  isochroneState?: IsochroneState;
}

export const IsochronePanel: React.FC<IsochronePanelProps> = ({
  catchmentData: propCatchmentData,
  minutes: propMinutes,
  mode: propMode,
  isLoading: propIsLoading,
  onMinutesChange: propOnMinutesChange,
  onModeChange: propOnModeChange,
  isochroneState,
  onClose: _onClose,
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

  const maxBandPop = Math.max(...(catchmentData?.time_bands?.map((b) => b.population) || [1]));

  return (
    <div className="bg-surface border border-slate-700/80 rounded-panel p-4 shadow-xl flex flex-col gap-4 text-ink">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-500/10 text-brand-400 rounded-chip border border-brand-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-100 tracking-tight">Accessibility & Catchment</h3>
            <p className="text-[10px] text-slate-400">Travel time contours & demographic reach</p>
          </div>
        </div>
        {isLoading && (
          <span className="text-[10px] font-mono text-brand-400 animate-pulse flex items-center gap-1">
            <Activity className="w-3 h-3 animate-spin" /> Computing...
          </span>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-slate-400">Travel Mode</span>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/60 rounded-chip border border-slate-800">
          {travelModes.map((item) => (
            <button
              key={item.id}
              onClick={() => onModeChange(item.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-chip text-xs font-medium transition-all ${
                mode === item.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time Band Presets & Range Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400">Time Threshold</span>
          <span className="text-xs font-mono font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-chip border border-brand-500/20">
            {minutes} min
          </span>
        </div>

        {/* Preset Chips */}
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_MINUTES.map((m) => (
            <button
              key={m}
              onClick={() => onMinutesChange(m)}
              className={`py-1 px-2 text-[11px] font-mono font-medium rounded-chip border transition-all ${
                minutes === m
                  ? 'bg-brand-500/20 border-brand-400 text-brand-300'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min={5}
          max={60}
          step={5}
          value={minutes}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
      </div>

      {/* Catchment KPI Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {/* Metric 1: Reached Population */}
        <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-panel flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Users className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[10px] uppercase font-medium tracking-wider">Population</span>
          </div>
          <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
            {catchmentData ? formatPopulation(catchmentData.population_reached) : '—'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">within {minutes} min {mode}</span>
        </div>

        {/* Metric 2: Area in km2 */}
        <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-panel flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] uppercase font-medium tracking-wider">Catchment Area</span>
          </div>
          <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
            {catchmentData ? `${catchmentData.catchment_area_km2} km²` : '—'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">contour footprint</span>
        </div>

        {/* Metric 3: Competitors within Reach */}
        <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-panel flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase font-medium tracking-wider">Competitors</span>
          </div>
          <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
            {catchmentData ? `${catchmentData.competitors_in_catchment} hubs` : '—'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">active points of interest</span>
        </div>

        {/* Metric 4: Density Index */}
        <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-panel flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase font-medium tracking-wider">Avg Density</span>
          </div>
          <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
            {catchmentData ? `${Math.round(catchmentData.average_density_per_km2).toLocaleString()}/km²` : '—'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">urban density grade</span>
        </div>
      </div>

      {/* Progressive Time-Band Reach Distribution */}
      {catchmentData?.time_bands && catchmentData.time_bands.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-400">Reach Distribution by Travel Time</span>
            <span className="text-[10px] text-slate-500">Incremental</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {catchmentData.time_bands.map((band) => {
              const pct = Math.round((band.population / maxBandPop) * 100);
              const isActive = band.minutes === minutes;
              return (
                <div key={band.minutes} className="flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className={`font-mono ${isActive ? 'text-brand-300 font-semibold' : 'text-slate-400'}`}>
                      {band.minutes}m {mode}
                    </span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {formatPopulation(band.population)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-brand-500 to-sky-400'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
