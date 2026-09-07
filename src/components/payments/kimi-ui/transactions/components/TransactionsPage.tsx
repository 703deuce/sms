"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  TransactionRow,
  formatMoney,
  formatWhen,
  appointmentHref,
} from "../types";
import { StatusChip } from "./StatusChip";
import { TransactionDrawer } from "./TransactionDrawer";
import { RefundModal } from "./RefundModal";

type PageState = "loading" | "normal" | "empty" | "no-results" | "error" | "readonly";

const providerLabel = (p: string) => (p === "stripe" ? "Stripe" : "Square");
const modeLabel: Record<string, string> = {
  booking: "At booking",
  payment_link: "Payment link",
  deposit: "Deposit",
};

export function TransactionsPage() {
  const [state, setState] = useState<PageState>("loading");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [refunding, setRefunding] = useState<TransactionRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastFocusedRow = useRef<string | null>(null);

  useEffect(() => {
    setState("loading");
    fetch("/api/merchant-payments/transactions")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((json) => {
        const mapped = ((json.data?.transactions || []) as Array<Record<string, unknown>>).map(
          (row) => ({
            id: String(row.id),
            appointmentId: String(row.appointmentId),
            appointmentTitle: String(row.appointmentTitle || "Appointment"),
            customerName: String(row.customerName || "Customer"),
            customerPhone: String(row.customerPhone || ""),
            provider: (row.provider === "square" ? "square" : "stripe") as TransactionRow["provider"],
            status: String(row.status) as TransactionRow["status"],
            paymentMode: String(row.paymentMode) as TransactionRow["paymentMode"],
            currency: String(row.currency || "usd"),
            totalPriceCents: Number(row.totalPriceCents || 0),
            amountPaidCents: Number(row.amountPaidCents || 0),
            refundAmountCents: Number(row.refundAmountCents || 0),
            paidAt: (row.paidAt as string | null) ?? null,
            createdAt: String(row.createdAt),
          }),
        );
        setRows(mapped);
        setState(mapped.length === 0 ? "empty" : "normal");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (state !== "normal" && state !== "no-results") return [];
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (providerFilter !== "all") r = r.filter((x) => x.provider === providerFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (x) =>
          x.customerName.toLowerCase().includes(q) ||
          x.appointmentTitle.toLowerCase().includes(q) ||
          x.id.toLowerCase().includes(q),
      );
    }
    return r;
  }, [state, rows, query, statusFilter, providerFilter]);

  const totals = useMemo(() => {
    const collected = rows
      .filter((r) => r.status === "succeeded" || r.status === "partially_refunded")
      .reduce((s, r) => s + r.amountPaidCents, 0);
    const refunded = rows.reduce((s, r) => s + r.refundAmountCents, 0);
    const outstanding = rows
      .filter((r) => r.status === "pending")
      .reduce((s, r) => s + r.totalPriceCents, 0);
    return { collected, refunded, outstanding };
  }, [rows]);

  const hasFilters = query.trim() !== "" || statusFilter !== "all" || providerFilter !== "all";

  const handleRefunded = (id: string, refundAmountCents: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const refundTotal = r.refundAmountCents + refundAmountCents;
        const fullyRefunded = refundTotal >= r.amountPaidCents;
        const updated: TransactionRow = {
          ...r,
          refundAmountCents: refundTotal,
          status: fullyRefunded ? "refunded" : "partially_refunded",
        };
        setSelected((sel) => (sel?.id === id ? updated : sel));
        setRefunding((cur) => (cur?.id === id ? updated : cur));
        return updated;
      }),
    );
    setToast("Refund issued. The transaction has been updated.");
  };

  return (
    <div className="tv-page">
      {/* Page header */}
      <div className="tv-header">
        <div>
          <h1 className="tv-title">Transactions</h1>
          <p className="tv-subtitle">
            Appointment payments collected through Stripe or Square.
          </p>
        </div>
        <a href="/integrations/payments" className="tv-link tv-header-link">
          Manage payment providers
        </a>
      </div>

      {state === "readonly" && (
        <div className="tv-banner tv-banner-info" role="status">
          <Lock size={14} />
          You have read-only access to payment transactions. Contact an administrator to make changes.
        </div>
      )}

      {state !== "loading" && state !== "empty" && state !== "error" && (
        <div className="tv-metrics">
          <div className="tv-metric">
            <p className="tv-metric-label">Collected (30 days)</p>
            <p className="tv-metric-value">{formatMoney(totals.collected, "usd")}</p>
            <p className="tv-metric-hint">{rows.filter((r) => r.status === "succeeded").length} payments</p>
          </div>
          <div className="tv-metric">
            <p className="tv-metric-label">Refunded</p>
            <p className="tv-metric-value">{formatMoney(totals.refunded, "usd")}</p>
            <p className="tv-metric-hint">Across all transactions</p>
          </div>
          <div className="tv-metric">
            <p className="tv-metric-label">Outstanding</p>
            <p className="tv-metric-value">{formatMoney(totals.outstanding, "usd")}</p>
            <p className="tv-metric-hint">
              {rows.filter((r) => r.status === "pending").length} pending payment links
            </p>
          </div>
        </div>
      )}

      {/* Main content card */}
      <div className="tv-card">
        {state === "loading" ? (
          <div aria-busy="true" aria-label="Loading transactions">
            <div className="tv-toolbar">
              <div className="tv-skel tv-skel-search" />
              <div className="tv-skel tv-skel-pill" />
              <div className="tv-skel tv-skel-pill" />
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="tv-skel-row">
                <div className="tv-skel tv-skel-cell" style={{ width: "18%" }} />
                <div className="tv-skel tv-skel-cell" style={{ width: "12%" }} />
                <div className="tv-skel tv-skel-cell" style={{ width: "14%" }} />
                <div className="tv-skel tv-skel-cell" style={{ width: "10%" }} />
                <div className="tv-skel tv-skel-cell" style={{ width: "12%", marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        ) : state === "error" ? (
          <div className="tv-state">
            <div className="tv-state-icon tv-state-icon-danger">
              <AlertTriangle size={20} />
            </div>
            <h3 className="tv-state-title">Transactions couldn’t be loaded</h3>
            <p className="tv-state-desc">
              We couldn’t reach the payments service. Your data is safe — try again in a moment.
            </p>
            <button className="tv-btn tv-btn-primary" onClick={() => setState("loading")}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : state === "empty" ? (
          <div className="tv-state tv-state-empty">
            <div className="tv-state-icon tv-state-icon-brand">
              <CreditCard size={20} />
            </div>
            <h3 className="tv-state-title">No payment transactions yet</h3>
            <p className="tv-state-desc">
              When customers pay at booking or through a payment link, transactions will appear here.
            </p>
            <a href="/integrations/payments" className="tv-btn tv-btn-primary">
              Connect Stripe or Square
            </a>
          </div>
        ) : (
          <>
            {/* Control bar */}
            <div className="tv-toolbar" role="search">
              <div className="tv-search">
                <Search size={15} className="tv-search-icon" />
                <input
                  className="tv-search-input"
                  placeholder="Search customer, service, or transaction…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search transactions"
                />
              </div>
              <select
                className="tv-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="succeeded">Paid</option>
                <option value="partially_refunded">Partially refunded</option>
                <option value="refunded">Refunded</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <select
                className="tv-select"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Filter by provider"
              >
                <option value="all">All providers</option>
                <option value="stripe">Stripe</option>
                <option value="square">Square</option>
              </select>
              {hasFilters && (
                <button
                  className="tv-btn tv-btn-ghost tv-btn-sm"
                  onClick={() => { setQuery(""); setStatusFilter("all"); setProviderFilter("all"); }}
                >
                  Clear filters
                </button>
              )}
              <span className="tv-result-count" aria-live="polite">
                {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="tv-state">
                <div className="tv-state-icon tv-state-icon-neutral">
                  <SlidersHorizontal size={20} />
                </div>
                <h3 className="tv-state-title">No transactions match these filters</h3>
                <p className="tv-state-desc">
                  Try a different search or clear the filters to see all transactions.
                </p>
                <button
                  className="tv-btn tv-btn-secondary"
                  onClick={() => { setQuery(""); setStatusFilter("all"); setProviderFilter("all"); }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="tv-table-wrap">
                <table className="tv-table">
                  <caption className="tv-sr-only">Payment transactions</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Provider</th>
                      <th scope="col">Status</th>
                      <th scope="col">Mode</th>
                      <th scope="col" className="tv-th-right">Amount</th>
                      <th scope="col">Appointment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => { lastFocusedRow.current = row.id; setSelected(row); }}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { lastFocusedRow.current = row.id; setSelected(row); }
                        }}
                        aria-label={`${row.customerName} — ${formatMoney(row.amountPaidCents || row.totalPriceCents, row.currency)}`}
                      >
                        <td className="tv-td-date">{formatWhen(row.paidAt || row.createdAt)}</td>
                        <td>
                          <div className="tv-customer">
                            <span className="tv-customer-name">{row.customerName}</span>
                            <span className="tv-customer-sub">{row.appointmentTitle}</span>
                          </div>
                        </td>
                        <td>{providerLabel(row.provider)}</td>
                        <td><StatusChip status={row.status} /></td>
                        <td className="tv-td-muted">{modeLabel[row.paymentMode] ?? row.paymentMode}</td>
                        <td className="tv-td-amount">
                          {formatMoney(row.amountPaidCents || row.totalPriceCents, row.currency)}
                          {row.refundAmountCents > 0 && (
                            <span className="tv-refund-note">
                              refunded {formatMoney(row.refundAmountCents, row.currency)}
                            </span>
                          )}
                        </td>
                        <td>
                          <a
                            href={appointmentHref(row.appointmentId)}
                            className="tv-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View appointment
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dev state switcher (sandbox only) */}
      <div className="tv-devbar">
        <span>Preview state:</span>
        {(["normal", "loading", "empty", "no-results", "error", "readonly"] as PageState[]).map((s) => (
          <button
            key={s}
            className={`tv-devbtn ${state === s ? "tv-devbtn-active" : ""}`}
            onClick={() => {
              if (s === "no-results") { setState("normal"); setQuery("zzzz-no-match"); }
              else if (s === "loading") { setState("loading"); setTimeout(() => setState("normal"), 900); }
              else { setState(s); if (s !== "normal") setSelected(null); if (s === "normal") setQuery(""); }
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {toast && (
        <div className="tv-toast" role="status">
          {toast}
        </div>
      )}

      <TransactionDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onRefund={(r) => setRefunding(r)}
      />
      <RefundModal
        row={refunding}
        onClose={() => setRefunding(null)}
        onRefunded={handleRefunded}
      />
    </div>
  );
}
