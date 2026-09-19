import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-canvas">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-6 text-brand-600 border border-brand-500/20 shadow-sm">
        <Compass className="w-8 h-8 animate-pulse" />
      </div>

      <span className="text-xs font-semibold tracking-wider uppercase text-brand-600 mb-2">
        Error 404
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3">
        Coordinate Not Found
      </h1>

      <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
        The location or route you requested does not exist on the Gujarat site readiness grid.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-btn bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Map Workspace
      </Link>
    </div>
  );
};
