"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommerceEmptyState } from "@/components/appointments/commerce/commerce-empty-state";
import { ContactSearchField, type ContactOption } from "@/components/appointments/commerce/contact-search-field";
import { formatDate, formatMoney } from "@/components/appointments/commerce/commerce-utils";

const API = "/api/appointments/service-booking/gift-certificates";

type GiftOption = {
  id: string;
  name: string;
  fixedAmountCents?: number | null;
  allowCustomAmount?: boolean;
  active: boolean;
};

type IssuedCard = {
  id: string;
  maskedCode: string;
  balanceCents: number;
  status: string;
  createdAt: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  purchaserName?: string | null;
  product?: { name: string } | null;
};

type LedgerRow = {
  id: string;
  kind: string;
  amountCents: number;
  note?: string | null;
  createdAt: string;
  balanceAfterCents: number;
};

type Tab = "options" | "issued";

export function GiftCardsClient() {
  const [tab, setTab] = useState<Tab>("options");
  const [options, setOptions] = useState<GiftOption[]>([]);
  const [issued, setIssued] = useState<IssuedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GiftOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueContact, setIssueContact] = useState<ContactOption | null>(null);
  const [issueAmount, setIssueAmount] = useState(100);
  const [issueBusy, setIssueBusy] = useState(false);

  const [detailCard, setDetailCard] = useState<IssuedCard | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  const selected = options.find((o) => o.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [optRes, issuedRes] = await Promise.all([
        fetch(API),
        fetch(`${API}?issued=1`),
      ]);
      const optJson = await optRes.json();
      const issuedJson = await issuedRes.json();
      const optRows = (optJson.data || []) as GiftOption[];
      setOptions(optRows);
      setIssued(issuedJson.data || []);
      if (!selectedId && optRows[0]?.id) setSelectedId(optRows[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected]);

  async function createOption() {
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "$50 Gift Card",
        fixedAmountCents: 5000,
        active: false,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    await load();
    setSelectedId((json.data as GiftOption).id);
    setTab("options");
  }

  async function saveOption() {
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

  async function issueCard() {
    setIssueBusy(true);
    const amountCents = Math.round(issueAmount * 100);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "issue",
        productId: draft?.id,
        amountCents,
        purchaserContactId: issueContact?.id,
        recipientName: issueContact?.name,
      }),
    });
    setIssueBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Issue failed");
      return;
    }
    setIssueOpen(false);
    setIssueContact(null);
    await load();
    setTab("issued");
  }

  async function openDetail(card: IssuedCard) {
    setDetailCard(card);
    const res = await fetch(`${API}?balanceId=${card.id}&ledger=1`);
    const json = await res.json();
    if (res.ok) setLedger(json.data || []);
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading gift cards…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Gift Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sell prepaid gift value customers can use toward eligible purchases.
        </p>
      </header>

      <nav className="flex gap-2" aria-label="Gift card sections">
        {(["options", "issued"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
            onClick={() => setTab(key)}
          >
            {key === "options" ? "Gift card options" : "Issued gift cards"}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {tab === "options" ? (
        options.length === 0 ? (
          <CommerceEmptyState
            title="Start selling gift cards"
            description="Create gift card options customers can buy online or at checkout."
            example="$100 Gift Card"
            actionLabel="Create gift card option"
            onAction={() => void createOption()}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <Button type="button" onClick={() => void createOption()} disabled={saving}>
                Create gift card option
              </Button>
              <table className="w-full rounded-lg border text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Value</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((row) => (
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
                      <td className="px-4 py-3">
                        {row.fixedAmountCents != null ? formatMoney(row.fixedAmountCents) : "Custom"}
                      </td>
                      <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {draft ? (
              <section className="space-y-4 rounded-lg border p-4">
                <div className="flex justify-between gap-2">
                  <h2 className="text-sm font-semibold">Edit gift card option</h2>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIssueOpen(true)}>
                      Issue gift card
                    </Button>
                    <Button type="button" size="sm" onClick={() => void saveOption()} disabled={saving}>
                      Save
                    </Button>
                  </div>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Name</span>
                  <input
                    className="rounded-md border px-3 py-2"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Gift value</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="rounded-md border px-3 py-2"
                    value={((draft.fixedAmountCents || 0) / 100).toFixed(2)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fixedAmountCents: Math.round(Number(e.target.value) * 100) || 0,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  Active
                </label>
                <p className="text-xs text-muted-foreground">
                  Gift cards are separate from account credit issued by your business.
                </p>
              </section>
            ) : null}
          </div>
        )
      ) : issued.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gift cards have been issued yet.</p>
      ) : (
        <table className="w-full rounded-lg border text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-3 font-medium">Gift card</th>
              <th scope="col" className="px-4 py-3 font-medium">Recipient</th>
              <th scope="col" className="px-4 py-3 font-medium">Issued</th>
              <th scope="col" className="px-4 py-3 font-medium">Remaining</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {issued.map((card) => (
              <tr key={card.id} className="border-b">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => void openDetail(card)}
                  >
                    {card.maskedCode}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {card.recipientName || card.recipientEmail || card.purchaserName || "—"}
                </td>
                <td className="px-4 py-3">{formatDate(card.createdAt)}</td>
                <td className="px-4 py-3">{formatMoney(card.balanceCents)}</td>
                <td className="px-4 py-3">{card.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {issueOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-medium">Issue gift card</h2>
            <ContactSearchField selected={issueContact} onSelect={setIssueContact} label="Customer" />
            <label className="flex flex-col gap-1 text-sm">
              <span>Value (USD)</span>
              <input
                type="number"
                min={1}
                className="rounded-md border px-3 py-2"
                value={issueAmount}
                onChange={(e) => setIssueAmount(Number(e.target.value) || 0)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void issueCard()} disabled={issueBusy}>
                {issueBusy ? "Issuing…" : "Issue"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {detailCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex justify-between gap-2">
              <h2 className="text-lg font-medium">Gift card {detailCard.maskedCode}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDetailCard(null)}>Close</Button>
            </div>
            <p className="mt-2 text-sm">Remaining balance: {formatMoney(detailCard.balanceCents)}</p>
            <h3 className="mt-4 text-sm font-semibold">Redemption history</h3>
            {ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">No redemptions yet.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-2 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Amount</th>
                    <th scope="col" className="py-2 font-medium">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 pr-2">{formatDate(row.createdAt)}</td>
                      <td className="py-2 pr-2">{formatMoney(row.amountCents)}</td>
                      <td className="py-2">{formatMoney(row.balanceAfterCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
