"use client";

import { useCallback, useEffect, useState } from "react";

type Section =
  | "categories"
  | "packages"
  | "gifts"
  | "memberships"
  | "coupons"
  | "addons"
  | "resources"
  | "classes"
  | "restrictions"
  | "intake"
  | "webhooks"
  | "reports"
  | "import"
  | "theme"
  | "phases"
  | "households";

const SECTION_API: Record<Section, string> = {
  categories: "/api/appointments/service-booking/categories",
  packages: "/api/appointments/service-booking/packages",
  gifts: "/api/appointments/service-booking/gift-certificates",
  memberships: "/api/appointments/service-booking/memberships",
  coupons: "/api/appointments/service-booking/coupons",
  addons: "/api/appointments/service-booking/add-ons",
  resources: "/api/appointments/service-booking/resources",
  classes: "/api/appointments/service-booking/classes",
  restrictions: "/api/appointments/service-booking/client-restrictions",
  intake: "/api/appointments/service-booking/intake-forms",
  webhooks: "/api/appointments/service-booking/webhooks",
  reports: "/api/appointments/service-booking/reports",
  import: "/api/appointments/service-booking/import-export",
  theme: "/api/appointments/service-booking/scheduler-theme",
  phases: "/api/appointments/service-booking/service-phases",
  households: "/api/appointments/service-booking/households",
};

export function ServiceBookingAdminClient({
  initialSection = "packages",
}: {
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [items, setItems] = useState<unknown[]>([]);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SECTION_API[section]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      if (section === "theme") {
        setExtra(json.data || {});
        setItems([]);
      } else if (section === "reports") {
        setExtra(json.data || {});
        setItems([]);
      } else {
        setItems(Array.isArray(json.data) ? json.data : []);
        setExtra({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem() {
    if (!name.trim()) return;
    const body: Record<string, unknown> = { name: name.trim() };
    if (section === "memberships") {
      body.priceCents = 9900;
      body.billingInterval = "month";
    }
    if (section === "gifts") body.fixedAmountCents = 5000;
    const res = await fetch(SECTION_API[section], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "Create failed");
      return;
    }
    setName("");
    await load();
  }

  const nav: Array<{ id: Section; label: string }> = [
    { id: "categories", label: "Categories" },
    { id: "packages", label: "Packages" },
    { id: "gifts", label: "Gift certificates" },
    { id: "memberships", label: "Memberships" },
    { id: "coupons", label: "Coupons" },
    { id: "addons", label: "Add-ons" },
    { id: "resources", label: "Resources" },
    { id: "classes", label: "Classes" },
    { id: "phases", label: "Processing phases" },
    { id: "households", label: "Households" },
    { id: "restrictions", label: "Client restrictions" },
    { id: "intake", label: "Intake forms" },
    { id: "webhooks", label: "Webhooks" },
    { id: "theme", label: "Scheduler branding" },
    { id: "reports", label: "Reports" },
    { id: "import", label: "Import / export" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Service booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Packages, memberships, gift certificates, classes, resources, and Acuity-class commerce.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Service booking sections">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              section === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section !== "reports" && section !== "theme" && section !== "import" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Name</span>
            <input
              className="rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`New ${section} name`}
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => void createItem()}
          >
            Add
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : section === "reports" ? (
        <pre className="overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
          {JSON.stringify(extra, null, 2)}
        </pre>
      ) : section === "theme" ? (
        <pre className="overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
          {JSON.stringify(extra, null, 2)}
        </pre>
      ) : section === "import" ? (
        <div className="flex flex-col gap-3 text-sm">
          <a className="text-primary underline" href="/api/appointments/service-booking/import-export?kind=clients">
            Export clients CSV
          </a>
          <a className="text-primary underline" href="/api/appointments/service-booking/import-export?kind=appointments">
            Export appointments CSV
          </a>
          <a className="text-primary underline" href="/api/appointments/service-booking/reports?format=csv">
            Export reports CSV
          </a>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No items yet.</li>
          ) : (
            items.map((item) => {
              const row = item as { id: string; name?: string; code?: string; slug?: string };
              return (
                <li key={row.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <span className="font-medium">{row.name || row.code || row.slug || row.id}</span>
                  <span className="text-muted-foreground">{row.id}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
