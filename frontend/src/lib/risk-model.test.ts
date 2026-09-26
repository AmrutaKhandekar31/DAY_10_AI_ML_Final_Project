import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, assessmentInputSchema, predictRisk } from "./risk-model";

const clean = { ...DEFAULT_INPUT, cleaning_frequency_per_day: 6, staff_trained_pct: 95, waste_disposal_score: 9, water_quality_score: 9, pest_sightings: 0, days_since_last_inspection: 20, previous_violations: 0 };
const dirty = { ...DEFAULT_INPUT, cleaning_frequency_per_day: 0, staff_trained_pct: 20, waste_disposal_score: 2, water_quality_score: 2, pest_sightings: 8, days_since_last_inspection: 380, previous_violations: 6 };

describe("predictRisk", () => {
  it("rates a well-kept office as low risk", () => {
    expect(predictRisk(clean, "Office").riskLevel).toBe("Low");
  });
  it("rates a neglected restaurant as high risk", () => {
    const r = predictRisk(dirty, "Restaurant");
    expect(r.riskLevel).toBe("High");
    expect(r.probability).toBeGreaterThan(0.9);
  });
  it("returns a probability between 0 and 1", () => {
    const r = predictRisk(DEFAULT_INPUT, "Hotel");
    expect(r.probability).toBeGreaterThanOrEqual(0);
    expect(r.probability).toBeLessThanOrEqual(1);
  });
});

describe("assessmentInputSchema", () => {
  it("rejects out-of-range values", () => {
    expect(assessmentInputSchema.safeParse({ ...DEFAULT_INPUT, humidity_pct: 150 }).success).toBe(false);
  });
  it("coerces numeric strings", () => {
    const parsed = assessmentInputSchema.safeParse(Object.fromEntries(Object.entries(DEFAULT_INPUT).map(([k, v]) => [k, String(v)])));
    expect(parsed.success).toBe(true);
  });
});
