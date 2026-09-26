import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, StatCard, pct } from "@/components/hygiene/AppShell";
import { FEATURE_META } from "@/lib/risk-model";
import eda from "@/data/eda.json";
import metrics from "@/data/metrics.json";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — FacilityRisk AI" },
      { name: "description", content: "EDA, feature selection and model evaluation for the hygiene risk model." },
      { property: "og:title", content: "Analytics — FacilityRisk AI" },
      { property: "og:description", content: "EDA, feature selection and model evaluation for the hygiene risk model." },
    ],
  }),
  component: AnalyticsPage,
});

const label = (f: string) => FEATURE_META[f]?.label ?? f.replace(/_/g, " ");
const tick = { fontSize: 11, fill: "var(--color-muted-foreground)" };

function AnalyticsPage() {
  const histFeatures = Object.keys(eda.histograms);
  const [feature, setFeature] = useState(histFeatures[0]);
  const models = Object.entries(metrics.models);
  const deployed = metrics.models[metrics.deployed_model as keyof typeof metrics.models];
  const cm = deployed.confusion_matrix;
  const importance = Object.entries(metrics.feature_importance).slice(0, 10).map(([f, v]) => ({ name: label(f), value: v }));
  const mi = Object.entries(metrics.feature_selection.mutual_information).map(([f, v]) => ({ name: label(f), value: v, selected: metrics.feature_selection.selected.includes(f) }));
  const corr = Object.entries(eda.correlation_with_target).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader eyebrow="Model insights" title="Analytics" description="Exploratory data analysis, feature selection and model evaluation." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dataset" value={eda.rows.toLocaleString()} hint={`${metrics.train_rows} train / ${metrics.test_rows} test rows`} />
        <StatCard label="High-risk rate" value={pct(eda.high_risk_rate)} hint="Class balance in training data" />
        <StatCard label="ROC-AUC" value={deployed.roc_auc} hint={metrics.deployed_model} />
        <StatCard label="F1 score" value={deployed.f1} hint={`Precision ${deployed.precision} · Recall ${deployed.recall}`} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <div className="eyebrow">EDA</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Feature distribution by risk</h3>
            <select value={feature} onChange={(e) => setFeature(e.target.value)} className="input-field max-w-56 py-1.5 text-xs">
              {histFeatures.map((f) => <option key={f} value={f}>{label(f)}</option>)}
            </select>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={eda.histograms[feature as keyof typeof eda.histograms]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="bin" tick={tick} /><YAxis tick={tick} /><Tooltip />
                <Bar dataKey="low" stackId="a" name="Low risk" fill="var(--color-chart-1)" />
                <Bar dataKey="high" stackId="a" name="High risk" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <div className="eyebrow">EDA</div>
          <h3 className="text-lg font-semibold">Correlation with high risk</h3>
          <ul className="mt-4 space-y-2.5">
            {corr.map(([f, v]) => (
              <li key={f} className="grid grid-cols-[1fr_2fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{label(f)}</span>
                <div className="relative h-2 rounded-full bg-muted">
                  <div className={`absolute top-0 h-full rounded-full ${v > 0 ? "left-1/2 bg-destructive" : "right-1/2 bg-success"}`} style={{ width: `${Math.abs(v) * 50}%` }} />
                </div>
                <span className="text-right tabular-nums">{v.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-6">
          <div className="eyebrow">Feature selection</div>
          <h3 className="text-lg font-semibold">Mutual information (selected in green)</h3>
          <p className="text-xs text-muted-foreground">Union of top mutual-information features and RFE. Dropped: {metrics.feature_selection.dropped.map(label).join(", ") || "none"}.</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={mi} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" tick={tick} /><YAxis type="category" dataKey="name" tick={tick} width={150} /><Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <div className="eyebrow">Explainability</div>
          <h3 className="text-lg font-semibold">Feature importance (Random Forest)</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={importance} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" tick={tick} /><YAxis type="category" dataKey="name" tick={tick} width={150} /><Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <div className="eyebrow">Evaluation</div>
          <h3 className="text-lg font-semibold">ROC curves</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} allowDuplicatedCategory={false} tick={tick} /><YAxis domain={[0, 1]} tick={tick} /><Tooltip />
                {models.map(([name, m], i) => (
                  <Line key={name} data={m.roc_curve} dataKey="tpr" name={name} dot={false} isAnimationActive={false} type="monotone" strokeWidth={2} stroke={`var(--color-chart-${i + 1})`} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <div className="eyebrow">Evaluation</div>
          <h3 className="text-lg font-semibold">Confusion matrix · {metrics.deployed_model}</h3>
          <div className="mt-4 grid max-w-xs grid-cols-[auto_1fr_1fr] gap-2 text-center text-sm">
            <span /><span className="eyebrow">Pred. Low</span><span className="eyebrow">Pred. High</span>
            <span className="eyebrow self-center">Actual Low</span>
            <span className="rounded-xl bg-success/15 py-5 text-xl font-semibold">{cm[0]?.[0]}</span>
            <span className="rounded-xl bg-destructive/10 py-5 text-xl font-semibold">{cm[0]?.[1]}</span>
            <span className="eyebrow self-center">Actual High</span>
            <span className="rounded-xl bg-destructive/10 py-5 text-xl font-semibold">{cm[1]?.[0]}</span>
            <span className="rounded-xl bg-success/15 py-5 text-xl font-semibold">{cm[1]?.[1]}</span>
          </div>
        </div>
      </section>

      <section className="panel mt-6 overflow-x-auto p-6">
        <div className="eyebrow">Model comparison</div>
        <h3 className="text-lg font-semibold">Trained candidates (test set + 5-fold CV)</h3>
        <table className="mt-4 w-full text-sm">
          <thead className="eyebrow text-left"><tr><th className="py-2">Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>ROC-AUC</th><th>CV AUC</th></tr></thead>
          <tbody className="divide-y divide-border tabular-nums">
            {models.map(([name, m]) => (
              <tr key={name} className={name === metrics.deployed_model ? "font-semibold" : ""}>
                <td className="py-3">{name}{name === metrics.deployed_model && " (deployed)"}</td>
                <td>{m.accuracy}</td><td>{m.precision}</td><td>{m.recall}</td><td>{m.f1}</td><td>{m.roc_auc}</td>
                <td>{m.cv_roc_auc_mean} ± {m.cv_roc_auc_std}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
