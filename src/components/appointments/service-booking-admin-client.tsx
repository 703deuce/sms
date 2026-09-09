"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntakeField, IntakeFieldType } from "@/lib/appointments/service-booking/types";
import { createId } from "@/lib/supabase/id";

type Section =
  | "categories"
  | "packages"
  | "gifts"
  | "memberships"
  | "coupons"
  | "addons"
  | "resources"
  | "classes"
  | "programs"
  | "paymentPlans"
  | "restrictions"
  | "intake"
  | "webhooks"
  | "reports"
  | "import"
  | "theme"
  | "phases"
  | "households"
  | "invoices"
  | "dynamicPricing"
  | "loyalty"
  | "seatMaps";

const SECTION_API: Record<Section, string> = {
  categories: "/api/appointments/service-booking/categories",
  packages: "/api/appointments/service-booking/packages",
  gifts: "/api/appointments/service-booking/gift-certificates",
  memberships: "/api/appointments/service-booking/memberships",
  coupons: "/api/appointments/service-booking/coupons",
  addons: "/api/appointments/service-booking/add-ons",
  resources: "/api/appointments/service-booking/resources",
  classes: "/api/appointments/service-booking/classes",
  programs: "/api/appointments/service-booking/programs",
  paymentPlans: "/api/appointments/service-booking/payment-plans",
  restrictions: "/api/appointments/service-booking/client-restrictions",
  intake: "/api/appointments/service-booking/intake-forms",
  webhooks: "/api/appointments/service-booking/webhooks",
  reports: "/api/appointments/service-booking/reports",
  import: "/api/appointments/service-booking/import-export",
  theme: "/api/appointments/service-booking/scheduler-theme",
  phases: "/api/appointments/service-booking/service-phases",
  households: "/api/appointments/service-booking/households",
  invoices: "/api/appointments/service-booking/invoices",
  dynamicPricing: "/api/appointments/service-booking/dynamic-pricing",
  loyalty: "/api/appointments/service-booking/loyalty",
  seatMaps: "/api/appointments/service-booking/seat-selection",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildCreateBody(section: Section, name: string): Record<string, unknown> {
  const trimmed = name.trim();
  const body: Record<string, unknown> = { name: trimmed };

  if (section === "memberships") {
    body.priceCents = 9900;
    body.billingInterval = "month";
  }
  if (section === "programs") {
    body.priceCents = 49900;
    body.currency = "usd";
    body.steps = [];
  }
  if (section === "paymentPlans") {
    body.totalCents = 49900;
    body.currency = "usd";
    body.installments = [
      { id: "i1", label: "Deposit", amountCents: 19900, dueDaysFromStart: 0 },
      { id: "i2", label: "Balance", amountCents: 30000, dueDaysFromStart: 30 },
    ];
  }
  if (section === "gifts") body.fixedAmountCents = 5000;
  if (section === "coupons") {
    body.code = slugify(trimmed).replace(/-/g, "").slice(0, 20).toUpperCase() || `UAT${Date.now().toString().slice(-6)}`;
    body.discountType = "percent";
    body.discountValue = 10;
  }
  if (section === "phases") {
    body.phaseKind = "active_staff";
    body.durationMinutes = 30;
  }
  if (section === "restrictions") {
    body.reason = trimmed;
    body.phone = `+1555${Date.now().toString().slice(-7)}`;
    body.blockPublicBooking = true;
  }
  if (section === "households") {
    body.action = "create_named";
  }
  if (section === "categories") {
    body.displayOrder = 0;
    body.collapsible = true;
    body.collapsedByDefault = false;
  }

  return body;
}

function rowLabel(item: Record<string, unknown>): string {
  return (
    String(item.name || item.code || item.reason || item.slug || item.id || "")
  );
}

export function ServiceBookingAdminClient({
  initialSection = "packages",
  title = "Service booking",
}: {
  initialSection?: Section;
  title?: string;
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
        const data = (json.data || {}) as { theme?: Record<string, unknown>; links?: Record<string, unknown> };
        setExtra({
          ...(data.theme && typeof data.theme === "object" ? data.theme : {}),
          links: data.links,
        });
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
    setError(null);
    const body = buildCreateBody(section, name);
    const res = await fetch(SECTION_API[section], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    const created = json.data;
    if (created && typeof created === "object") {
      setItems((prev) => {
        const row = created as { id?: string };
        if (row.id && prev.some((item) => (item as { id?: string }).id === row.id)) return prev;
        return [created, ...prev];
      });
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
    { id: "dynamicPricing", label: "Dynamic pricing" },
    { id: "loyalty", label: "Loyalty" },
    { id: "addons", label: "Add-ons" },
    { id: "resources", label: "Resources" },
    { id: "classes", label: "Classes" },
    { id: "seatMaps", label: "Seat maps" },
    { id: "programs", label: "Programs" },
    { id: "paymentPlans", label: "Payment plans" },
    { id: "phases", label: "Processing phases" },
    { id: "households", label: "Households" },
    { id: "restrictions", label: "Client restrictions" },
    { id: "intake", label: "Intake forms" },
    { id: "webhooks", label: "Webhooks" },
    { id: "theme", label: "Scheduler branding" },
    { id: "reports", label: "Reports" },
    { id: "import", label: "Import / export" },
    { id: "invoices", label: "Invoices" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
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

      {section !== "reports" &&
        section !== "theme" &&
        section !== "import" &&
        section !== "invoices" &&
        section !== "webhooks" &&
        section !== "households" &&
        section !== "dynamicPricing" &&
        section !== "loyalty" &&
        section !== "seatMaps" && (
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
        <ThemeEditor extra={extra} onSaved={() => void load()} />
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
      ) : section === "intake" ? (
        <IntakeFormsPanel items={items} onReload={() => void load()} />
      ) : section === "resources" ? (
        <ResourcesPanel items={items} onReload={() => void load()} />
      ) : section === "invoices" ? (
        <InvoicesPanel items={items} onReload={() => void load()} />
      ) : section === "webhooks" ? (
        <WebhooksPanel items={items} onReload={() => void load()} />
      ) : section === "households" ? (
        <HouseholdsPanel items={items} onReload={() => void load()} />
      ) : section === "dynamicPricing" ? (
        <DynamicPricingPanel items={items} onReload={() => void load()} />
      ) : section === "loyalty" ? (
        <LoyaltyPanel items={items} onReload={() => void load()} />
      ) : section === "seatMaps" ? (
        <SeatMapsPanel items={items} onReload={() => void load()} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No items yet.</li>
          ) : (
            items.map((item) => {
              const row = item as Record<string, unknown> & { id: string };
              return (
                <li key={row.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <span className="font-medium">{rowLabel(row)}</span>
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

const INTAKE_FIELD_TYPES: Array<{ value: IntakeFieldType; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Dropdown" },
  { value: "file", label: "File upload" },
  { value: "image", label: "Image upload" },
  { value: "signature", label: "Signature" },
  { value: "agreement", label: "Agreement" },
];

function IntakeFormsPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const forms = items as Array<{ id: string; name: string; fields?: IntakeField[] }>;
  const [selectedId, setSelectedId] = useState<string | null>(forms[0]?.id ?? null);
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = forms.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    setFields(selected?.fields || []);
  }, [selected]);

  function addField(type: IntakeFieldType) {
    setFields((prev) => [
      ...prev,
      {
        id: createId(),
        label: type === "file" ? "Upload a file" : type === "image" ? "Upload an image" : "New question",
        type,
        required: false,
      },
    ]);
  }

  async function saveFields() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(SECTION_API.intake, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, name: selected.name, fields }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Saved");
    onReload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ul className="divide-y rounded-lg border">
        {forms.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No intake forms yet.</li>
        ) : (
          forms.map((form) => (
            <li key={form.id}>
              <button
                type="button"
                className={`w-full p-4 text-left text-sm ${selectedId === form.id ? "bg-muted font-medium" : ""}`}
                onClick={() => setSelectedId(form.id)}
              >
                {form.name}
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{selected.name}</h2>
            <div className="flex flex-wrap gap-2">
              {INTAKE_FIELD_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => addField(type.value)}
                >
                  + {type.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-3">
            {fields.length === 0 ? (
              <li className="text-sm text-muted-foreground">Add fields including file or image upload types.</li>
            ) : (
              fields.map((field, index) => (
                <li key={field.id} className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_160px_auto]">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Label</span>
                    <input
                      className="rounded border px-3 py-2"
                      value={field.label}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)),
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Type</span>
                    <select
                      className="rounded border px-3 py-2"
                      value={field.type}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f, i) =>
                            i === index ? { ...f, type: e.target.value as IntakeFieldType } : f,
                          ),
                        )
                      }
                    >
                      {INTAKE_FIELD_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required === true}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, required: e.target.checked } : f)),
                        )
                      }
                    />
                    Required
                  </label>
                </li>
              ))
            )}
          </ul>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveFields()}
            >
              {saving ? "Saving…" : "Save fields"}
            </button>
            {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-sm text-muted-foreground">Select a form to edit fields.</div>
      )}
    </div>
  );
}

