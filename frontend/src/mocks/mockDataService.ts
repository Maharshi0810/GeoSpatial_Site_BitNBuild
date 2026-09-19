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
    siteType: string = 'ev_charging'
  ): Promise<ScoreResponse> {
    // Simulate brief network latency
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Deep copy and adjust coordinates to match selected point
    const rawData = {
      ...sampleScoreData,
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
