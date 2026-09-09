"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { PilotInput, PilotLabel } from "@/components/appointments/meetings/meeting-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Segment = "gift-cards" | "products" | "discounts";

const CONFIG: Record<
  Segment,
  { title: string; api: string; empty: string; createLabel: string; nameField: string; buildBody: (name: string) => Record<string, unknown> }
> = {
  "gift-cards": {
    title: "Gift Cards",
    api: "/api/appointments/service-booking/gift-certificates",
    empty: "Create gift card offerings customers can purchase.",
    createLabel: "Create gift card",
    nameField: "name",
    buildBody: (name) => ({ name, fixedAmountCents: 5000 }),
  },
  products: {
    title: "Products",
    api: "/api/appointments/service-booking/products",
    empty: "Add retail products you can sell online or at checkout.",
    createLabel: "Add product",
    nameField: "name",
    buildBody: (name) => ({ name, priceCents: 2500 }),
  },
  discounts: {
    title: "Discounts",
    api: "/api/appointments/service-booking/coupons",
    empty: "Create coupon codes for bookings and purchases.",
    createLabel: "Create discount",
    nameField: "code",
    buildBody: (name) => ({
      code: name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || `SAVE${Date.now().toString().slice(-4)}`,
      discountType: "percent",
      discountValue: 10,
    }),
  },
};

export function SimpleCommerceListConnected({ segment }: { segment: Segment }) {
  const cfg = CONFIG[segment];
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(cfg.api);
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setRows((json.data || json || []) as Array<Record<string, unknown>>);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cfg.api]);

  useEffect(() => {
    void load();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("create") === "1") {
      setCreateOpen(true);
    }
  }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch(cfg.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg.buildBody(newName.trim())),
    });
    setSaving(false);
    setCreateOpen(false);
    setNewName("");
    await load();
  };

  const rowLabel = (row: Record<string, unknown>) =>
    String(row.name || row.code || row.id || "");

  if (loading) {
    return <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse"><div className="h-8 w-48 rounded bg-gray-200" /></div>;
  }

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/products-offers" className="appt-pilot-back-link"><ArrowLeft size={14} aria-hidden /> Products & Offers</Link>
      <RefDecoPageHeader
        title={cfg.title}
        description={cfg.empty}
        action={
          <button type="button" className="appt-pilot-primary-btn" onClick={() => setCreateOpen(true)}>
            <Plus size={15} aria-hidden /> {cfg.createLabel}
          </button>
        }
      />
      {failed ? (
        <p className="mt-6 flex items-center gap-2 text-[var(--state-error)]"><AlertTriangle size={16} /> Could not load</p>
      ) : rows.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <p className="appt-pilot-text-body">{cfg.empty}</p>
          <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => setCreateOpen(true)}>{cfg.createLabel}</button>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <table className="appt-pilot-data-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>{rowLabel(row)}</td>
                  <td>{row.active === false ? "Inactive" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 className="appt-pilot-text-section">{cfg.createLabel}</h2>
            <div className="mt-4">
              <PilotLabel>{segment === "discounts" ? "Discount code" : "Name"}</PilotLabel>
              <PilotInput value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            {segment === "discounts" ? (
              <p className="mt-2 appt-pilot-text-helper">Default: 10% off. Edit in Commerce transitional tools for advanced settings.</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void create()}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
