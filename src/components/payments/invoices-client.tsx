"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContactOption = { id: string; name: string; phone: string };

type InvoiceRow = {
  id: string;
  status: string;
  totalCents: number;
  balanceDueCents: number;
  contactId: string;
  createdAt: string;
  dueAt?: string | null;
  note?: string | null;
  lineItems?: Array<{ description: string; quantity: number; unitPriceCents: number }>;
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
    overdue: "Overdue",
    partial: "Partially paid",
  };
  return map[status] || status;
}

function isOverdue(row: InvoiceRow) {
  if (row.status === "paid" || row.status === "void") return false;
  if (!row.dueAt) return false;
  return new Date(row.dueAt) < new Date() && row.balanceDueCents > 0;
}

function displayStatus(row: InvoiceRow) {
  if (isOverdue(row)) return "Overdue";
  if (row.status === "open" && row.balanceDueCents > 0 && row.balanceDueCents < row.totalCents) {
    return "Partially paid";
  }
  return statusLabel(row.status);
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
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPayUrl, setLastPayUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((row) => {
        const status = displayStatus(row).toLowerCase().replace(/\s+/g, "_");
        return status === statusFilter || row.status === statusFilter;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const customer = (contactNames[row.contactId] || row.contactId).toLowerCase();
        return customer.includes(q) || row.id.toLowerCase().includes(q);
      });
    }
    return list;
  }, [rows, statusFilter, search, contactNames]);

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
        dueAt: dueDate || undefined,
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
    setDueDate("");
    void load();
  }

  async function copyPayLink(invoiceId: string) {
    setActionBusy(invoiceId);
    setMessage(null);
    try {
      const res = await fetch(`/api/appointments/service-booking/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay_link" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not copy pay link");
      await navigator.clipboard.writeText(json.data.payUrl);
      setMessage("Payment link copied.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not copy pay link");
    } finally {
      setActionBusy(null);
    }
  }

  async function voidInvoice(invoiceId: string) {
    if (!window.confirm("Void this invoice? It will remain visible but cannot be paid.")) return;
    setActionBusy(invoiceId);
    setMessage(null);
    try {
      const res = await fetch(`/api/appointments/service-booking/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not void invoice");
      setMessage("Invoice voided.");
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not void invoice");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <p className="mt-1 text-sm text-gray-600">
          Send invoices to customers and track outstanding balances.{" "}
          <Link href="/payments/transactions" className="text-indigo-600 underline">
            View transactions
          </Link>
        </p>
      </header>

      <section className="rounded-xl border bg-white p-6 space-y-4" aria-labelledby="new-invoice-heading">
        <h2 id="new-invoice-heading" className="text-base font-semibold">Create invoice</h2>
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
          <label className="flex flex-col gap-1 text-sm">
            <span>Due date (optional)</span>
            <input
              type="date"
              className="rounded-md border px-3 py-2"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="invoice-list-heading" className="text-base font-semibold">All invoices</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              className="rounded-md border px-3 py-1.5 text-sm"
              placeholder="Search customer or invoice #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search invoices"
            />
            <select
              className="rounded-md border px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="open">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading invoices…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : filtered.length === 0 ? (
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
                  <th scope="col" className="px-4 py-3 font-medium">Due</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Balance</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">#{row.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${row.contactId}`} className="text-indigo-600 hover:underline">
                        {contactNames[row.contactId] || row.contactId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(row.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.dueAt
                        ? new Date(row.dueAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{formatMoney(row.totalCents)}</td>
                    <td className="px-4 py-3">{formatMoney(row.balanceDueCents)}</td>
                    <td className="px-4 py-3">{displayStatus(row)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.status !== "paid" && row.status !== "void" ? (
                          <button
                            type="button"
                            className="text-xs text-indigo-600 underline disabled:opacity-50"
                            disabled={actionBusy === row.id}
                            onClick={() => void copyPayLink(row.id)}
                          >
                            Copy pay link
                          </button>
                        ) : null}
                        {row.status !== "paid" && row.status !== "void" ? (
                          <button
                            type="button"
                            className="text-xs text-red-700 underline disabled:opacity-50"
                            disabled={actionBusy === row.id}
                            onClick={() => void voidInvoice(row.id)}
                          >
                            Void
                          </button>
                        ) : null}
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
