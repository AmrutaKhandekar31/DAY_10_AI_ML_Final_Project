import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { FACILITY_TYPES, assessmentInputSchema, predictRisk } from "./risk-model";

export interface Facility {
  id: string;
  name: string;
  facility_type: (typeof FACILITY_TYPES)[number];
  location: string;
  created_at: string;
}
export interface PredictionRow {
  id: string;
  facility_id: string;
  inputs: Record<string, number>;
  probability: number;
  risk_level: "High" | "Low";
  confidence: number;
  model_version: string;
  created_at: string;
  facilities: { name: string; facility_type: string } | null;
}

export const facilitiesQuery = queryOptions({
  queryKey: ["facilities"],
  queryFn: async (): Promise<Facility[]> => {
    const { data, error } = await supabase.from("facilities").select("*").order("name");
    if (error) throw new Error(error.message);
    return data as Facility[];
  },
});

export const predictionsQuery = queryOptions({
  queryKey: ["predictions"],
  queryFn: async (): Promise<PredictionRow[]> => {
    const { data, error } = await supabase
      .from("predictions")
      .select("*, facilities(name, facility_type)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data as unknown as PredictionRow[]).map((p) => ({
      ...p,
      probability: Number(p.probability),
      confidence: Number(p.confidence),
    }));
  },
});

const facilitySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  facility_type: z.enum(FACILITY_TYPES),
  location: z.string().trim().max(160).default(""),
});

export const createFacility = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => facilitySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("facilities").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row as Facility;
  });

const assessmentSchema = z.object({
  facility_id: z.string().uuid("Choose a facility"),
  inputs: assessmentInputSchema,
});

export const runAssessment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => assessmentSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: facility, error: fErr } = await supabaseAdmin
      .from("facilities").select("facility_type").eq("id", data.facility_id).single();
    if (fErr || !facility) throw new Error("Facility not found");
    const result = predictRisk(data.inputs, facility.facility_type as (typeof FACILITY_TYPES)[number]);
    const { error } = await supabaseAdmin.from("predictions").insert({
      facility_id: data.facility_id,
      inputs: data.inputs,
      probability: Number(result.probability.toFixed(4)),
      risk_level: result.riskLevel,
      confidence: Number(result.confidence.toFixed(4)),
      model_version: result.modelVersion,
    });
    if (error) throw new Error(error.message);
    return result;
  });
