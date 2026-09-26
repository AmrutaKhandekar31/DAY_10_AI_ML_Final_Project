// Portable inference for the trained Logistic Regression exported by ml/pipeline.py.
// Shared by the browser, server functions and the public REST API.
import model from "@/data/model.json";
import { z } from "zod";

export const FACILITY_TYPES = ["Restaurant", "Hospital", "School", "Hotel", "Office"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FEATURE_META: Record<string, { label: string; min: number; max: number; step: number; unit?: string }> = {
  cleaning_frequency_per_day: { label: "Cleanings per day", min: 0, max: 10, step: 1 },
  staff_trained_pct: { label: "Staff hygiene-trained", min: 0, max: 100, step: 1, unit: "%" },
  waste_disposal_score: { label: "Waste disposal score", min: 1, max: 10, step: 1 },
  water_quality_score: { label: "Water quality score", min: 1, max: 10, step: 1 },
  pest_sightings: { label: "Pest sightings (last month)", min: 0, max: 20, step: 1 },
  temperature_c: { label: "Temperature", min: -10, max: 60, step: 0.1, unit: "°C" },
  humidity_pct: { label: "Humidity", min: 0, max: 100, step: 1, unit: "%" },
  days_since_last_inspection: { label: "Days since last inspection", min: 0, max: 1000, step: 1 },
  previous_violations: { label: "Previous violations", min: 0, max: 50, step: 1 },
};

export const MODEL_FEATURES = model.numeric_features as string[];

export const assessmentInputSchema = z.object(
  Object.fromEntries(
    MODEL_FEATURES.map((f) => {
      const m = FEATURE_META[f] ?? { label: f, min: -1e9, max: 1e9, step: 1 };
      return [
        f,
        z.coerce
          .number({ invalid_type_error: `${m.label} must be a number` })
          .min(m.min, `${m.label} must be ≥ ${m.min}`)
          .max(m.max, `${m.label} must be ≤ ${m.max}`),
      ];
    }),
  ) as Record<string, z.ZodNumber>,
);
export type AssessmentInput = Record<string, number>;

export interface RiskPrediction {
  probability: number;
  riskLevel: "High" | "Low";
  confidence: number;
  modelVersion: string;
  contributions: { feature: string; label: string; impact: number }[];
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

interface ExportedModel {
  intercept: number;
  medians: Record<string, number>;
  means: Record<string, number>;
  stds: Record<string, number>;
  coefficients: Record<string, number>;
  clip_bounds: Record<string, number[]>;
  facility_type_coefficients: Record<string, number>;
}

export function predictRisk(input: AssessmentInput, facilityType: FacilityType): RiskPrediction {
  const m = model as unknown as ExportedModel;
  let logit = m.intercept + (m.facility_type_coefficients[facilityType] ?? 0);
  const contributions = MODEL_FEATURES.map((feature) => {
    const [low = -Infinity, high = Infinity] = m.clip_bounds[feature] ?? [];
    const value = input[feature];
    const raw = value !== undefined && Number.isFinite(value) ? value : (m.medians[feature] ?? 0);
    const clipped = Math.min(Math.max(raw, low), high);
    const z = (clipped - (m.means[feature] ?? 0)) / (m.stds[feature] ?? 1);
    const impact = z * (m.coefficients[feature] ?? 0);
    logit += impact;
    return { feature, label: FEATURE_META[feature]?.label ?? feature, impact };
  }).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const probability = sigmoid(logit);
  const riskLevel = probability >= model.threshold ? "High" : "Low";
  return {
    probability,
    riskLevel,
    confidence: riskLevel === "High" ? probability : 1 - probability,
    modelVersion: `${model.name} v${model.version}`,
    contributions,
  };
}

export const DEFAULT_INPUT: AssessmentInput = {
  cleaning_frequency_per_day: 3,
  staff_trained_pct: 70,
  waste_disposal_score: 6,
  water_quality_score: 7,
  pest_sightings: 1,
  temperature_c: 24,
  humidity_pct: 60,
  days_since_last_inspection: 120,
  previous_violations: 1,
};
