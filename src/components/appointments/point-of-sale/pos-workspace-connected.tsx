"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Receipt, ShoppingCart } from "lucide-react";
import { usePosWorkspace } from "@/features/appointments/kimi/point-of-sale/use-pos-workspace";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const SECTIONS = [
  { id: "sale", label: "Sale" },
  { id: "balances", label: "Open balances" },
  { id: "recent", label: "Recent sales" },
  { id: "refunds", label: "Returns & refunds" },
  { id: "settings", label: "Settings" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
type TabId = "appointments" | "services" | "packages" | "memberships" | "products";

type ContactOption = { id: string; name: string; phone: string; email?: string };

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function ContactSearch({
  selected,
  onSelect,
}: {
  selected: ContactOption | null;
  onSelect: (c: ContactOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(`/api/contacts?take=12&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((json) => {
          setOptions(
            (json.data || []).map(
              (c: { id: string; firstName?: string; lastName?: string; phone: string; email?: string }) => ({
                id: c.id,
                name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
                phone: c.phone,
                email: c.email,
              }),
            ),
          );
        });
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div className="relative text-xs">
      <label className="ws-field-label">Customer</label>
      <input
        className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5"
        value={selected ? selected.name : query}
        onChange={(e) => {
          onSelect(null);
          setQuery(e.target.value);
        }}
        placeholder="Search name, email, or phone"
      />
      {selected ? (
        <button type="button" className="appt-pilot-text-btn mt-1" onClick={() => onSelect(null)}>Change</button>
      ) : null}
      {!selected && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-[var(--surface-muted)]"
                onClick={() => {
                  onSelect(o);
                  setQuery(o.name);
                  setOptions([]);
                }}
              >
                <span className="font-medium">{o.name}</span>
                <span className="block text-[var(--text-secondary)]">{o.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PosWorkspaceConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "sale";
  const pos = usePosWorkspace();
  const [tab, setTab] = useState<TabId>("services");
  const [contact, setContact] = useState<ContactOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "external" | "card">("cash");
  const [success, setSuccess] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/point-of-sale?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const preselectApt = searchParams.get("appointmentId");
  const preselectContact = searchParams.get("contactId");

  useEffect(() => {
    if (preselectContact && !contact) {
      void fetch(`/api/contacts/${preselectContact}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json?.data) return;
          const c = json.data as { id: string; firstName?: string; lastName?: string; phone: string; email?: string };
          setContact({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
            phone: c.phone,
            email: c.email,
          });
        });
    }
  }, [preselectContact, contact]);

  async function ensureSession() {
    if (pos.activeId) return pos.activeId;
    const data = await pos.api({
      action: "create",
      contactId: contact?.id,
    });
    return data?.id as string | undefined;
  }

  async function addBalanceLine(row: {
    appointmentId: string;
    serviceName: string;
    balanceCents: number;
    customer: string;
  }) {
    setSection("sale");
    const sessionId = await ensureSession();
    if (!sessionId) return;
    await pos.api({
      action: "add_line",
      sessionId,
      line: {
        kind: "appointment_balance",
        description: `${row.serviceName} balance — ${row.customer}`,
        unitPriceCents: row.balanceCents,
        quantity: 1,
        referenceId: row.appointmentId,
      },
    });
  }

  useEffect(() => {
    if (!preselectApt || !pos.workspace) return;
    const row = pos.workspace.openBalances.find((b) => b.appointmentId === preselectApt);
    if (row) void addBalanceLine(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectApt, pos.workspace?.openBalances.length]);

  async function addCatalogLine(kind: string, id: string, name: string, priceCents: number) {
    const sessionId = await ensureSession();
    if (!sessionId) return;
    await pos.api({
      action: "add_line",
      sessionId,
      line: { kind, description: name, unitPriceCents: priceCents, quantity: 1, referenceId: id },
    });
  }

  async function checkout() {
    if (!pos.activeId) return;
    if (!contact?.id) {
      pos.setError("Select a customer before checkout.");
      return;
    }
    const key = `pos-${pos.activeId}-${Date.now()}`;
    const data = await pos.api({
      action: "checkout",
      sessionId: pos.activeId,
      contactId: contact.id,
      paymentMethod,
      idempotencyKey: key,
    });
    if (data) {
      setSuccess(`Payment complete — ${money(pos.active?.totalCents || 0)}`);
      pos.setActiveId(null);
    }
  }

  const catalogItems = useMemo(() => {
    if (!pos.workspace) return [];
    const q = catalogQuery.toLowerCase();
    const filter = (name: string) => !q || name.toLowerCase().includes(q);
    if (tab === "services")
      return pos.workspace.catalog.services.filter((s) => filter(s.name)).map((s) => ({
        kind: "service",
        ...s,
      }));
    if (tab === "packages")
      return pos.workspace.catalog.packages.filter((s) => filter(s.name)).map((s) => ({
        kind: "package",
        ...s,
      }));
    if (tab === "memberships")
      return pos.workspace.catalog.memberships.filter((s) => filter(s.name)).map((s) => ({
        kind: "membership",
        ...s,
      }));
    if (tab === "products")
      return pos.workspace.catalog.products.filter((s) => filter(s.name)).map((s) => ({
        kind: "product",
        ...s,
      }));
    return pos.workspace.openBalances
      .filter((b) => filter(b.serviceName) || filter(b.customer))
      .map((b) => ({
        kind: "appointment_balance" as const,
        id: b.appointmentId,
        name: `${b.serviceName} — ${money(b.balanceCents)} due`,
        balanceRow: b,
      }));
  }, [pos.workspace, tab, catalogQuery]);

  if (pos.loading) {
    return <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>Loading…</div>;
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="ws-icon-tile mt-0.5"><CreditCard className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">Point of Sale</h1>
                <p className="ws-event-subtitle">
                  Take payments, sell packages and memberships, and collect appointment balances.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="appt-pilot-secondary-btn text-xs"
              disabled={pos.busy}
              onClick={() => {
                pos.setActiveId(null);
                setSuccess("");
              }}
            >
              New sale
            </button>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  section === s.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        {(pos.error || success) && (
          <p className={`mx-4 mt-2 rounded-md px-3 py-2 text-xs lg:mx-6 ${success ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {success || pos.error}
          </p>
        )}

        {section === "sale" && (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
            <div className="border-b border-[var(--border)] p-4 lg:border-b-0 lg:border-r lg:px-6">
              <ContactSearch selected={contact} onSelect={setContact} />
              <div className="mt-4 flex flex-wrap gap-1">
                {(
                  [
                    ["appointments", "Appointments"],
                    ["services", "Services"],
                    ["packages", "Packages"],
                    ["memberships", "Memberships"],
                    ...(pos.workspace?.catalog.products.length ? [["products", "Products"]] : []),
                  ] as Array<[TabId, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded-md px-2.5 py-1 text-xs ${tab === id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)] border border-[var(--border)]"}`}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="mt-3 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-xs"
                placeholder="Search catalog…"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
              />
              <ul className="mt-3 divide-y divide-[var(--border)] text-xs">
                {catalogItems.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 font-medium">{item.name}</span>
                    {"priceCents" in item && item.priceCents != null ? (
                      <span className="tabular-nums text-[var(--text-secondary)]">{money(item.priceCents)}</span>
                    ) : null}
                    <button
                      type="button"
                      className="appt-pilot-text-btn shrink-0"
                      disabled={pos.busy}
                      onClick={() => {
                        if (item.kind === "appointment_balance" && "balanceRow" in item) {
                          void addBalanceLine(item.balanceRow);
                        } else if ("priceCents" in item) {
                          void addCatalogLine(item.kind, item.id, item.name, item.priceCents);
                        }
                      }}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="sticky top-0 self-start bg-[var(--surface)] p-4 lg:px-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--text-secondary)]">
                <ShoppingCart className="h-4 w-4" /> Cart
              </div>
              {contact ? (
                <p className="mt-2 text-sm font-medium">{contact.name}</p>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">No customer selected</p>
              )}
              <ul className="mt-3 divide-y divide-[var(--border)] text-xs">
                {(pos.active?.lineItems || []).map((line) => (
                  <li key={line.id} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0">{line.description}</span>
                    <span className="tabular-nums">{money(line.totalCents)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1 border-t border-[var(--border)] pt-3 text-xs">
                <div className="flex justify-between font-semibold text-base">
                  <dt>Total</dt>
                  <dd>{money(pos.active?.totalCents || 0)}</dd>
                </div>
              </dl>
              <fieldset className="mt-4 space-y-1 text-xs">
                <legend className="ws-field-label">Payment method</legend>
                {(["cash", "external", "card"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pay"
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />
                    {m === "card" ? "Card (online Stripe)" : m === "cash" ? "Cash" : "External / manual"}
                  </label>
                ))}
              </fieldset>
              {paymentMethod === "card" && !pos.workspace?.merchant?.canAcceptPayments ? (
                <p className="mt-2 text-xs text-amber-700">
                  Stripe setup incomplete.{" "}
                  <Link href="/appointments/pricing-payments" className="underline">Manage payment provider</Link>
                </p>
              ) : null}
              <button
                type="button"
                className="appt-pilot-primary-btn mt-4 w-full"
                disabled={pos.busy || !pos.active?.lineItems.length}
                onClick={() => void checkout()}
              >
                {pos.busy ? "Processing…" : "Take payment"}
              </button>
            </aside>
          </div>
        )}

        {section === "balances" && pos.workspace && (
          <div className="overflow-x-auto p-4 lg:px-6">
            <table className="w-full min-w-[800px] text-xs">
              <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-2 text-left">Customer</th>
                  <th>Appointment</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pos.workspace.openBalances.map((row) => (
                  <tr key={row.appointmentId} className="border-b border-[var(--border)]">
                    <td className="py-2">{row.customer}</td>
                    <td>{row.serviceName} · {new Date(row.startsAt).toLocaleString()}</td>
                    <td className="tabular-nums">{money(row.totalCents)}</td>
                    <td className="tabular-nums">{money(row.paidCents)}</td>
                    <td className="tabular-nums font-medium">{money(row.balanceCents)}</td>
                    <td>
                      <button type="button" className="appt-pilot-text-btn" onClick={() => void addBalanceLine(row)}>
                        Collect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === "recent" && pos.workspace && (
          <div className="p-4 lg:px-6 text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-[var(--text-secondary)]">
                  <th className="py-2 text-left">Time</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pos.workspace.recentSales.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="py-2">{new Date(s.at).toLocaleString()}</td>
                    <td>{s.itemCount}</td>
                    <td className="tabular-nums">{money(s.totalCents)}</td>
                    <td>
                      <Link href="/payments/transactions" className="appt-pilot-text-btn inline-flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> Transactions
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === "refunds" && (
          <div className="p-6 text-sm text-[var(--text-secondary)]">
            Refunds use canonical merchant payment records.{" "}
            <Link href="/payments/transactions" className="text-[var(--accent)]">Open Transactions</Link> to issue refunds.
          </div>
        )}

        {section === "settings" && (
          <div className="space-y-2 p-6 text-xs text-[var(--text-secondary)]">
            <p>Commerce defaults live in <Link href="/appointments/pricing-payments" className="text-[var(--accent)]">Pricing &amp; Payments</Link>.</p>
            <p>Card-present terminals: N/A (online card-not-present only).</p>
          </div>
        )}
      </div>
    </div>
  );
}
