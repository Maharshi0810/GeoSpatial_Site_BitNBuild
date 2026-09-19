import React from 'react';
import { Compass, MapPin, Database } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  currentCity?: string;
  currentSiteType?: string;
  onSiteTypeChange?: (type: string) => void;
  isMockActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentCity = 'Ahmedabad, Gujarat',
  currentSiteType = 'ev_charging',
  onSiteTypeChange,
  isMockActive = true,
}) => {
  const location = useLocation();

  const siteTypes = [
    { id: 'ev_charging', label: 'EV charging' },
    { id: 'retail', label: 'Retail store' },
    { id: 'warehouse', label: 'Warehouse / Logistics' },
    { id: 'telecom', label: 'Telecom tower' },
    { id: 'renewables', label: 'Solar / Wind' },
  ];

  return (
    <header className="h-[52px] bg-surface border-b border-slate-200 px-4 flex items-center justify-between z-40 select-none">
      {/* Left: Brand Identity & Metro selector */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-ink font-semibold tracking-tight hover:text-brand-700 transition-colors">
          <div className="w-7 h-7 bg-brand-600 rounded-btn flex items-center justify-center text-surface shadow-sm">
            <Compass className="w-4 h-4" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold">Site Readiness Analyzer</span>
        </Link>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-canvas px-2.5 py-1 rounded-chip border border-slate-200">
          <MapPin className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
          <span>{currentCity}</span>
        </div>
      </div>

      {/* Center: Site type selector & Route links */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Facility:</span>
          <select
            value={currentSiteType}
            onChange={(e) => onSiteTypeChange?.(e.target.value)}
            className="bg-surface text-ink text-xs font-medium border border-slate-200 rounded-chip px-2 py-1 cursor-pointer hover:border-slate-400 focus:border-brand-600 transition-colors"
          >
            {siteTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex items-center gap-1 ml-3 border-l border-slate-200 pl-3">
          <Link
            to="/"
            className={`px-2.5 py-1 text-xs font-medium rounded-chip transition-colors ${
              location.pathname === '/'
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-slate-700 hover:text-ink hover:bg-slate-100'
            }`}
          >
            Workspace
          </Link>
          <Link
            to="/reports"
            className={`px-2.5 py-1 text-xs font-medium rounded-chip transition-colors ${
              location.pathname === '/reports'
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-slate-700 hover:text-ink hover:bg-slate-100'
            }`}
          >
            Reports
          </Link>
        </nav>
      </div>

      {/* Right: Mock Data Badge & Dev Links */}
      <div className="flex items-center gap-3">
        {isMockActive && (
          <div
            id="sample-data-badge"
            className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-600/10 border border-amber-600/30 rounded-chip text-[11px] font-medium text-amber-600"
            title="Running in local simulation mode. All metrics derived from verified sample fixtures."
          >
            <Database className="w-3 h-3" strokeWidth={1.75} />
            <span>Sample data</span>
          </div>
        )}
      </div>
    </header>
  );
};
