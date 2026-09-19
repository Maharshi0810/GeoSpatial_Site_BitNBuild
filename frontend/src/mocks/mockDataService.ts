import { z } from 'zod';
import sampleScoreData from './fixtures/sample-score.json';
import sampleAhmedabadData from './fixtures/sample-ahmedabad.json';

// --- Zod Schemas for Type Safety & Boundary Validation ---

export const FactorBreakdownSchema = z.object({
  factorId: z.string(),
  label: z.string(),
  rawValue: z.number(),
  unit: z.string(),
  normalized: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  contribution: z.number(),
  explanation: z.string(),
  geometryRef: z.string().optional(),
});

export const ConstraintCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  reason: z.string(),
});

export const AccessibilityBandSchema = z.object({
  minutes: z.number(),
  population: z.number(),
  area_km2: z.number(),
});

export const ScoreResponseSchema = z.object({
  locationName: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  siteType: z.string(),
  score: z.number().min(0).max(100),
  percentile: z.number().optional(),
  cappedBy: z.string().nullable().optional(),
  breakdown: z.array(FactorBreakdownSchema),
  constraints: z.array(ConstraintCheckSchema),
  accessibility: z.array(AccessibilityBandSchema).optional(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;
export type FactorBreakdown = z.infer<typeof FactorBreakdownSchema>;
export type ConstraintCheck = z.infer<typeof ConstraintCheckSchema>;
export type AccessibilityBand = z.infer<typeof AccessibilityBandSchema>;

export const CandidateSiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  siteType: z.string(),
  score: z.number(),
});

export type CandidateSite = z.infer<typeof CandidateSiteSchema>;

// --- Mock Data Service (Runs with zero backend) ---

class MockDataService {
  private isMockActive = true;

  public getIsMockActive(): boolean {
    return this.isMockActive;
  }

  public async fetchScoreForLocation(
    lat: number,
    lng: number,
    siteType: string = 'ev_charging',
    subFilter?: string
  ): Promise<ScoreResponse> {
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, site_type: siteType, sub_filter: subFilter }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data;
        if (data && typeof data.score === 'number') {
          this.isMockActive = false;

          const factorKeys = Object.keys(data.breakdown || {});
          const breakdown = factorKeys.map((key) => {
            const item = data.breakdown[key];
            const scoreVal = typeof item.score === 'number' ? item.score : 50;
            return {
              factorId: key,
              label: item.label || key,
              rawValue: Math.round(scoreVal * 10),
              unit: 'index',
              normalized: Number((scoreVal / 100).toFixed(2)),
              weight: 0.2,
              contribution: Number((scoreVal * 0.2).toFixed(1)),
              explanation: `Computed ${item.label || key} readiness score of ${scoreVal}/100 based on Gujarat spatial data layers.`,
            };
          });

          const constraints = [
            {
              id: 'flood_zone',
              label: 'Flood plain setback',
              passed: !data.constraints?.in_flood_zone,
              reason: data.constraints?.in_flood_zone
                ? 'Candidate point falls within active flood risk zone.'
                : 'Outside identified high-risk flood zones.',
            },
            {
              id: 'arterial_proximity',
              label: 'Arterial road access',
              passed: (data.constraints?.min_road_distance_m ?? 0) <= 2500,
              reason: `Distance to nearest mapped highway/road is ${Math.round(data.constraints?.min_road_distance_m ?? 0)} m.`,
            },
          ];

          return ScoreResponseSchema.parse({
            locationName: `Site at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            coordinates: { lat, lng },
            siteType,
            score: Math.round(data.score),
            percentile: Math.min(99, Math.max(1, Math.round(data.score * 0.95))),
            cappedBy: data.constraints?.in_flood_zone ? 'Flood zone safety penalty' : null,
            breakdown: breakdown.length > 0 ? breakdown : sampleScoreData.breakdown,
            constraints,
            accessibility: sampleScoreData.accessibility,
          });
        }
      }
    } catch {
      // Backend not running or call failed; gracefully fall back to mock fixture
    }

    this.isMockActive = true;
    // Simulate brief network latency for mock mode
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Deep copy and adjust coordinates to match selected point
    let adjustedScore = sampleScoreData.score;
    if (subFilter === 'fast_dc') adjustedScore = Math.min(100, adjustedScore + 3);
    else if (subFilter === 'power_50kw') adjustedScore = Math.min(100, adjustedScore + 2);
    else if (subFilter === 'grid_capacity') adjustedScore = Math.min(100, adjustedScore + 4);
    else if (subFilter === 'highway_access') adjustedScore = Math.min(100, adjustedScore + 5);

    const rawData = {
      ...sampleScoreData,
      score: adjustedScore,
      siteType,
      coordinates: { lat, lng },
      locationName: `Site at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };

    const validated = ScoreResponseSchema.parse(rawData);
    return validated;
  }

  public async fetchMetropolitanConfig() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return sampleAhmedabadData;
  }

  public async fetchCandidateSites(): Promise<CandidateSite[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return sampleAhmedabadData.candidateSites.map((s) => CandidateSiteSchema.parse(s));
  }
}

export const mockDataService = new MockDataService();
