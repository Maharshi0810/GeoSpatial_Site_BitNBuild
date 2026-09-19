import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatCoordinates,
  formatScore,
  formatPopulation,
  formatDistance,
  formatPercent,
  formatMinutes,
  formatContribution,
} from '@/utils/format';
import { LoadingOverlay, ScorePanelSkeleton } from '@/components/LoadingOverlay';

export const DevTokens: React.FC = () => {
  const colors = [
    { token: 'ink', hex: '#0F172A', role: 'Primary text, dark UI', textWhite: true },
    { token: 'slate-700', hex: '#334155', role: 'Secondary text', textWhite: true },
    { token: 'slate-500', hex: '#64748B', role: 'Tertiary text, map labels', textWhite: true },
    { token: 'slate-200', hex: '#E2E8F0', role: 'Borders', textWhite: false },
    { token: 'slate-100', hex: '#F1F5F9', role: 'Inset surfaces, track fills', textWhite: false },
    { token: 'surface', hex: '#FFFFFF', role: 'Panels, cards, chrome', textWhite: false },
    { token: 'canvas', hex: '#F8FAFC', role: 'App background', textWhite: false },
    { token: 'brand-700', hex: '#047857', role: 'Hover/pressed primary', textWhite: true },
    { token: 'brand-600', hex: '#059669', role: 'Primary actions, active', textWhite: true },
    { token: 'brand-50', hex: '#ECFDF5', role: 'Selected row tint', textWhite: false },
    { token: 'amber-600', hex: '#D97706', role: 'Caution state', textWhite: true },
    { token: 'red-700', hex: '#B91C1C', role: 'Hard constraint fail', textWhite: true },
    { token: 'blue-600', hex: '#2563EB', role: 'User location / routes', textWhite: true },
  ];

  const scoreRamp = [
    { range: '0–19', hex: '#F1F5F9', label: 'Very Low' },
    { range: '20–39', hex: '#A7F3D0', label: 'Low' },
    { range: '40–59', hex: '#6EE7B7', label: 'Moderate' },
    { range: '60–79', hex: '#34D399', label: 'High' },
    { range: '80–100', hex: '#059669', label: 'Optimal' },
  ];

  return (
    <div className="flex-1 bg-canvas p-8 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-ink">Design Tokens & Component Verification</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Route: /dev/tokens (Phase 1 scratchpad)</p>
        </div>

        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-slate-200 rounded-btn text-xs font-medium text-slate-700 hover:text-ink hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to workspace</span>
        </Link>
      </div>

      {/* 1. Color Palette Tokens */}
      <section className="bg-surface border border-slate-200 rounded-panel p-6 shadow-float space-y-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">1. Core Color System</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {colors.map((c) => (
            <div key={c.token} className="flex flex-col rounded-btn border border-slate-200 overflow-hidden text-xs">
              <div
                className="h-14 w-full p-2 flex items-end justify-between font-mono text-[11px]"
                style={{ backgroundColor: c.hex, color: c.textWhite ? '#FFFFFF' : '#0F172A' }}
              >
                <span>{c.hex}</span>
              </div>
              <div className="p-2 bg-surface flex flex-col gap-0.5">
                <span className="font-semibold text-ink">{c.token}</span>
                <span className="text-[10px] text-slate-500 leading-tight">{c.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Score Ramp (Single Hue Sequential) */}
      <section className="bg-surface border border-slate-200 rounded-panel p-6 shadow-float space-y-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">2. Score Ramp (Single Hue Sequential)</h2>
        <div className="grid grid-cols-5 gap-3">
          {scoreRamp.map((ramp) => (
            <div key={ramp.range} className="rounded-btn border border-slate-200 overflow-hidden text-xs">
              <div className="h-12 w-full flex items-center justify-center font-bold" style={{ backgroundColor: ramp.hex }}>
                <span className="font-mono text-xs">{ramp.range}</span>
              </div>
              <div className="p-2 bg-surface text-center">
                <p className="font-semibold text-ink">{ramp.label}</p>
                <p className="font-mono text-[10px] text-slate-500">{ramp.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Typography & Formatter Verification */}
      <section className="bg-surface border border-slate-200 rounded-panel p-6 shadow-float space-y-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">3. Typography & Tabular Formats (utils/format.ts)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Type Scale (Inter Tight)</h3>
            <div className="space-y-1">
              <p className="text-[32px] font-semibold text-ink font-mono leading-none">Score 78 (32px)</p>
              <p className="text-2xl font-semibold text-ink">Heading 1 (24px)</p>
              <p className="text-lg font-semibold text-ink">Panel Title (19px)</p>
              <p className="text-base font-semibold text-ink">Section Header (15px)</p>
              <p className="text-sm font-medium text-ink">Primary label (13px body text)</p>
              <p className="text-xs text-slate-500">Secondary caption (12px)</p>
              <p className="text-[11px] text-slate-500">Metadata and chip (11px)</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Tabular Formatters (IBM Plex Mono)</h3>
            <div className="bg-canvas p-3 rounded-btn border border-slate-200 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">formatCoordinates(23.0225, 72.5714):</span>
                <span className="font-semibold text-ink">{formatCoordinates(23.0225, 72.5714)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatScore(78.4):</span>
                <span className="font-semibold text-brand-600">{formatScore(78.4)} / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatPopulation(348000):</span>
                <span className="font-semibold text-ink">{formatPopulation(348000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatDistance(180) / (2400):</span>
                <span className="font-semibold text-ink">{formatDistance(180)} · {formatDistance(2400)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatContribution(14.2) / (-6.8):</span>
                <span className="font-semibold text-brand-600">{formatContribution(14.2)}</span> · <span className="font-semibold text-red-700">{formatContribution(-6.8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatMinutes(20):</span>
                <span className="font-semibold text-ink">{formatMinutes(20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">formatPercent(0.824):</span>
                <span className="font-semibold text-ink">{formatPercent(0.824)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Radiuses, Shadows & Loading Components */}
      <section className="bg-surface border border-slate-200 rounded-panel p-6 shadow-float space-y-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">4. Loading State & Radius Scale</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">Interactive Loading Overlay</span>
            <LoadingOverlay message="Querying demographic layers..." />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">Radius Scales</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-surface border border-slate-200 rounded-chip text-xs">Chip 4px</span>
              <span className="px-3 py-1.5 bg-brand-600 text-surface rounded-btn text-xs font-medium">Button 6px</span>
              <span className="p-3 bg-canvas border border-slate-200 rounded-panel text-xs">Panel 10px</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">Skeleton Shimmer</span>
            <div className="bg-surface border border-slate-200 rounded-btn p-2">
              <ScorePanelSkeleton />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
