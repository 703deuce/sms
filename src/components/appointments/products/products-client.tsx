"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommerceEmptyState } from "@/components/appointments/commerce/commerce-empty-state";
import { formatMoney } from "@/components/appointments/commerce/commerce-utils";

const API = "/api/appointments/service-booking/products";

type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  sku?: string | null;
  sellStandalone?: boolean;
  active: boolean;
};

export function ProductsClient() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = products.find((p) => p.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API);
    const json = await res.json();
    const rows = (json.data || []) as ProductRow[];
    setProducts(rows);
    if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected]);

  async function createProduct() {
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New product", priceCents: 1500, active: false, sellStandalone: true }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    await load();
    setSelectedId((json.data as ProductRow).id);
  }

  async function saveProduct() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Save failed");
      return;
    }
    await load();
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading products…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sell simple products online or at checkout. This is not warehouse inventory software.
          </p>
        </div>
        <Button type="button" onClick={() => void createProduct()} disabled={saving}>
          Add product
        </Button>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {products.length === 0 ? (
        <CommerceEmptyState
          title="Add products to sell at checkout"
          description="Offer retail items alongside appointments at the point of sale or public store."
          example="Resistance Band"
          actionLabel="Add your first product"
          onAction={() => void createProduct()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <table className="w-full rounded-lg border text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Available in</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((row) => (
                <tr key={row.id} className={`border-b ${selectedId === row.id ? "bg-muted/50" : ""}`}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.priceCents)}</td>
                  <td className="px-4 py-3">
                    {row.sellStandalone ? "Store + POS" : "Add-on only"}
                  </td>
                  <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft ? (
            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex justify-between gap-2">
                <h2 className="text-sm font-semibold">Edit product</h2>
                <Button type="button" size="sm" onClick={() => void saveProduct()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span>Product name</span>
                <input
                  className="rounded-md border px-3 py-2"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Description</span>
                <textarea
                  className="rounded-md border px-3 py-2"
                  rows={2}
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Price</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="rounded-md border px-3 py-2"
                  value={(draft.priceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setDraft({ ...draft, priceCents: Math.round(Number(e.target.value) * 100) || 0 })
                  }
                />
              </label>
              {draft.sku !== undefined ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span>SKU (optional)</span>
                  <input
                    className="rounded-md border px-3 py-2"
                    value={draft.sku || ""}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  />
                </label>
              ) : null}
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">Availability</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.sellStandalone ?? true}
                    onChange={(e) => setDraft({ ...draft, sellStandalone: e.target.checked })}
                  />
                  Available at Point of Sale and Public Store
                </label>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active
              </label>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
