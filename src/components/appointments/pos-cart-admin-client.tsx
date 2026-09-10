"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PosSession = {
  id: string;
  status: string;
  subtotalCents: number;
  totalCents: number;
  contactId?: string | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    totalCents: number;
    kind: string;
    referenceId?: string | null;
  }>;
};

type CatalogItem = { id: string; name: string; priceCents: number; kind: string };

type ContactOption = { id: string; name: string; phone: string };

function ContactSearchField({
  selected,
  onSelect,
}: {
  selected: ContactOption | null;
  onSelect: (contact: ContactOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ take: "12", q });
      void fetch(`/api/contacts?${params}`)
        .then((r) => r.json())
        .then((json) => {
          setOptions(
            (json.data || []).map((c: { id: string; firstName?: string; lastName?: string; phone: string }) => ({
              id: c.id,
              name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
              phone: c.phone,
            })),
          );
        })
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <label className="flex flex-col gap-1 text-sm">
        <span>Customer</span>
        <input
          className="rounded border px-3 py-2"
          value={selected ? selected.name : query}
          onChange={(e) => {
            onSelect(null);
            setQuery(e.target.value);
          }}
          placeholder="Search by name or phone"
          autoComplete="off"
        />
      </label>
      {selected ? (
        <button
          type="button"
          className="mt-1 text-xs text-muted-foreground underline"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
        >
          Clear selection
        </button>
      ) : null}
      {!selected && options.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-md max-h-48 overflow-auto">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => {
                  onSelect(opt);
                  setQuery(opt.name);
                  setOptions([]);
                }}
              >
                <span className="font-medium">{opt.name}</span>
                <span className="block text-xs text-gray-500">{opt.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const LINE_KINDS = [
  { value: "custom", label: "Custom line" },
  { value: "service", label: "Service / appointment type" },
  { value: "package", label: "Package" },
  { value: "gift", label: "Gift certificate" },
  { value: "membership", label: "Membership" },
  { value: "product", label: "Retail product" },
  { value: "discount", label: "Discount" },
  { value: "tip", label: "Tip" },
] as const;

export function PosCartAdminClient() {
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [lineKind, setLineKind] = useState<(typeof LINE_KINDS)[number]["value"]>("custom");
  const [catalogId, setCatalogId] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [accountCreditDollars, setAccountCreditDollars] = useState("");
  const [walletBalanceCents, setWalletBalanceCents] = useState(0);
  const [recentSessions, setRecentSessions] = useState<PosSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contactId = selectedContact?.id ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [posRes, recentRes, packagesRes, giftsRes, membershipsRes, productsRes, typesRes] =
        await Promise.all([
          fetch("/api/appointments/service-booking/pos-cart"),
          fetch("/api/appointments/service-booking/pos-cart?recent=1"),
          fetch("/api/appointments/service-booking/packages"),
          fetch("/api/appointments/service-booking/gift-certificates"),
          fetch("/api/appointments/service-booking/memberships"),
          fetch("/api/appointments/service-booking/products"),
          fetch("/api/appointments/types"),
        ]);
      const posJson = await posRes.json();
      if (!posRes.ok) throw new Error(posJson.error || "Failed to load POS sessions");
      const list = (posJson.data || []) as PosSession[];
      const recentJson = await recentRes.json();
      setSessions(list);
      setRecentSessions((recentJson.data || []) as PosSession[]);
      setActiveId((current) => current ?? list.find((s) => s.status === "open")?.id ?? null);

      const items: CatalogItem[] = [];
      const pushRows = (rows: unknown[], kind: string, priceKey = "priceCents") => {
        for (const row of Array.isArray(rows) ? rows : []) {
          const r = row as Record<string, unknown>;
          if (!r.id || !r.name) continue;
          items.push({
            id: String(r.id),
            name: String(r.name),
            kind,
            priceCents: Number(r[priceKey] ?? r.fixedAmountCents ?? 0),
          });
        }
      };
      if (packagesRes.ok) pushRows((await packagesRes.json()).data, "package");
      if (giftsRes.ok) pushRows((await giftsRes.json()).data, "gift", "fixedAmountCents");
      if (membershipsRes.ok) pushRows((await membershipsRes.json()).data, "membership");
      if (productsRes.ok) pushRows((await productsRes.json()).data, "product");
      if (typesRes.ok) {
        for (const row of (await typesRes.json()).data || []) {
          const r = row as Record<string, unknown>;
          if (!r.id || !r.name) continue;
          items.push({
            id: String(r.id),
            name: String(r.name),
            kind: "service",
            priceCents: Number(r.priceCents ?? 0),
          });
        }
      }
      setCatalog(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = sessions.find((s) => s.id === activeId) || null;
  const filteredCatalog = useMemo(
    () => catalog.filter((item) => item.kind === lineKind),
    [catalog, lineKind],
  );
  const selectedCatalog = filteredCatalog.find((item) => item.id === catalogId) || null;

  useEffect(() => {
    if (selectedCatalog) {
      setDescription(selectedCatalog.name);
      setPriceDollars((selectedCatalog.priceCents / 100).toFixed(2));
    }
  }, [selectedCatalog]);

  useEffect(() => {
    if (active?.contactId && !selectedContact) {
      void fetch(`/api/contacts/${active.contactId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json?.data) return;
          const c = json.data as { id: string; firstName?: string; lastName?: string; phone: string };
          setSelectedContact({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
            phone: c.phone,
          });
        })
        .catch(() => undefined);
    }
  }, [active?.contactId, selectedContact]);

  useEffect(() => {
    if (!contactId) {
      setWalletBalanceCents(0);
      return;
    }
    void fetch(`/api/appointments/service-booking/client-wallet?contactId=${encodeURIComponent(contactId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.balanceCents != null) setWalletBalanceCents(Number(json.data.balanceCents));
      })
      .catch(() => setWalletBalanceCents(0));
  }, [contactId]);

  async function applyPromoCode() {
    if (!active || !promoCode.trim()) return;
    setPromoError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/appointments/service-booking/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          code: promoCode.trim(),
          baseCents: active.subtotalCents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Coupon not valid for this sale");
      const coupon = json.data?.coupon as { id: string; code: string; discountType: string; discountValue: number };
      const discountCents = Number(json.data?.discountCents || 0);
      if (discountCents <= 0) throw new Error("This discount doesn't apply to the items in this sale.");
      const addRes = await fetch("/api/appointments/service-booking/pos-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_line",
          sessionId: active.id,
          line: {
            kind: "discount",
            description: `${coupon.code} (${coupon.discountType === "percent" ? `${coupon.discountValue}%` : "fixed"})`,
            unitPriceCents: -discountCents,
            quantity: 1,
            referenceId: coupon.id,
          },
        }),
      });
      if (!addRes.ok) {
        const addJson = await addRes.json().catch(() => ({}));
        throw new Error(addJson.error || "Could not apply discount");
      }
      setPromoCode("");
      await load();
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Coupon failed");
    } finally {
      setBusy(false);
    }
  }

  async function startSession() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/appointments/service-booking/pos-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", contactId: contactId.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not start session");
      return;
    }
    const json = await res.json();
    if (json.data?.id) setActiveId(json.data.id);
    await load();
  }

  async function addLine() {
    if (!activeId) return;
    const cents =
      lineKind === "discount"
        ? -Math.abs(Math.round(Number(priceDollars || "0") * 100))
        : Math.round(Number(priceDollars || "0") * 100);
    const desc =
      description.trim() ||
      (lineKind === "tip" ? "Tip" : lineKind === "discount" ? "Discount" : "");
    if (!desc) return;

    setBusy(true);
    const res = await fetch("/api/appointments/service-booking/pos-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_line",
        sessionId: activeId,
        line: {
          kind: lineKind,
          description: desc,
          unitPriceCents: cents,
          quantity: 1,
          referenceId: catalogId || undefined,
        },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not add line");
      return;
    }
    setDescription("");
    setPriceDollars("");
    setCatalogId("");
    await load();
  }

  async function removeLine(lineItemId: string) {
    if (!activeId) return;
    setBusy(true);
    const res = await fetch("/api/appointments/service-booking/pos-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_line", sessionId: activeId, lineItemId }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not remove line");
      return;
    }
    await load();
  }

  async function checkout() {
    if (!activeId) return;
    if (!contactId) {
      setError("Select a customer before checkout — required for packages, memberships, and entitlements.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const creditCents = accountCreditDollars
      ? Math.round(Number(accountCreditDollars) * 100)
      : 0;
    const res = await fetch("/api/appointments/service-booking/pos-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkout",
        sessionId: activeId,
        contactId: contactId.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        accountCreditCents: creditCents > 0 ? creditCents : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Checkout failed");
      return;
    }
    const json = await res.json().catch(() => ({}));
    setActiveId(null);
    setAccountCreditDollars("");
    setSuccess(
      json.data?.paymentId
        ? `Checkout complete — payment recorded.`
        : "Checkout complete.",
    );
    await load();
  }

  const creditAppliedCents = accountCreditDollars
    ? Math.min(
        Math.round(Number(accountCreditDollars) * 100) || 0,
        walletBalanceCents,
        active?.totalCents ?? 0,
      )
    : 0;
  const amountDueCents = Math.max(0, (active?.totalCents ?? 0) - creditAppliedCents);

  function formatMoney(cents: number) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
      cents / 100,
    );
  }

  function quickAdd(kind: "tip" | "discount") {
    setLineKind(kind);
    setDescription(kind === "tip" ? "Tip" : "Discount");
    if (kind === "discount") setPriceDollars("5");
    else setPriceDollars("");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mixed checkout for services, packages, memberships, gift cards, products, discounts, and tips.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={busy}
          onClick={() => void startSession()}
        >
          New cart
        </button>
      </header>

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <ContactSearchField selected={selectedContact} onSelect={setSelectedContact} />
        <label className="flex flex-col gap-1 text-sm">
          <span>Referral code (optional)</span>
          <input
            className="rounded border px-3 py-2"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="REF…"
          />
        </label>
        {contactId && walletBalanceCents > 0 ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span>Apply account credit (available {formatMoney(walletBalanceCents)})</span>
            <input
              className="rounded border px-3 py-2 w-40"
              type="number"
              min="0"
              step="0.01"
              value={accountCreditDollars}
              onChange={(e) => setAccountCreditDollars(e.target.value)}
              placeholder="0.00"
            />
          </label>
        ) : null}
      </div>

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !active ? (
        <p className="text-sm text-muted-foreground">Start a cart to add items and check out.</p>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Open session</p>
            <p className="text-sm text-muted-foreground">{formatMoney(active.totalCents)}</p>
          </div>
          <ul className="divide-y rounded-md border">
            {active.lineItems.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">No line items yet.</li>
            ) : (
              active.lineItems.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <div>
                    <span className="font-medium">{line.description}</span>
                    <span className="ml-2 text-xs uppercase text-muted-foreground">{line.kind}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatMoney(line.totalCents)}</span>
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => void removeLine(line.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => quickAdd("tip")}>
              Add tip line
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-xs"
              onClick={() => quickAdd("discount")}
            >
              Add discount line
            </button>
            <input
              className="rounded border px-2 py-1 text-xs"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Promo code"
            />
            <button
              type="button"
              className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              disabled={busy || !promoCode.trim()}
              onClick={() => void applyPromoCode()}
            >
              Apply discount
            </button>
          </div>
          {promoError ? (
            <p className="text-xs text-destructive">{promoError}</p>
          ) : null}

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(active.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span title="BACKEND_GAP — no authoritative tax engine wired">$0.00</span>
            </div>
            {creditAppliedCents > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Account credit</span>
                <span>-{formatMoney(creditAppliedCents)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Amount due</span>
              <span>{formatMoney(amountDueCents)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Tax uses real backend when available — currently recorded as BACKEND_GAP.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>Line type</span>
              <select
                className="rounded border px-3 py-2"
                value={lineKind}
                onChange={(e) => {
                  setLineKind(e.target.value as (typeof LINE_KINDS)[number]["value"]);
                  setCatalogId("");
                }}
              >
                {LINE_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            {filteredCatalog.length > 0 && lineKind !== "custom" && lineKind !== "tip" && lineKind !== "discount" ? (
              <label className="flex flex-col gap-1 text-sm min-w-[200px]">
                <span>Catalog item</span>
                <select
                  className="rounded border px-3 py-2"
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {filteredCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatMoney(item.priceCents)})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span>Description</span>
              <input
                className="rounded border px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{lineKind === "discount" ? "Discount (USD)" : "Price (USD)"}</span>
              <input
                className="rounded border px-3 py-2 w-28"
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => void addLine()}
            >
              Add item
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy || active.lineItems.length === 0}
              onClick={() => void checkout()}
            >
              Complete checkout
            </button>
          </div>
        </div>
      )}

      {recentSessions.length > 0 ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Recent sales</h2>
          <ul className="divide-y text-sm">
            {recentSessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 py-2">
                <span>
                  {s.lineItems.length} item{s.lineItems.length === 1 ? "" : "s"}
                  {s.contactId ? ` · Customer` : ""}
                </span>
                <span className="font-medium">{formatMoney(s.totalCents)}</span>
              </li>
            ))}
          </ul>
          <a href="/appointments/payments" className="text-sm text-primary underline">
            View all transactions
          </a>
        </div>
      ) : null}
    </div>
  );
}
