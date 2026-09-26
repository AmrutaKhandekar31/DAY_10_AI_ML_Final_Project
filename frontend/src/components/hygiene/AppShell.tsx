import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Activity, BarChart3, Building2, Code2, History, Home, Menu, Plus, ShieldCheck, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/assessment", label: "New Assessment", icon: Plus },
  { to: "/history", label: "Prediction History", icon: History },
  { to: "/facilities", label: "Facilities", icon: Building2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/api-docs", label: "REST API", icon: Code2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight tracking-tight">FacilityRisk AI</div>
            <div className="text-[11px] text-muted-foreground">Hygiene Risk Intelligence</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-secondary data-[status=active]:!bg-primary data-[status=active]:!text-primary-foreground data-[status=active]:shadow-md"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-sidebar-border bg-card p-3">
          <Activity className="size-4 text-success" />
          <div>
            <div className="text-xs font-semibold">Prediction System</div>
            <div className="text-[11px] text-muted-foreground">Model ready for assessment</div>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1 lg:pl-64">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-bold">FacilityRisk AI</span>
        </div>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-8">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

export function RiskBadge({ level }: { level: "High" | "Low" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${level === "High" ? "bg-destructive/12 text-destructive" : "bg-success/15 text-success"}`}
    >
      <span className={`size-1.5 rounded-full ${level === "High" ? "bg-destructive" : "bg-success"}`} />
      {level} risk
    </span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="panel p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