type ResourceRow = {
  id: string;
  name: string;
  quantity?: number;
  description?: string | null;
  active?: boolean;
};

function ResourcesPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const resources = items as ResourceRow[];
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const row of resources) next[row.id] = row.quantity ?? 1;
    setDrafts(next);
  }, [resources]);

  async function saveQuantity(row: ResourceRow) {
    const quantity = drafts[row.id] ?? row.quantity ?? 1;
    setSavingId(row.id);
    setMessage(null);
    const res = await fetch(SECTION_API.resources, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, name: row.name, quantity, active: row.active ?? true }),
    });
    setSavingId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Could not save resource");
      return;
    }
    setMessage(`Saved ${row.name}`);
    onReload();
  }

  if (resources.length === 0) {
    return <p className="text-sm text-muted-foreground">No resources yet. Add one above.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {resources.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span>Qty</span>
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded border px-2 py-1"
                  value={drafts[row.id] ?? row.quantity ?? 1}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [row.id]: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              </label>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                disabled={savingId === row.id}
                onClick={() => void saveQuantity(row)}
              >
                {savingId === row.id ? "Saving…" : "Save"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

type InvoiceRow = {
  id: string;
  status: string;
  totalCents: number;
  balanceDueCents: number;
  contactId: string;
  createdAt: string;
};

function InvoicesPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const invoices = items as InvoiceRow[];
  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("50");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPayUrl, setLastPayUrl] = useState<string | null>(null);

  async function createInvoice() {
    if (!contactId.trim() || !description.trim()) {
      setMessage("Contact ID and description are required.");
      return;
    }
    const unitPriceCents = Math.round(Number(amountDollars) * 100);
    if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }
    setCreating(true);
    setMessage(null);
    setLastPayUrl(null);
    const res = await fetch(SECTION_API.invoices, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: contactId.trim(),
        lineItems: [{ description: description.trim(), quantity: 1, unitPriceCents }],
      }),
    });
    const json = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setMessage(json.error || "Could not create invoice");
      return;
    }
    const payToken = json.data?.payToken as string | undefined;
    if (payToken) {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      setLastPayUrl(`${base}/pay/invoice/${payToken}`);
    }
    setMessage("Invoice created.");
    setDescription("");
    onReload();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        For the full invoices workspace, open{" "}
        <a href="/payments/invoices" className="text-primary underline">Payments → Invoices</a>.
      </p>
      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>Contact ID</span>
          <input
            className="rounded border px-3 py-2"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="contact_…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Description</span>
          <input
            className="rounded border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Service balance"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Amount (USD)</span>
          <input
            className="rounded border px-3 py-2"
            type="number"
            min={0}
            step="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={creating}
            onClick={() => void createInvoice()}
          >
            {creating ? "Creating…" : "Create invoice"}
          </button>
        </div>
        {message ? <p className="text-sm text-muted-foreground sm:col-span-2">{message}</p> : null}
        {lastPayUrl ? (
          <p className="text-sm sm:col-span-2">
            Pay link:{" "}
            <a className="text-primary underline break-all" href={lastPayUrl}>{lastPayUrl}</a>
          </p>
        ) : null}
      </div>
      <ul className="divide-y rounded-lg border">
        {invoices.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No invoices yet.</li>
        ) : (
          invoices.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{row.id}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status} · contact {row.contactId}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Total ${(row.totalCents / 100).toFixed(2)}</p>
                <p>Due ${(row.balanceDueCents / 100).toFixed(2)}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function WebhooksPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const [url, setUrl] = useState("https://");
  const [events, setEvents] = useState("appointment.created,appointment.canceled");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    if (!url.trim()) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/appointments/service-booking/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        events: events.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || "Create failed");
      return;
    }
    setMessage(json.data?.signingSecret ? "Created — copy signing secret from server response." : "Created");
    onReload();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>Endpoint URL</span>
        <input className="rounded border px-3 py-2" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Events (comma-separated)</span>
        <input className="rounded border px-3 py-2" value={events} onChange={(e) => setEvents(e.target.value)} />
      </label>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={saving}
        onClick={() => void create()}
      >
        {saving ? "Saving…" : "Add webhook"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No webhooks yet.</li>
        ) : (
          items.map((item) => {
            const row = item as Record<string, unknown> & { id: string; url?: string; events?: string[] };
            return (
              <li key={row.id} className="p-4 text-sm">
                <div className="font-medium">{row.url}</div>
                <div className="text-muted-foreground">{Array.isArray(row.events) ? row.events.join(", ") : ""}</div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function HouseholdsPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const [householdName, setHouseholdName] = useState("");
  const [memberHouseholdId, setMemberHouseholdId] = useState("");
  const [memberContactId, setMemberContactId] = useState("");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createHousehold() {
    if (!householdName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_named", name: householdName.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Create failed");
      return;
    }
    setHouseholdName("");
    setMessage("Household created");
    onReload();
  }

  async function addMember() {
    if (!memberHouseholdId || !memberContactId) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_member",
        householdId: memberHouseholdId,
        contactId: memberContactId,
        displayName: memberDisplayName.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Add member failed");
      return;
    }
    setMemberContactId("");
    setMemberDisplayName("");
    setMessage("Member added");
    onReload();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Create household</h3>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Household name" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={saving} onClick={() => void createHousehold()}>Create</button>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Add member</h3>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Household ID" value={memberHouseholdId} onChange={(e) => setMemberHouseholdId(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Contact ID" value={memberContactId} onChange={(e) => setMemberContactId(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Display name (optional)" value={memberDisplayName} onChange={(e) => setMemberDisplayName(e.target.value)} />
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={saving} onClick={() => void addMember()}>Add member</button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No households yet.</li>
        ) : (
          items.map((item) => {
            const row = item as Record<string, unknown> & { id: string; name?: string; members?: unknown[] };
            return (
              <li key={row.id} className="p-4 text-sm">
                <div className="font-medium">{row.name || row.id}</div>
                <div className="text-muted-foreground">{Array.isArray(row.members) ? `${row.members.length} member(s)` : ""}</div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function DynamicPricingPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("last_minute");
  const [adjustmentType, setAdjustmentType] = useState<"percent" | "fixed">("percent");
  const [adjustmentValue, setAdjustmentValue] = useState(10);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ruleName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/dynamic-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ruleName.trim(),
        ruleType,
        adjustmentType,
        adjustmentValue,
        conditions: ruleType === "last_minute" ? { maxHoursAhead: 24 } : {},
      }),
    });
    setSaving(false);
    if (res.ok) {
      setRuleName("");
      onReload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>Rule name</span>
          <input className="rounded border px-3 py-2" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Rule type</span>
          <select className="rounded border px-3 py-2" value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
            <option value="last_minute">Last-minute (within 24h)</option>
            <option value="off_peak">Off-peak</option>
            <option value="peak">Peak</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Adjustment</span>
          <div className="flex gap-2">
            <select className="rounded border px-2 py-2" value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as "percent" | "fixed")}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed cents</option>
            </select>
            <input type="number" className="flex-1 rounded border px-3 py-2" value={adjustmentValue} onChange={(e) => setAdjustmentValue(Number(e.target.value))} />
          </div>
        </label>
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2" disabled={saving} onClick={() => void save()}>Add rule</button>
      </div>
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No pricing rules yet.</li>
        ) : (
          items.map((item) => {
            const row = item as Record<string, unknown> & { id: string; name?: string; ruleType?: string; adjustmentType?: string; adjustmentValue?: number };
            return (
              <li key={row.id} className="flex justify-between gap-4 p-4 text-sm">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">{row.ruleType} · {row.adjustmentType} {row.adjustmentValue}</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function LoyaltyPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const [programName, setProgramName] = useState("");
  const [pointsPerDollar, setPointsPerDollar] = useState(1);
  const [redeemRateCents, setRedeemRateCents] = useState(100);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!programName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: programName.trim(), pointsPerDollar, redeemRateCents }),
    });
    setSaving(false);
    if (res.ok) {
      setProgramName("");
      onReload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span>Program name</span>
          <input className="rounded border px-3 py-2" value={programName} onChange={(e) => setProgramName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Points per dollar</span>
          <input type="number" className="rounded border px-3 py-2" value={pointsPerDollar} onChange={(e) => setPointsPerDollar(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>Redeem rate (cents per point)</span>
          <input type="number" className="rounded border px-3 py-2" value={redeemRateCents} onChange={(e) => setRedeemRateCents(Number(e.target.value))} />
        </label>
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-3" disabled={saving} onClick={() => void save()}>Add program</button>
      </div>
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No loyalty programs yet.</li>
        ) : (
          items.map((item) => {
            const row = item as Record<string, unknown> & { id: string; name?: string; pointsPerDollar?: number };
            return (
              <li key={row.id} className="flex justify-between gap-4 p-4 text-sm">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">{row.pointsPerDollar} pts/$</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function SeatMapsPanel({
  items,
  onReload,
}: {
  items: unknown[];
  onReload: () => void;
}) {
  const [mapName, setMapName] = useState("");
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(6);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!mapName.trim()) return;
    setSaving(true);
    const seats = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        seats.push({ id: `r${r}c${c}`, label: `${r + 1}-${c + 1}`, row: r, col: c });
      }
    }
    const res = await fetch("/api/appointments/service-booking/seat-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mapName.trim(), seats, layout: { rows, cols } }),
    });
    setSaving(false);
    if (res.ok) {
      setMapName("");
      onReload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span>Map name</span>
          <input className="rounded border px-3 py-2" value={mapName} onChange={(e) => setMapName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Rows</span>
          <input type="number" min={1} className="rounded border px-3 py-2" value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Columns</span>
          <input type="number" min={1} className="rounded border px-3 py-2" value={cols} onChange={(e) => setCols(Number(e.target.value))} />
        </label>
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-3" disabled={saving} onClick={() => void save()}>Create seat map</button>
      </div>
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No seat maps yet.</li>
        ) : (
          items.map((item) => {
            const row = item as Record<string, unknown> & { id: string; name?: string };
            return (
              <li key={row.id} className="p-4 text-sm font-medium">{row.name || row.id}</li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ThemeEditor({
  extra,
  onSaved,
}: {
  extra: Record<string, unknown>;
  onSaved: () => void;
}) {
  const terminology = (extra.terminology || {}) as Record<string, string>;
  const [primaryColor, setPrimaryColor] = useState(String(extra.primaryColor || "#5b4bff"));
  const [logoUrl, setLogoUrl] = useState(String(extra.logoUrl || ""));
  const [noIndex, setNoIndex] = useState(extra.noIndex === true);
  const [customDomain, setCustomDomain] = useState(String(extra.customDomain || ""));
  const [customCss, setCustomCss] = useState(String(extra.customCss || ""));
  const [serviceLabel, setServiceLabel] = useState(String(terminology.serviceLabel || "Service"));
  const [staffLabel, setStaffLabel] = useState(String(terminology.staffLabel || "Staff member"));
  const [bookButtonLabel, setBookButtonLabel] = useState(String(terminology.bookButtonLabel || "Book now"));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = (extra.terminology || {}) as Record<string, string>;
    setPrimaryColor(String(extra.primaryColor || "#5b4bff"));
    setLogoUrl(String(extra.logoUrl || ""));
    setNoIndex(extra.noIndex === true);
    setCustomDomain(String(extra.customDomain || ""));
    setCustomCss(String(extra.customCss || ""));
    setServiceLabel(String(t.serviceLabel || "Service"));
    setStaffLabel(String(t.staffLabel || "Staff member"));
    setBookButtonLabel(String(t.bookButtonLabel || "Book now"));
  }, [extra]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(SECTION_API.theme, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryColor,
        logoUrl: logoUrl || undefined,
        noIndex,
        customDomain: customDomain.trim() || undefined,
        customCss: customCss.trim() || undefined,
        terminology: {
          serviceLabel: serviceLabel.trim() || undefined,
          staffLabel: staffLabel.trim() || undefined,
          bookButtonLabel: bookButtonLabel.trim() || undefined,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Saved");
    onSaved();
  }

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Branding</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span>Primary color</span>
          <input className="rounded border px-3 py-2" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Logo URL</span>
          <input className="rounded border px-3 py-2" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
          Hide booking page from search engines (noindex)
        </label>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold">Customer-facing terminology</h3>
        <p className="text-xs text-muted-foreground">
          Preview: &ldquo;{bookButtonLabel} a {serviceLabel.toLowerCase()} with a {staffLabel.toLowerCase()}&rdquo;
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Booking type label</span>
          <input className="rounded border px-3 py-2" value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Staff label</span>
          <input className="rounded border px-3 py-2" value={staffLabel} onChange={(e) => setStaffLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Book action label</span>
          <input className="rounded border px-3 py-2" value={bookButtonLabel} onChange={(e) => setBookButtonLabel(e.target.value)} />
        </label>
      </div>

      <div className="space-y-3 border-t pt-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Custom domain</span>
          <input
            className="rounded border px-3 py-2"
            placeholder="book.example.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Point a CNAME to your Transovo booking host, then save the domain here.
          </span>
        </label>
      </div>

      <div className="border-t pt-4">
        <button
          type="button"
          className="text-sm font-medium text-foreground underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide advanced customization" : "Advanced customization"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Custom CSS</span>
              <textarea
                className="rounded border px-3 py-2 font-mono text-xs min-h-[120px]"
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder=".booking-header { ... }"
              />
            </label>
            <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">
              Invalid CSS can affect how your booking page appears. Clear the field to reset.
            </p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save appearance"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
