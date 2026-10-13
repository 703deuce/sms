"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusIconBadge, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Package, Gift, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

type StoreProductKind = "package" | "gift" | "membership";

type StoreProduct = {
  id: string;
  kind: StoreProductKind;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  billingInterval?: string | null;
  allowCustomAmount?: boolean;
  fixedAmountCents?: number | null;
  denominations?: number[];
  minAmountCents?: number | null;
  maxAmountCents?: number | null;
};

type WorkspaceInfo = {
  slug: string;
  name: string;
  logoUrl?: string | null;
};

type Step = "browse" | "details" | "confirm" | "success";

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function kindLabel(kind: StoreProductKind) {
  switch (kind) {
    case "package":
      return "Package";
    case "gift":
      return "Gift certificate";
    case "membership":
      return "Membership";
  }
}

export function PublicStoreCheckoutClient({ slug }: { slug: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("browse");
  const [filter, setFilter] = useState<StoreProductKind | "all">("all");
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/store`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load store");
      setWorkspace(json.data.workspace);
      setProducts(json.data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load store");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const success = params.get("success");
    if (!success || !sessionId) return;

    setBusy(true);
    void fetch(
      `/api/public/book/${encodeURIComponent(slug)}/store/fulfill?session_id=${encodeURIComponent(sessionId)}`,
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to confirm purchase");
        setResult((json.data?.result as Record<string, unknown>) || json.data);
        setStep("success");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to confirm purchase"))
      .finally(() => setBusy(false));
  }, [slug]);

  const filtered = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((p) => p.kind === filter);
  }, [filter, products]);

  const resolvedAmount = useMemo(() => {
    if (!selected) return 0;
    if (selected.kind === "gift") {
      if (selected.fixedAmountCents != null && selected.fixedAmountCents > 0) {
        return selected.fixedAmountCents;
      }
      return amountCents ?? 0;
    }
    return selected.priceCents;
  }, [amountCents, selected]);

  function selectProduct(product: StoreProduct) {
    setSelected(product);
    setAmountCents(product.denominations?.[0] ?? product.fixedAmountCents ?? null);
    setStep("details");
    setError(null);
  }

  async function submitPurchase() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/store/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: selected.kind,
          productId: selected.id,
          firstName,
          lastName,
          phone,
          email,
          amountCents: selected.kind === "gift" ? resolvedAmount : undefined,
          recipientName: selected.kind === "gift" ? recipientName : undefined,
          recipientEmail: selected.kind === "gift" ? recipientEmail : undefined,
          giftMessage: selected.kind === "gift" ? giftMessage : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");

      if (json.data.paymentRequired && json.data.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
        return;
      }

      setResult(json.data.result || json.data);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Loading store…</p>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Store unavailable</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
        <button type="button" className="mt-4 text-sm underline" onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1120px] space-y-6 px-4 py-6 md:px-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <a href={`/book/${encodeURIComponent(slug)}`} className="underline">
            Back to booking
          </a>
        </p>
        <h1 className="text-2xl font-semibold">{workspace?.name || "Store"}</h1>
        <p className="text-sm text-muted-foreground">
          Purchase packages, gift certificates, and memberships.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {step === "browse" ? (
        <section className="space-y-4" aria-label="Products">
          <div className="flex flex-wrap gap-2">
            {(["all", "package", "gift", "membership"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-full border px-3 py-1 text-sm ${filter === key ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => setFilter(key)}
              >
                {key === "all" ? "All" : kindLabel(key)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products are available right now.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((product) => {
                const Icon = product.kind === "package" ? Package : product.kind === "gift" ? Gift : CreditCard;
                return (
                <li key={`${product.kind}-${product.id}`} className={cn(OPUS_CARD, "flex flex-col p-5")}>
                  <OpusIconBadge icon={Icon} className="mb-3 size-10 rounded-xl bg-primary/10" />
                  <div className="flex flex-1 flex-col gap-3">
                    <div>
                      <Pill tone="neutral" dot={false} className="mb-2">
                        {kindLabel(product.kind)}
                      </Pill>
                      <h2 className="text-lg font-semibold">{product.name}</h2>
                      {product.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
                      ) : null}
                      {product.kind === "membership" && product.billingInterval ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Billed {product.billingInterval}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto pt-2">
                      <p className="text-xl font-semibold tabular-nums">
                        {product.kind === "gift" && product.allowCustomAmount && !product.fixedAmountCents
                          ? "Custom amount"
                          : formatMoney(product.priceCents)}
                      </p>
                      <Button type="button" className="mt-3 w-full" onClick={() => selectProduct(product)}>
                        View details
                      </Button>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {step === "details" && selected ? (
        <section className="space-y-4" aria-label="Purchase details">
          <button type="button" className="text-sm underline" onClick={() => setStep("browse")}>
            ← Back to products
          </button>
          <h2 className="text-xl font-semibold">{selected.name}</h2>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("confirm");
            }}
          >
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Your information</legend>
              <label className="block text-sm">
                First name
                <input
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Last name
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  required
                  type="tel"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </fieldset>

            {selected.kind === "gift" ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Gift details</legend>
                {selected.allowCustomAmount && !selected.fixedAmountCents ? (
                  <label className="block text-sm">
                    Amount
                    {selected.denominations && selected.denominations.length > 0 ? (
                      <select
                        required
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={amountCents ?? ""}
                        onChange={(e) => setAmountCents(Number(e.target.value))}
                      >
                        <option value="" disabled>Select amount</option>
                        {selected.denominations.map((d) => (
                          <option key={d} value={d}>{formatMoney(d)}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        type="number"
                        min={(selected.minAmountCents || 0) / 100}
                        max={selected.maxAmountCents ? selected.maxAmountCents / 100 : undefined}
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={amountCents != null ? amountCents / 100 : ""}
                        onChange={(e) => setAmountCents(Math.round(Number(e.target.value) * 100))}
                      />
                    )}
                  </label>
                ) : null}
                <label className="block text-sm">
                  Recipient name
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Recipient email
                  <input
                    type="email"
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Gift message
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    rows={3}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                  />
                </label>
              </fieldset>
            ) : null}

            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Continue to review
            </button>
          </form>
        </section>
      ) : null}

      {step === "confirm" && selected ? (
        <section className="space-y-4" aria-label="Review purchase">
          <button type="button" className="text-sm underline" onClick={() => setStep("details")}>
            ← Edit details
          </button>
          <h2 className="text-xl font-semibold">Review purchase</h2>
          <dl className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Product</dt>
              <dd>{selected.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{kindLabel(selected.kind)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{formatMoney(resolvedAmount)}</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void submitPurchase()}
          >
            {busy ? "Processing…" : resolvedAmount > 0 ? "Pay now" : "Complete purchase"}
          </button>
        </section>
      ) : null}

      {step === "success" ? (
        <section className="space-y-4 rounded-lg border border-green-600/30 bg-green-50 p-4" aria-live="polite">
          <h2 className="text-xl font-semibold">Purchase complete</h2>
          <p className="text-sm">Thank you. Your purchase has been recorded.</p>
          {result?.code ? (
            <p className="text-sm">
              Gift certificate code: <strong>{String(result.code)}</strong>
            </p>
          ) : null}
          <a href={`/book/${encodeURIComponent(slug)}`} className="inline-block text-sm underline">
            Book an appointment
          </a>
        </section>
      ) : null}
    </main>
  );
}
