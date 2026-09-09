"use client";

import { useCallback, useEffect, useState } from "react";

type InvoiceLine = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

type InvoiceData = {
  status: string;
  currency: string;
  totalCents: number;
  balanceDueCents: number;
  depositPaidCents: number;
  dueAt: string | null;
  note: string | null;
  businessName: string;
  customerName: string;
  lineItems: InvoiceLine[];
  canPayOnline: boolean;
};

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default function InvoicePayPublicClient({ token }: { token: string }) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/pay/invoice/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Invoice not found");
    setData(json.data);
  }, [token]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/pay/invoice/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment could not start");
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
        return;
      }
      setMessage("This invoice is already paid.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Invoice unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">Loading invoice…</p>
      </main>
    );
  }

  const paid = data.balanceDueCents <= 0 || data.status === "paid";

  return (
    <main className="min-h-screen bg-[#f7f6fb] py-10 px-4">
      <div className="max-w-lg mx-auto rounded-xl border bg-white shadow-sm overflow-hidden">
        <header className="border-b px-6 py-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Invoice</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{data.businessName}</h1>
          <p className="text-sm text-gray-600 mt-1">Bill to {data.customerName}</p>
        </header>
        <div className="px-6 py-5 space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th scope="col" className="pb-2 font-medium">Description</th>
                <th scope="col" className="pb-2 font-medium text-right">Qty</th>
                <th scope="col" className="pb-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((line, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 pr-2">{line.description}</td>
                  <td className="py-3 text-right text-gray-600">{line.quantity}</td>
                  <td className="py-3 text-right">{formatMoney(line.totalCents, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Total</dt>
              <dd>{formatMoney(data.totalCents, data.currency)}</dd>
            </div>
            {data.depositPaidCents > 0 ? (
              <div className="flex justify-between">
                <dt className="text-gray-600">Paid</dt>
                <dd>{formatMoney(data.depositPaidCents, data.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <dt>Balance due</dt>
              <dd>{formatMoney(data.balanceDueCents, data.currency)}</dd>
            </div>
          </dl>
          {data.dueAt ? (
            <p className="text-xs text-gray-500">
              Due {new Date(data.dueAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          ) : null}
          {data.note ? <p className="text-sm text-gray-600 border-t pt-3">{data.note}</p> : null}
          {message ? <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">{message}</p> : null}
        </div>
        <footer className="border-t px-6 py-4 bg-gray-50">
          {paid ? (
            <p className="text-sm font-medium text-green-800">Paid — thank you.</p>
          ) : data.canPayOnline ? (
            <button
              type="button"
              className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void pay()}
            >
              {busy ? "Starting payment…" : "Pay invoice"}
            </button>
          ) : (
            <p className="text-sm text-gray-600">
              Contact {data.businessName} to complete payment for this invoice.
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}
