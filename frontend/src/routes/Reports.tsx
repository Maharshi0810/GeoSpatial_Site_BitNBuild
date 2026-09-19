import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SavedReport {
  id: string;
  name: string;
  siteType: string;
  score: number;
  createdDate: string;
}

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('gsra.reports.v1');
    if (raw) {
      try {
        setReports(JSON.parse(raw));
      } catch {
        // fallback
      }
    } else {
      // Seed default sample report for evaluation
      const initial: SavedReport[] = [
        {
          id: 'rep-001',
          name: 'SG Highway Commercial Hub',
          siteType: 'EV charging',
          score: 78,
          createdDate: '2026-03-18',
        },
      ];
      setReports(initial);
      localStorage.setItem('gsra.reports.v1', JSON.stringify(initial));
    }
  }, []);

  const handleDelete = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    localStorage.setItem('gsra.reports.v1', JSON.stringify(updated));
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-ink">Saved Analysis Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical evaluations, factor breakdowns, and exported site recommendations.
          </p>
        </div>

        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-slate-200 rounded-btn text-xs font-medium text-slate-700 hover:text-ink hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to workspace</span>
        </Link>
      </div>

      <div className="mt-6 bg-surface border border-slate-200 rounded-panel shadow-float overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-slate-300" strokeWidth={1.75} />
            <p className="text-xs font-medium text-slate-700">No saved reports yet.</p>
            <p className="text-xs text-slate-500">Score a location in the workspace and choose Export report.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-slate-200 text-slate-500 font-medium select-none">
              <tr>
                <th className="py-2.5 px-4">Location name</th>
                <th className="py-2.5 px-4">Site profile</th>
                <th className="py-2.5 px-4">Readiness score</th>
                <th className="py-2.5 px-4">Created date</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-ink">{report.name}</td>
                  <td className="py-3 px-4 text-slate-700">{report.siteType}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-chip">
                      {report.score} / 100
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">{report.createdDate}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="px-2 py-1 text-slate-700 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors flex items-center gap-1"
                        title="Download CSV"
                      >
                        <Download className="w-3 h-3" />
                        <span>CSV</span>
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-chip transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
