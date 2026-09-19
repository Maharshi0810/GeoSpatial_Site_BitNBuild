import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import { FactorBreakdown } from '@/mocks/mockDataService';

export interface BreakdownChartProps {
  breakdown: FactorBreakdown[] | Record<string, any>;
  score?: number;
  grade?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const BreakdownChart: React.FC<BreakdownChartProps> = ({
  breakdown,
  score,
  grade,
}) => {
  // Normalize breakdown data to a unified array for RadarChart
  const chartData = React.useMemo(() => {
    if (Array.isArray(breakdown)) {
      return breakdown.map((item) => ({
        subject: item.label || item.factorId,
        score: Math.round(item.normalized * 100),
        raw: item.rawValue,
        unit: item.unit,
        contribution: item.contribution,
        fullMark: 100,
      }));
    } else if (typeof breakdown === 'object' && breakdown !== null) {
      return Object.entries(breakdown).map(([key, val]: [string, any]) => ({
        subject: val.label || key,
        score: Math.round((val.score ?? val.normalized ?? 0.7) * 100),
        raw: val.raw_value ?? val.rawValue ?? 0,
        unit: val.unit || '',
        contribution: val.contribution ?? 0,
        fullMark: 100,
      }));
    }
    return [];
  }, [breakdown]);

  if (chartData.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-slate-500 bg-canvas border border-slate-200 rounded-btn">
        No factor breakdown data available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-canvas border border-slate-200 rounded-btn transition-all">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-ink uppercase tracking-wider text-[10px]">
            Multi-Criteria Factor Radar
          </span>
        </div>
        {grade && (
          <span className="px-2 py-0.5 text-[11px] font-bold font-mono rounded-chip bg-brand-50 text-brand-700 border border-brand-200">
            Grade {grade}
          </span>
        )}
      </div>

      <div className="h-[210px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 9 }}
              stroke="#cbd5e1"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="p-2 bg-surface/95 backdrop-blur-sm border border-slate-200 shadow-float rounded-btn text-[11px] flex flex-col gap-1 min-w-[140px]">
                      <span className="font-semibold text-ink">{data.subject}</span>
                      <div className="flex justify-between text-slate-500">
                        <span>Factor score:</span>
                        <span className="font-mono font-bold text-brand-600">
                          {data.score} / 100
                        </span>
                      </div>
                      {data.contribution !== undefined && (
                        <div className="flex justify-between text-slate-500">
                          <span>Contribution:</span>
                          <span
                            className={`font-mono ${
                              data.contribution >= 0 ? 'text-brand-600' : 'text-red-700'
                            }`}
                          >
                            {data.contribution >= 0 ? `+${data.contribution}` : data.contribution} pts
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Radar
              name="Site Readiness"
              dataKey="score"
              stroke="#0284c7"
              fill="#0284c7"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
        <span>5 Evaluation Axes</span>
        {score !== undefined && (
          <span className="text-ink font-medium">Overall: {score}/100</span>
        )}
      </div>
    </div>
  );
};
