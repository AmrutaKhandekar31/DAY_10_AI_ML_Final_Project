import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  FACILITY_TYPES,
  assessmentInputSchema,
  predictRisk,
} from "./risk-model";

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
  facilities: {
    name: string;
    facility_type: string;
  } | null;
}

export const getFacilities = createServerFn({ method: "GET" }).handler(
  async () => {
    const { pool } = await import("./db.server");

    const result = await pool.query<Facility>(
      `SELECT id, name, facility_type, location, created_at
       FROM public.facilities
       ORDER BY name`,
    );

    return result.rows;
  },
);

export const facilitiesQuery = queryOptions({
  queryKey: ["facilities"],
  queryFn: () => getFacilities(),
});

export const getPredictions = createServerFn({ method: "GET" }).handler(
  async () => {
    const { pool } = await import("./db.server");

    const result = await pool.query(
      `SELECT
         p.id,
         p.facility_id,
         p.inputs,
         p.probability,
         p.risk_level,
         p.confidence,
         p.model_version,
         p.created_at,
         f.name AS facility_name,
         f.facility_type AS facility_type
       FROM public.predictions p
       LEFT JOIN public.facilities f
         ON p.facility_id = f.id
       ORDER BY p.created_at DESC
       LIMIT 200`,
    );

    return result.rows.map((p) => ({
      id: p.id,
      facility_id: p.facility_id,
      inputs: p.inputs,
      probability: Number(p.probability),
      risk_level: p.risk_level,
      confidence: Number(p.confidence),
      model_version: p.model_version,
      created_at: p.created_at,
      facilities: p.facility_name
        ? {
            name: p.facility_name,
            facility_type: p.facility_type,
          }
        : null,
    })) as PredictionRow[];
  },
);

export const predictionsQuery = queryOptions({
  queryKey: ["predictions"],
  queryFn: () => getPredictions(),
});

const facilitySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  facility_type: z.enum(FACILITY_TYPES),
  location: z.string().trim().max(160).default(""),
});

export const createFacility = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => facilitySchema.parse(data))
  .handler(async ({ data }) => {
    const { pool } = await import("./db.server");

    const result = await pool.query<Facility>(
      `INSERT INTO public.facilities
       (name, facility_type, location)
       VALUES ($1, $2, $3)
       RETURNING id, name, facility_type, location, created_at`,
      [data.name, data.facility_type, data.location],
    );

    return result.rows[0];
  });

const assessmentSchema = z.object({
  facility_id: z.string().uuid("Choose a facility"),
  inputs: assessmentInputSchema,
});

export const runAssessment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => assessmentSchema.parse(data))
  .handler(async ({ data }) => {
    const { pool } = await import("./db.server");

    const facilityResult = await pool.query<{ facility_type: string }>(
      `SELECT facility_type
       FROM public.facilities
       WHERE id = $1`,
      [data.facility_id],
    );

    const facility = facilityResult.rows[0];

    if (!facility) {
      throw new Error("Facility not found");
    }

    const result = predictRisk(
      data.inputs,
      facility.facility_type as (typeof FACILITY_TYPES)[number],
    );

    await pool.query(
      `INSERT INTO public.predictions
       (
         facility_id,
         inputs,
         probability,
         risk_level,
         confidence,
         model_version
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.facility_id,
        JSON.stringify(data.inputs),
        Number(result.probability.toFixed(4)),
        result.riskLevel,
        Number(result.confidence.toFixed(4)),
        result.modelVersion,
      ],
    );

    return result;
  });
const facilityIdSchema = z.object({
  id: z.string().uuid("Invalid facility ID"),
});

export const deleteFacility = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => facilityIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { pool } = await import("./db.server");

    const result = await pool.query(
      `DELETE FROM public.facilities
       WHERE id = $1
       RETURNING id, name`,
      [data.id],
    );

    if (result.rowCount === 0) {
      throw new Error("Facility not found");
    }

    return result.rows[0];
  });