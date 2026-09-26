import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader, RiskBadge, pct } from "@/components/hygiene/AppShell";
import { facilitiesQuery, runAssessment } from "@/lib/hygiene.functions";
import { DEFAULT_INPUT, FEATURE_META, MODEL_FEATURES, assessmentInputSchema, type RiskPrediction } from "@/lib/risk-model";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "New Assessment — FacilityRisk AI" },
      { name: "description", content: "Enter facility conditions and get an ML-predicted hygiene risk." },
      { property: "og:title", content: "New Assessment — FacilityRisk AI" },
      { property: "og:description", content: "Enter facility conditions and get an ML-predicted hygiene risk." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(facilitiesQuery),
  component: AssessmentPage,
});

function AssessmentPage() {
  const { data: facilities } = useSuspenseQuery(facilitiesQuery);
  const queryClient = useQueryClient();
  const assess = useServerFn(runAssessment);
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(MODEL_FEATURES.map((f) => [f, String(DEFAULT_INPUT[f])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RiskPrediction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = assessmentInputSchema.safeParse(values);
    const nextErrors: Record<string, string> = {};
    if (!facilityId) nextErrors["facility"] = "Choose a facility";
    if (!parsed.success) for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.message;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !parsed.success) return;

    setSubmitting(true);
    try {
      const prediction = await assess({ data: { facility_id: facilityId, inputs: parsed.data } });
      setResult(prediction);
      await queryClient.invalidateQueries({ queryKey: ["predictions"] });
      toast.success("Prediction saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Assessment" title="New Assessment" description="Enter current facility conditions to estimate hygiene risk." />
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={handleSubmit} noValidate className="panel space-y-5 p-6 lg:col-span-3">
          <Field label="Facility" error={errors["facility"]}>
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="input-field">
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.facility_type}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODEL_FEATURES.map((f) => {
              const m = FEATURE_META[f]!;
              return (
                <Field key={f} label={`${m.label}${m.unit ? ` (${m.unit})` : ""}`} error={errors[f]}>
                  <input
                    type="number" inputMode="decimal" min={m.min} max={m.max} step={m.step}
                    value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                    className="input-field tabular-nums" aria-invalid={!!errors[f]}
                  />
                </Field>
              );
            })}
          </div>
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
            {submitting && <Loader2 className="size-4 animate-spin" />} Generate prediction
          </button>
        </form>

        <div className="panel p-6 lg:col-span-2">
          <div className="eyebrow">Model verdict</div>
          {!result ? (
            <p className="mt-6 text-sm text-muted-foreground">Submit the form to see the predicted risk and the factors driving it.</p>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-semibold tabular-nums">{pct(result.probability)}</span>
                <RiskBadge level={result.riskLevel} />
              </div>
              <p className="text-sm text-muted-foreground">
                Probability of high hygiene risk · confidence {pct(result.confidence)} · {result.modelVersion}
              </p>
              <div>
                <div className="eyebrow mb-3">Top contributing factors</div>
                <ul className="space-y-3">
                  {result.contributions.slice(0, 5).map((c) => (
                    <li key={c.feature}>
                      <div className="flex justify-between text-sm">
                        <span>{c.label}</span>
                        <span className={c.impact > 0 ? "text-destructive" : "text-success"}>{c.impact > 0 ? "↑ raises" : "↓ lowers"} risk</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className={`h-full rounded-full ${c.impact > 0 ? "bg-destructive" : "bg-success"}`} style={{ width: `${Math.min(100, Math.abs(c.impact) * 40)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}
