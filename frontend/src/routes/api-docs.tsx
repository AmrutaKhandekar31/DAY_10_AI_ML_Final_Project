import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/hygiene/AppShell";
import { DEFAULT_INPUT } from "@/lib/risk-model";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "REST API — FacilityRisk AI" },
      { name: "description", content: "Use the hygiene risk prediction REST API and try it live." },
      { property: "og:title", content: "REST API — FacilityRisk AI" },
      { property: "og:description", content: "Use the hygiene risk prediction REST API and try it live." },
    ],
  }),
  component: ApiDocsPage,
});

const sampleBody = JSON.stringify({ facility_type: "Restaurant", inputs: DEFAULT_INPUT }, null, 2);

function ApiDocsPage() {
  const [body, setBody] = useState(sampleBody);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function tryIt() {
    setLoading(true);
    try {
      const res = await fetch("/api/public/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      setResponse(`HTTP ${res.status}\n${JSON.stringify(await res.json(), null, 2)}`);
    } catch (err) {
      setResponse(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Bonus" title="REST API" description="Predictions exposed through a public JSON endpoint." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-6 text-sm">
          <div><span className="rounded bg-primary px-2 py-0.5 font-mono text-xs text-primary-foreground">POST</span> <code className="font-mono">/api/public/predict</code></div>
          <p className="text-muted-foreground">Returns the risk level, probability, confidence and top factors. Invalid input returns <code>422</code> with details. <code>GET</code> on the same URL lists required features.</p>
          <label className="block space-y-1.5">
            <span className="eyebrow">Request body</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="input-field font-mono text-xs" />
          </label>
          <button onClick={tryIt} disabled={loading} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "Sending…" : "Send request"}
          </button>
        </div>
        <div className="panel p-6">
          <div className="eyebrow mb-2">Response</div>
          <pre className="min-h-64 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs">{response || "Send a request to see the response."}</pre>
        </div>
      </div>
    </>
  );
}
