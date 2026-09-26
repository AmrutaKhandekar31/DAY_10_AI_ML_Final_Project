import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FACILITY_TYPES, MODEL_FEATURES, assessmentInputSchema, predictRisk } from "@/lib/risk-model";

const bodySchema = z.object({ facility_type: z.enum(FACILITY_TYPES), inputs: assessmentInputSchema });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

// Stateless REST endpoint: POST /api/public/predict — does not write to the database.
export const Route = createFileRoute("/api/public/predict")({
  server: {
    handlers: {
      GET: async () => json({ status: "ok", method: "POST", required_features: MODEL_FEATURES, facility_types: FACILITY_TYPES }),
      OPTIONS: async () =>
        new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Body must be valid JSON" }, 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Validation failed", issues: parsed.error.flatten() }, 422);
        const result = predictRisk(parsed.data.inputs, parsed.data.facility_type);
        return json({
          risk_level: result.riskLevel,
          probability: Number(result.probability.toFixed(4)),
          confidence: Number(result.confidence.toFixed(4)),
          model_version: result.modelVersion,
          top_factors: result.contributions.slice(0, 3).map((c) => ({ feature: c.feature, impact: Number(c.impact.toFixed(3)) })),
        });
      },
    },
  },
});
