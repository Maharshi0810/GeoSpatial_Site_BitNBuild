import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Trash2,
  ArrowLeft,
  Eye,
  Sparkles,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReportExport } from '@/components/ReportExport';
import { BENCHMARK_SITES } from '@/data/demoSites';

interface SavedReport {
  id: string;
  name: string;
  siteType: string;
  score: number;
  grade?: string;
  createdDate: string;
  dossier?: any;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem('gsra.reports.v1');
    if (raw) {
      try {
        setReports(JSON.parse(raw));
      } catch {
        // fallback
      }
    } else {
      seedDefaultReports();
    }
  }, []);

  const seedDefaultReports = () => {
    const seeded: SavedReport[] = BENCHMARK_SITES.map((site, idx) => ({
      id: `GSRA-20260319-DEMO${idx + 1}`,
      name: site.name,
      siteType: site.siteType,
      score: idx === 0 ? 88 : idx === 1 ? 92 : idx === 2 ? 74 : 68,
      grade: idx === 0 ? 'Grade A' : idx === 1 ? 'Grade A+' : idx === 2 ? 'Grade B+' : 'Grade B',
      createdDate: '2026-03-19',
      coordinates: site.coordinates,
    }));
    setReports(seeded);
    localStorage.setItem('gsra.reports.v1', JSON.stringify(seeded));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    localStorage.setItem('gsra.reports.v1', JSON.stringify(updated));
  };

  const handleDownloadCsv = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    let csvContent = report.dossier?.csv_export;
    if (!csvContent) {
      csvContent = [
        '# GEOSPATIAL SITE READINESS REPORT',
        `Report ID,${report.id}`,
        `Location Name,"${report.name}"`,
        `Site Profile,${report.siteType}`,
        `Overall Score,${report.score}`,
        `Grade,${report.grade || 'Grade A'}`,
        `Created Date,${report.createdDate}`,
      ].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSRA-Report-${report.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = report.dossier || {
      metadata: {
        report_id: report.id,
        created_at: report.createdDate,
        system: 'GeoSpatial Site Readiness Analyzer',
      },
      site: {
        location_name: report.name,
        site_type: report.siteType,
        coordinates: report.coordinates || { lat: 23.0378, lng: 72.5112 },
      },
      evaluation: {
        overall_score: report.score,
        grade: report.grade || 'Grade A',
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSRA-Dossier-${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenDossier = (report: SavedReport) => {
    setSelectedReport(report);
    setIsDossierOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full text-ink">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-ink">Analytical Report Archive</h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-chip bg-brand-50 text-brand-700 border border-brand-200">
              {reports.length} Dossiers
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Exported multi-criteria site suitability dossiers, travel isochrones, and candidate evaluation summaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={seedDefaultReports}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-slate-200 rounded-btn text-xs font-medium text-slate-700 hover:text-ink hover:bg-slate-50 transition-colors shadow-sm"
            title="Reset / Load Gujarat Benchmark Demonstration Sites"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Load Demo Portfolio</span>
          </button>

          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-btn text-xs font-semibold hover:bg-brand-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Map Workspace</span>
          </Link>
        </div>
      </div>

      {/* Reports Table Container */}
      <div className="mt-6 bg-surface border border-slate-200 rounded-panel shadow-float overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
            <FileText className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-slate-700">No saved dossiers yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Score candidate sites on the map and click "Export" to save them here.
              </p>
            </div>
            <button
              onClick={seedDefaultReports}
              className="mt-2 px-3 py-1.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-btn text-xs font-medium hover:bg-brand-100 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 4 Gujarat Benchmark Sites</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-slate-200 text-slate-500 font-semibold select-none">
                <tr>
                  <th className="py-3 px-4">Dossier ID</th>
                  <th className="py-3 px-4">Candidate Location</th>
                  <th className="py-3 px-4">Site Profile</th>
                  <th className="py-3 px-4 text-center">Readiness Score</th>
                  <th className="py-3 px-4">Generated Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => handleOpenDossier(report)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-500">
                      {report.id}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span className="font-semibold text-ink group-hover:text-brand-700 transition-colors">
                          {report.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-chip text-[11px] font-medium">
                        {report.siteType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-chip border border-brand-200">
                          {report.score} / 100
                        </span>
                        {report.grade && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-chip border border-emerald-200">
                            {report.grade}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono flex items-center gap-1.5 pt-4">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{report.createdDate}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDossier(report);
                          }}
                          className="px-2.5 py-1 bg-surface hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-chip transition-colors flex items-center gap-1 font-medium shadow-xs"
                          title="View Full Evaluation Dossier"
                        >
                          <Eye className="w-3 h-3 text-brand-600" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={(e) => handleDownloadCsv(report, e)}
                          className="px-2 py-1 text-slate-700 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors flex items-center gap-1 font-medium"
                          title="Download CSV Spreadsheet"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>CSV</span>
                        </button>

                        <button
                          onClick={(e) => handleDownloadJson(report, e)}
                          className="px-2 py-1 text-slate-700 hover:text-ink hover:bg-slate-100 rounded-chip transition-colors flex items-center gap-1 font-medium"
                          title="Download Raw JSON"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>JSON</span>
                        </button>

                        <button
                          onClick={(e) => handleDelete(report.id, e)}
                          className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-chip transition-colors ml-1"
                          title="Delete dossier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Dossier Modal Viewer */}
      {selectedReport && (
        <ReportExport
          isOpen={isDossierOpen}
          onClose={() => setIsDossierOpen(false)}
          selectedLocation={selectedReport.coordinates || { lat: 23.0378, lng: 72.5112 }}
          scoreData={null}
          locationName={selectedReport.name}
          siteType={selectedReport.siteType}
        />
      )}
    </div>
  );
};
