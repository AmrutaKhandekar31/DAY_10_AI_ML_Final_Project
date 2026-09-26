import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, PageHeader, RiskBadge, formatDate, pct } from "@/components/hygiene/AppShell";
import { predictionsQuery } from "@/lib/hygiene.functions";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Prediction History — FacilityRisk AI" },
      { name: "description", content: "All past hygiene risk predictions with filters." },
      { property: "og:title", content: "Prediction History — FacilityRisk AI" },
      { property: "og:description", content: "All past hygiene risk predictions with filters." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(predictionsQuery),
  component: HistoryPage,
});

function HistoryPage() {
  const { data } = useSuspenseQuery(predictionsQuery);
  const [filter, setFilter] = useState<"All" | "High" | "Low">("All");
  const [search, setSearch] = useState("");
  const rows = data.filter(
    (p) => (filter === "All" || p.risk_level === filter) && (p.facilities?.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader eyebrow="Records" title="Prediction History" description="Every assessment saved by the prediction system." />
      <div className="panel p-6">
        <div className="flex flex-wrap gap-3">
          <input placeholder="Search facility…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field max-w-xs" />
          {(["All", "High", "Low"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{f}</button>
          ))}
        </div>
        {rows.length === 0 ? <EmptyState>No matching predictions.</EmptyState> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="eyebrow text-left"><tr><th className="py-2">Facility</th><th>Type</th><th>Risk</th><th>Probability</th><th>Confidence</th><th>Model</th><th>Date</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-medium">{p.facilities?.name}</td>
                    <td>{p.facilities?.facility_type}</td>
                    <td><RiskBadge level={p.risk_level} /></td>
                    <td className="tabular-nums">{pct(p.probability)}</td>
                    <td className="tabular-nums">{pct(p.confidence)}</td>
                    <td className="text-muted-foreground">{p.model_version}</td>
                    <td className="text-muted-foreground">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
