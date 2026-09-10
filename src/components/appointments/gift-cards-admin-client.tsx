"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ContactSearchField,
  formatMoney,
  maskGiftCode,
  StatusBadge,
  type ContactOption,
} from "@/components/appointments/commerce-admin-shared";

type GiftProduct = {
  id: string;
  name: string;
  fixedAmountCents?: number | null;
  allowCustomAmount?: boolean;
  active: boolean;
  eligibleTypeIds?: string[];
};

type IssuedGift = {
  id: string;
  code: string;
  balanceCents: number;
  status: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  createdAt: string;
  product?: { id: string; name: string } | null;
  ledger?: Array<{ id: string; kind: string; amountCents: number; createdAt: string }>;
};

type BookingTypeOption = { id: string; name: string };

export function GiftCardsAdminClient() {
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [issued, setIssued] = useState<IssuedGift[]>([]);
  const [bookingTypes, setBookingTypes] = useState<BookingTypeOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<IssuedGift | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issueContact, setIssueContact] = useState<ContactOption | null>(null);
  const [issueAmount, setIssueAmount] = useState("50");
  const [issueRecipient, setIssueRecipient] = useState("");

  const [productDraft, setProductDraft] = useState({
    name: "",
    fixedAmountDollars: "",
    allowCustomAmount: false,
    active: true,
    eligibleTypeIds: [] as string[],
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, issuedRes, typesRes] = await Promise.all([
        fetch("/api/appointments/service-booking/gift-certificates"),
        fetch("/api/appointments/service-booking/gift-certificates?action=issued"),
        fetch("/api/appointments/types"),
      ]);
      const prodJson = await prodRes.json();
      const issuedJson = issuedRes.ok ? await issuedRes.json() : { data: [] };
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      if (!prodRes.ok) throw new Error(prodJson.error || "Could not load gift cards");
      const rows = (prodJson.data || []) as GiftProduct[];
      setProducts(rows);
      setIssued((issuedJson.data || []) as IssuedGift[]);
      setBookingTypes((typesJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      if (!selectedProductId && rows[0]?.id) setSelectedProductId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedProduct) return;
    setProductDraft({
      name: selectedProduct.name,
      fixedAmountDollars: selectedProduct.fixedAmountCents
        ? (selectedProduct.fixedAmountCents / 100).toFixed(2)
        : "",
      allowCustomAmount: Boolean(selectedProduct.allowCustomAmount),
      active: selectedProduct.active,
      eligibleTypeIds: selectedProduct.eligibleTypeIds || [],
    });
  }, [selectedProduct]);

  async function saveProduct() {
    if (!selectedProduct) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/gift-certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedProduct.id,
        name: productDraft.name.trim(),
        fixedAmountCents: productDraft.fixedAmountDollars
          ? Math.round(Number(productDraft.fixedAmountDollars) * 100)
          : undefined,
        allowCustomAmount: productDraft.allowCustomAmount,
        active: productDraft.active,
        eligibleTypeIds: productDraft.eligibleTypeIds,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Gift card product saved");
    await load();
  }

  async function issueGift() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/appointments/service-booking/gift-certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "issue",
        productId: selectedProduct?.id,
        amountCents: Math.round(Number(issueAmount || 0) * 100),
        purchaserContactId: issueContact?.id,
        recipientName: issueRecipient.trim() || issueContact?.name,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not issue gift card");
      return;
    }
    setMessage(`Gift card issued — code ends in ${maskGiftCode(json.data?.code || "")}`);
    setIssueContact(null);
    setIssueRecipient("");
    await load();
  }

  async function lookupGift() {
    if (!lookupCode.trim()) return;
    setSaving(true);
    const res = await fetch(
      `/api/appointments/service-booking/gift-certificates?action=lookup&code=${encodeURIComponent(lookupCode.trim())}`,
    );
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Gift card not found");
      setLookupResult(null);
      return;
    }
    setLookupResult(json.data as IssuedGift);
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading gift cards…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Gift cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue gift balances, look up cards safely, and configure checkout redemption.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Lookup</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            placeholder="Enter full gift code"
            aria-label="Gift card code"
          />
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm"
            disabled={saving}
            onClick={() => void lookupGift()}
          >
            Find
          </button>
        </div>
        {lookupResult ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
            <p><strong>Code:</strong> {maskGiftCode(lookupResult.code)}</p>
            <p><strong>Balance:</strong> {formatMoney(lookupResult.balanceCents)}</p>
            <p><strong>Status:</strong> <StatusBadge status={lookupResult.status} /></p>
            {lookupResult.ledger?.length ? (
              <ul className="mt-2 text-xs text-muted-foreground">
                {lookupResult.ledger.map((entry) => (
                  <li key={entry.id}>
                    {entry.kind} {formatMoney(entry.amountCents)} · {new Date(entry.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Issue gift card</h2>
        <p className="text-xs text-muted-foreground">
          Balances redeem at public booking checkout and POS — no separate admin toggle required.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactSearchField selected={issueContact} onSelect={setIssueContact} label="Purchaser (optional)" />
          <label className="flex flex-col gap-1 text-sm">
            <span>Amount (USD)</span>
            <input
              className="rounded border px-3 py-2"
              type="number"
              min={1}
              step={0.01}
              value={issueAmount}
              onChange={(e) => setIssueAmount(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span>Recipient name (optional)</span>
            <input
              className="rounded border px-3 py-2"
              value={issueRecipient}
              onChange={(e) => setIssueRecipient(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          disabled={saving}
          onClick={() => void issueGift()}
        >
          Issue gift card
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Sellable options</h2>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gift card products yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {products.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`w-full p-3 text-left text-sm ${selectedProductId === product.id ? "bg-muted" : ""}`}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    {product.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedProduct ? (
            <div className="space-y-3 border-t pt-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Name</span>
                <input
                  className="rounded border px-3 py-2"
                  value={productDraft.name}
                  onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Fixed amount (optional)</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={0}
                  step={0.01}
                  value={productDraft.fixedAmountDollars}
                  onChange={(e) => setProductDraft((d) => ({ ...d, fixedAmountDollars: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productDraft.allowCustomAmount}
                  onChange={(e) => setProductDraft((d) => ({ ...d, allowCustomAmount: e.target.checked }))}
                />
                Allow custom amount at purchase
              </label>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => void saveProduct()}
              >
                Save product
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Issued balances</h2>
          {issued.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gift cards issued yet.</p>
          ) : (
            <ul className="divide-y rounded-md border max-h-96 overflow-y-auto">
              {issued.map((row) => (
                <li key={row.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{maskGiftCode(row.code)}</span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatMoney(row.balanceCents)} · {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
