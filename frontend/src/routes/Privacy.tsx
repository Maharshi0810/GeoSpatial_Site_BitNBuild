import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Privacy: React.FC = () => {
  return (
    <div className="flex-1 bg-canvas py-10 px-4">
      <div className="max-w-[640px] mx-auto bg-surface border border-slate-200 rounded-panel p-8 shadow-float">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to workspace</span>
        </Link>

        <div className="p-3 bg-amber-600/10 border border-amber-600/20 rounded-chip text-xs text-amber-600 font-medium mb-6">
          This is a hackathon project. Review with counsel before any commercial use.
        </div>

        <h1 className="text-xl font-semibold text-ink mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-6 font-mono">Last updated: March 19, 2026</p>

        <div className="space-y-4 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-base font-semibold text-ink mb-1">1. Information collected</h2>
            <p>
              The GeoSpatial Site Readiness Analyzer is built for exploratory geospatial analysis. We collect interaction
              data including coordinates selected on the map, active filter parameters, and candidate comparison lists.
              No user account or authentication is required to use this build.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-1">2. Storage and local persistence</h2>
            <p>
              Saved analysis reports and custom factor weight configurations are stored locally within your browser
              using HTML5 localStorage under the keys prefixed with <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">gsra.*</code>.
              Clearing your browser cache or site data will remove these records permanently.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-1">3. Third-party services</h2>
            <p>
              To render vector maps and compute multimodal catchment models, this application communicates with:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
              <li><strong>OpenStreetMap and OpenMapTiles:</strong> For base map vector tiles and geographic feature metadata under the Open Database License (ODbL).</li>
              <li><strong>OpenRouteService:</strong> For drive-time and walk-time isochrone polygons and network distance calculations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-1">4. Data retention</h2>
            <p>
              Geospatial queries sent to backend endpoints are processed in real time and are not permanently logged
              or connected to individual identity records.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-1">5. Inquiries</h2>
            <p>
              For inquiries regarding methodology or project architecture, please contact the hackathon engineering team at: <code className="font-mono text-xs text-brand-700">TEAM_EMAIL_PLACEHOLDER</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
