"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ContactOption = { id: string; name: string; phone: string };

type InvoiceRow = {
  id: string;
  status: string;
  totalCents: number;
  balanceDueCents: number;
  contactId: string;
  createdAt: string;
  dueAt?: string | null;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Sent",
    paid: "Paid",
    draft: "Draft",
    void: "Void",
  };
  return map[status] || status;
}

function ContactSearchField({
  value,
  selected,
  onSelect,
}: {
  value: string;
  selected: ContactOption | null;
  onSelect: (contact: ContactOption | null) => void;
}) {
  const [query, setQuery] = useState(value);
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
          className="rounded-md border px-3 py-2"
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

export function InvoicesClient() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("50");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPayUrl, setLastPayUrl] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/invoices");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load invoices");
      const list = (json.data || []) as InvoiceRow[];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.contactId).filter(Boolean))];
      if (ids.length) {
        const names: Record<string, string> = {};
        await Promise.all(
          ids.map(async (id) => {
            const r = await fetch(`/api/contacts/${id}`);
            const j = await r.json();
            if (r.ok && j.data) {
              names[id] = [j.data.firstName, j.data.lastName].filter(Boolean).join(" ") || j.data.phone || id;
            }
          }),
        );
        setContactNames(names);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvoice() {
    if (!selectedContact) {
      setMessage("Select a customer.");
      return;
    }
    if (!description.trim()) {
      setMessage("Enter a description for the line item.");
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
    const res = await fetch("/api/appointments/service-booking/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: selectedContact.id,
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
      setLastPayUrl(`${window.location.origin}/pay/invoice/${payToken}`);
    }
    setMessage("Invoice created.");
    setDescription("");
    void load();
  }

  async function sendInvoiceEmail(invoiceId: string) {
    setSendingId(invoiceId);
    setMessage(null);
    const res = await fetch(`/api/appointments/service-booking/invoices/${invoiceId}/send`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setSendingId(null);
    if (!res.ok) {
      setMessage(json.error || "Could not send invoice email");
      return;
    }
    setMessage("Invoice email sent.");
    void load();
  }

  function downloadInvoicePdf(invoiceId: string) {
    window.open(`/api/appointments/service-booking/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <p className="mt-1 text-sm text-gray-600">
          Bill customers and track outstanding balances.{" "}
          <Link href="/payments/transactions" className="text-indigo-600 underline">
            View transactions
          </Link>
        </p>
      </header>

      <section className="rounded-xl border bg-white p-6 space-y-4" aria-labelledby="new-invoice-heading">
        <h2 id="new-invoice-heading" className="text-base font-semibold">New invoice</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactSearchField
            value=""
            selected={selectedContact}
            onSelect={setSelectedContact}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span>Description</span>
            <input
              className="rounded-md border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Consultation"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Amount</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded-md border px-3 py-2"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={creating}
          onClick={() => void createInvoice()}
        >
          {creating ? "Creating…" : "Create invoice"}
        </button>
        {message ? <p className="text-sm text-gray-600">{message}</p> : null}
        {lastPayUrl ? (
          <p className="text-sm">
            Customer pay link:{" "}
            <a className="text-indigo-600 underline break-all" href={lastPayUrl}>{lastPayUrl}</a>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="invoice-list-heading">
        <h2 id="invoice-list-heading" className="text-base font-semibold mb-3">All invoices</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading invoices…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium text-gray-900">No invoices yet</p>
            <p className="mt-1 text-sm text-gray-600">
              Create an invoice when you need to collect payment outside a booking checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                  <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Balance</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{row.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">{contactNames[row.contactId] || row.contactId}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(row.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3">{formatMoney(row.totalCents)}</td>
                    <td className="px-4 py-3">{formatMoney(row.balanceDueCents)}</td>
                    <td className="px-4 py-3">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-indigo-600 underline text-xs disabled:opacity-50"
                          disabled={sendingId === row.id}
                          onClick={() => void sendInvoiceEmail(row.id)}
                        >
                          {sendingId === row.id ? "Sending…" : "Send email"}
                        </button>
                        <button
                          type="button"
                          className="text-indigo-600 underline text-xs"
                          onClick={() => downloadInvoicePdf(row.id)}
                        >
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
