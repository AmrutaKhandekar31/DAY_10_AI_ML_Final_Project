import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { PageHeader, RiskBadge } from "@/components/hygiene/AppShell";
import {
  createFacility,
  deleteFacility,
  facilitiesQuery,
  predictionsQuery,
} from "@/lib/hygiene.functions";
import { FACILITY_TYPES, type FacilityType } from "@/lib/risk-model";

export const Route = createFileRoute("/facilities")({
  head: () => ({
    meta: [
      { title: "Facilities — FacilityRisk AI" },
      {
        name: "description",
        content: "Registered facilities and their latest hygiene risk.",
      },
      { property: "og:title", content: "Facilities — FacilityRisk AI" },
      {
        property: "og:description",
        content: "Registered facilities and their latest hygiene risk.",
      },
    ],
  }),

  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(facilitiesQuery),
      context.queryClient.ensureQueryData(predictionsQuery),
    ]),

  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { data: facilities } = useSuspenseQuery(facilitiesQuery);
  const { data: predictions } = useSuspenseQuery(predictionsQuery);

  const queryClient = useQueryClient();

  const create = useServerFn(createFacility);
  const remove = useServerFn(deleteFacility);

  const [form, setForm] = useState({
    name: "",
    facility_type: "Restaurant" as FacilityType,
    location: "",
  });

  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (form.name.trim().length < 2) {
      return setError("Name must be at least 2 characters");
    }

    setError("");

    try {
      await create({ data: form });

      await queryClient.invalidateQueries({
        queryKey: ["facilities"],
      });

      setForm({
        name: "",
        facility_type: "Restaurant",
        location: "",
      });

      toast.success("Facility added");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not add facility",
      );
    }
  }

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete "${name}"?\n\nThis will also delete all assessments for this facility.`,
    );

    if (!confirmed) return;

    try {
      await remove({
        data: { id },
      });

      await queryClient.invalidateQueries({
        queryKey: ["facilities"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["predictions"],
      });

      toast.success("Facility deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete facility",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Facilities"
        description="Facilities registered for hygiene monitoring."
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="panel mb-6 grid gap-3 p-6 sm:grid-cols-4"
      >
        <div className="sm:col-span-1">
          <input
            placeholder="Facility name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            className="input-field"
          />

          {error && (
            <span className="mt-1 block text-xs text-destructive">
              {error}
            </span>
          )}
        </div>

        <select
          value={form.facility_type}
          onChange={(e) =>
            setForm({
              ...form,
              facility_type: e.target.value as FacilityType,
            })
          }
          className="input-field"
        >
          {FACILITY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) =>
            setForm({
              ...form,
              location: e.target.value,
            })
          }
          className="input-field"
        />

        <button className="rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground">
          Add facility
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {facilities.map((f) => {
          const latest = predictions.find(
            (p) => p.facility_id === f.id,
          );

          const count = predictions.filter(
            (p) => p.facility_id === f.id,
          ).length;

          return (
            <div key={f.id} className="panel p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Building2 className="size-5" />
                </span>

                <div className="flex-1">
                  <div className="font-semibold">{f.name}</div>

                  <div className="text-xs text-muted-foreground">
                    {f.facility_type} · {f.location || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {count} assessment{count === 1 ? "" : "s"}
                </span>

                <div className="flex items-center gap-2">
                  {latest ? (
                    <RiskBadge level={latest.risk_level} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Not assessed
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(f.id, f.name)}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}