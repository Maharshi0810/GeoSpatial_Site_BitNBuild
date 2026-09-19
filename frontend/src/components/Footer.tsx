import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="h-7 bg-surface border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 select-none z-40">
      <div className="flex items-center gap-3">
        <span>© 2026 GeoSpatial Site Readiness Analyzer</span>
        <span className="text-slate-300">·</span>
        <span>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-700">OpenStreetMap</a> contributors (ODbL)</span>
      </div>

      <div className="flex items-center gap-3 font-medium">
        <Link to="/privacy" className="hover:text-ink transition-colors">
          Privacy
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/terms" className="hover:text-ink transition-colors">
          Terms
        </Link>
        {import.meta.env.DEV && (
          <>
            <span className="text-slate-300">·</span>
            <Link to="/dev/tokens" className="hover:text-brand-600 transition-colors">
              Design tokens
            </Link>
          </>
        )}
      </div>
    </footer>
  );
};
