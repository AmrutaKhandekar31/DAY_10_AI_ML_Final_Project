import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { EmptyState, PageHeader, RiskBadge, StatCard, formatDate, pct } from "@/components/hygiene/AppShell";
import { facilitiesQuery, predictionsQuery } from "@/lib/hygiene.functions";
import metrics from "@/data/metrics.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FacilityRisk AI" },
      { name: "description", content: "Overview of facility hygiene risk predictions from the ML model." },
      { property: "og:title", content: "Dashboard — FacilityRisk AI" },
      { property: "og:description", content: "Overview of facility hygiene risk predictions from the ML model." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(facilitiesQuery),
      context.queryClient.ensureQueryData(predictionsQuery),
    ]),
  component: Dashboard,
});

function Dashboard() {
  const { data: facilities } = useSuspenseQuery(facilitiesQuery);
  const { data: predictions } = useSuspenseQuery(predictionsQuery);
  const high = predictions.filter((p) => p.risk_level === "High").length;
  const low = predictions.length - high;
  const deployed = metrics.models[metrics.deployed_model as keyof typeof metrics.models];

  return (
    <>
      <PageHeader eyebrow="Facility overview" title="Dashboard" description="Monitor facility hygiene and predicted risk levels." />

      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10" style={{ background: "var(--gradient-hero)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(oklch(0.95 0.02 220 / 0.25) 1px, transparent 1px), linear-gradient(90deg, oklch(0.95 0.02 220 / 0.25) 1px, transparent 1px)", backgroundSize: "2.5rem 2.5rem" }} />
        <div className="relative max-w-xl space-y-5">
          <div className="glass rounded-2xl p-6">
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Predict risk before it becomes a problem.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              FacilityRisk AI uses machine learning to assess facility conditions and flag potential hygiene risks.
            </p>
          </div>
          <Link to="/assessment" className="flex items-center gap-4 rounded-2xl bg-accent p-4 text-accent-foreground shadow-lg transition-transform hover:-translate-y-0.5">
            <span className="grid size-11 place-items-center rounded-xl bg-card"><Sparkles className="size-5" /></span>
            <span className="flex-1">
              <span className="eyebrow block text-accent-foreground/70">New assessment</span>
              <span className="block font-semibold">Start New Assessment</span>
              <span className="block text-xs">Check a facility and generate an AI hygiene risk prediction.</span>
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facilities" value={facilities.length} hint="Registered facilities" />
        <StatCard label="Predictions" value={predictions.length} hint="Total assessments" />
        <StatCard label="High risk" value={high} hint="Assessments requiring attention" />
        <StatCard label="Model accuracy" value={pct(deployed.accuracy)} hint={`${metrics.deployed_model}, ROC-AUC ${deployed.roc_auc}`} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <div className="flex items-end justify-between">
            <div><div className="eyebrow">Activity</div><h3 className="text-lg font-semibold">Recent Predictions</h3></div>
            <Link to="/history" className="text-sm text-primary">View all →</Link>
          </div>
          {predictions.length === 0 ? (
            <EmptyState>No predictions yet — run your first assessment.</EmptyState>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="eyebrow text-left"><tr><th className="py-2">Facility</th><th>Risk</th><th>Confidence</th><th>Date</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {predictions.slice(0, 6).map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 font-medium">{p.facilities?.name}</td>
                      <td><RiskBadge level={p.risk_level} /></td>
                      <td className="tabular-nums">{pct(p.confidence)}</td>
                      <td className="text-muted-foreground">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel p-6">
          <div className="eyebrow">Risk overview</div>
          <h3 className="text-lg font-semibold">Current Risk Distribution</h3>
          <div className="mt-6 space-y-4">
            {[{ label: "High risk", n: high, cls: "bg-destructive" }, { label: "Low risk", n: low, cls: "bg-success" }].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm"><span>{r.label}</span><span className="tabular-nums">{r.n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div className={`h-full rounded-full ${r.cls}`} style={{ width: `${predictions.length ? (r.n / predictions.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
