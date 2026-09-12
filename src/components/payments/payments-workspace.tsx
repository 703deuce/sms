"use client";

import "./payments.css";
import { CreditCard, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoneyMinor, formatPhoneDisplay } from "@/lib/payment-requests/format";
import { normalizeUserFacingStatus } from "@/lib/payment-requests/status";
import type { PaymentRequestView } from "@/lib/payment-requests/types";
import { RequestPaymentDrawer } from "@/components/payments/request-payment-drawer";
import { PaymentRequestDetailDrawer } from "@/components/payments/payment-request-detail-drawer";

type Summary = {
  requestedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  requestCount: number;
};

const PAGE_SIZES = [5, 10, 25, 50] as const;

function formatSent(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today · ${time}`;
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
  } catch {
    return iso;
  }
}

function sourceLabel(source: string) {
  switch (source) {
    case "conversation":
      return "Conversation";
    case "mctb_conversation":
      return "MCTB";
    case "appointment":
      return "Appointment";
    default:
      return "Payments";
  }
}

function statusClass(label: string) {
  if (label === "Paid") return "payments-status payments-status--paid";
  if (label === "Failed") return "payments-status payments-status--failed";
  if (label === "Cancelled" || label === "Expired") return "payments-status payments-status--muted";
  return "payments-status";
}

export function PaymentsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentRequestView[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const [listRes, connRes] = await Promise.all([
        fetch(`/api/payment-requests?${params.toString()}`),
        fetch("/api/payment-requests/connection"),
      ]);
      const listJson = await listRes.json();
      const connJson = await connRes.json();
      if (!listRes.ok) throw new Error(listJson.error || "Could not load payment requests");
      setRows(listJson.data.rows || []);
      setTotal(listJson.data.total || 0);
      setSummary(listJson.data.summary || null);
      setStripeConnected(Boolean(connJson.data?.stripe?.connected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payment requests");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const openStandaloneRequest = () => {
    setPrefill(null);
    setRequestOpen(true);
  };

  const onRequestSuccess = (id: string) => {
    setRequestOpen(false);
    setDetailId(id);
    void load();
  };

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <div className="payments-page">
      <header className="payments-header">
        <div className="payments-header-left">
          <div className="payments-icon-tile" aria-hidden>
            <CreditCard size={18} />
          </div>
          <div>
            <h1 className="payments-title">Payments</h1>
            <p className="payments-subtitle">
              Send secure payment requests by text and track when customers pay.
            </p>
            {stripeConnected !== null ? (
              <p className="payments-stripe-chip">
                Stripe · {stripeConnected ? "Connected ✓" : "Not connected"}
                <Link href="/integrations?provider=stripe">Manage connection</Link>
              </p>
            ) : null}
          </div>
        </div>
        <button type="button" className="payments-primary-btn" onClick={openStandaloneRequest}>
          <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} aria-hidden />
          Request payment
        </button>
      </header>

      {stripeConnected === false ? (
        <div className="payments-setup-banner" role="status">
          <span>Connect Stripe to request payments. Stripe securely handles checkout and card information.</span>
          <Link href="/integrations?provider=stripe" className="payments-primary-btn" style={{ minWidth: 0, height: 36 }}>
            Connect Stripe
          </Link>
        </div>
      ) : null}

      <section className="payments-summary" aria-label="Payment summary">
        {[
          ["Requested", summary?.requestedMinor ?? 0],
          ["Paid", summary?.paidMinor ?? 0],
          ["Outstanding", summary?.outstandingMinor ?? 0],
          ["Requests", summary?.requestCount ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="payments-summary-cell">
            <div className="payments-summary-label">{label}</div>
            <div className="payments-summary-value">
              {label === "Requests"
                ? String(value)
                : formatMoneyMinor(Number(value), "usd")}
            </div>
          </div>
        ))}
      </section>

      <div className="payments-toolbar">
        <input
          type="search"
          placeholder="Search customer, phone, or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search payment requests"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="all">All statuses</option>
          <option value="outstanding">Outstanding</option>
          <option value="paid">Paid</option>
          <option value="opened">Opened</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {error ? (
        <div className="payments-setup-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="payments-primary-btn" style={{ minWidth: 0, height: 36 }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && tableRows.length === 0 ? (
        <div className="payments-empty">
          <CreditCard size={28} color="#9ca3af" aria-hidden />
          <h3>No payment requests yet</h3>
          <p>Send a secure checkout link by text and track the payment here.</p>
          <button type="button" className="payments-primary-btn" onClick={openStandaloneRequest}>
            Request payment
          </button>
        </div>
      ) : (
        <>
          <div className="payments-table-wrap">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>For</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Paid</th>
                  <th>Source</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: pageSize }).map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={8} style={{ color: "#9ca3af" }}>Loading…</td>
                      </tr>
                    ))
                  : tableRows.map((row) => {
                      const label = normalizeUserFacingStatus(row.status, row.deliveryStatus);
                      return (
                        <tr key={row.id} onClick={() => setDetailId(row.id)}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.customerName || formatPhoneDisplay(row.customerPhoneE164)}</div>
                            {row.customerName ? (
                              <div style={{ fontSize: 12, color: "#6b7280" }}>{formatPhoneDisplay(row.customerPhoneE164)}</div>
                            ) : null}
                          </td>
                          <td className="payments-amount">{formatMoneyMinor(row.amountMinor, row.currency)}</td>
                          <td>
                            <div>{row.description}</div>
                            {row.customerNote ? (
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{row.customerNote}</div>
                            ) : null}
                          </td>
                          <td>{row.sentAt ? formatSent(row.sentAt) : formatSent(row.createdAt)}</td>
                          <td><span className={statusClass(label)}>{label}</span></td>
                          <td>{row.paidAt ? formatSent(row.paidAt) : "—"}</td>
                          <td>{sourceLabel(row.sourceType)}</td>
                          <td><MoreHorizontal size={16} color="#9ca3af" aria-hidden /></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            <div className="payments-pagination">
              <span>{rangeStart}–{rangeEnd} of {total}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label>
                  Rows{" "}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Rows per page"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <span>Page {page} of {pageCount}</span>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">‹</button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page">›</button>
              </div>
            </div>
          </div>

          <div className="payments-mobile-list" aria-label="Payment requests">
            {tableRows.map((row) => {
              const label = normalizeUserFacingStatus(row.status, row.deliveryStatus);
              return (
                <button
                  key={row.id}
                  type="button"
                  className="payments-mobile-card"
                  onClick={() => setDetailId(row.id)}
                  style={{ textAlign: "left", background: "#fff", width: "100%" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>{row.customerName || formatPhoneDisplay(row.customerPhoneE164)}</span>
                    <span>{formatMoneyMinor(row.amountMinor, row.currency)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{row.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                    <span className={statusClass(label)}>{label}</span>
                    <span>{row.paidAt ? formatSent(row.paidAt) : formatSent(row.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <RequestPaymentDrawer
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        prefill={prefill}
        stripeConnected={stripeConnected ?? false}
        onSuccess={onRequestSuccess}
      />

      <PaymentRequestDetailDrawer
        open={Boolean(detailId)}
        requestId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

/** Open request drawer from conversations with prefilled customer. */
export function openConversationPaymentRequest(
  setPrefill: (v: Record<string, string>) => void,
  setOpen: (v: boolean) => void,
  input: { conversationId: string; phone: string; name?: string; contactId?: string; missedCallId?: string },
) {
  setPrefill({
    conversationId: input.conversationId,
    phone: input.phone,
    customerName: input.name || "",
    contactId: input.contactId || "",
    missedCallId: input.missedCallId || "",
    sourceType: input.missedCallId ? "mctb_conversation" : "conversation",
  });
  setOpen(true);
}
