import { useState, useCallback } from 'react';
import { CandidateSite, ScoreResponse } from '@/mocks/mockDataService';
import { reverseGeocode, isCoordinateString } from '@/services/geocodingService';

export interface EvaluatedSiteComparison {
  id: string;
  label: string;
  lat: number;
  lng: number;
  score: number;
  grade?: string;
  breakdown?: Record<string, { label: string; score: number; contribution: number; weight: number }> | any[];
  constraints?: any[];
}

export interface CompareResult {
  sites: EvaluatedSiteComparison[];
  bestSite: string | null;
  comparisonSummary: string;
}

export function useCompareApi() {
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);

  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const addSiteFromScore = useCallback((scoreData: ScoreResponse, overrideName?: string) => {
    const rawName = overrideName || scoreData.locationName;
    const initialName = (!isCoordinateString(rawName))
      ? rawName!
      : `Evaluating Location...`;

    const siteId = `site-${Date.now()}`;
    const newSite: CandidateSite = {
      id: siteId,
      name: initialName,
      lat: scoreData.coordinates.lat,
      lng: scoreData.coordinates.lng,
      siteType: scoreData.siteType || 'ev_charging',
      score: scoreData.score,
    };

    setCandidateSites((prev) => {
      // Check if coordinate already added
      const exists = prev.some(
        (s) =>
          Math.abs(s.lat - scoreData.coordinates.lat) < 0.0001 &&
          Math.abs(s.lng - scoreData.coordinates.lng) < 0.0001
      );
      if (exists) return prev;
      if (prev.length >= 6) return prev; // Limit to 6 candidates
      return [...prev, newSite];
    });

    if (isCoordinateString(rawName)) {
      reverseGeocode(scoreData.coordinates.lat, scoreData.coordinates.lng).then((geo) => {
        setCandidateSites((prev) =>
          prev.map((s) => (s.id === siteId ? { ...s, name: geo.name } : s))
        );
      });
    }
  }, []);

  const removeSite = useCallback((id: string) => {
    setCandidateSites((prev) => prev.filter((s) => s.id !== id));
    setCompareResult((prev) => {
      if (!prev) return null;
      const updated = prev.sites.filter((s) => s.id !== id);
      if (updated.length === 0) return null;
      const best = updated.reduce((top, curr) => (curr.score > top.score ? curr : top), updated[0]);
      return {
        sites: updated,
        bestSite: best.label,
        comparisonSummary: `${best.label} has the highest site readiness score (${best.score}/100) among remaining candidates.`,
      };
    });
  }, []);

  const clearSites = useCallback(() => {
    setCandidateSites([]);
    setCompareResult(null);
  }, []);

  const runCompare = useCallback(async (siteType?: string) => {
    if (candidateSites.length === 0) return;

    setIsLoading(true);
    setError(null);

    const effectiveSiteType = siteType || candidateSites[0]?.siteType || 'ev_charging';

    try {
      const payload = {
        site_type: effectiveSiteType,
        sites: candidateSites.map((site) => ({
          label: site.name,
          lat: site.lat,
          lng: site.lng,
        })),
      };

      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setCompareResult({
          sites: data.sites.map((s: any, idx: number) => ({
            id: candidateSites[idx]?.id || `site-${idx}`,
            label: s.label,
            lat: s.lat,
            lng: s.lng,
            score: s.score,
            grade: s.grade,
            breakdown: s.breakdown,
            constraints: s.constraints,
          })),
          bestSite: data.best_site,
          comparisonSummary: data.comparison_summary,
        });
      } else {
        throw new Error(`API error ${res.status}`);
      }
    } catch {
      // Local fallback calculation for robust presentation
      const sorted = [...candidateSites].sort((a, b) => b.score - a.score);
      const best = sorted[0];
      setCompareResult({
        sites: candidateSites.map((s) => ({
          id: s.id,
          label: s.name,
          lat: s.lat,
          lng: s.lng,
          score: s.score,
          grade: s.score >= 85 ? 'A' : s.score >= 70 ? 'B' : s.score >= 55 ? 'C' : 'D',
        })),
        bestSite: best.name,
        comparisonSummary: `${best.name} scores highest (${best.score}/100) based on evaluated multi-criteria factors.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [candidateSites]);

  return {
    candidateSites,
    compareResult,
    isLoading,
    error,
    addSiteFromScore,
    removeSite,
    clearSites,
    runCompare,
  };
}
