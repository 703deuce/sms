"use client";

import { Download, ExternalLink, FileText } from "lucide-react";
import { Estimate, formatCurrency, formatDate } from "../types";

export function InvoicesCard({ estimate }: { estimate: Estimate }) {
  return (
    <div className="tv-card">
      <div className="tv-card-head">
        <div>
          <h3 className="tv-card-title">Invoices</h3>
          <p className="tv-card-desc">Issued by Stripe for completed billing periods.</p>
        </div>
      </div>
      <div className="tv-card-body" style={{ paddingTop: 6 }}>
        {estimate.invoices.map((inv) => (
          <div key={inv.id} className="tv-invoice-row">
            <div className="tv-invoice-icon">
              <FileText />
            </div>
            <div className="tv-invoice-meta">
              <div className="tv-invoice-num">{inv.number ?? inv.id}</div>
              <div className="tv-invoice-date">{formatDate(inv.created)}</div>
            </div>
            <span className="tv-chip tv-chip-success" style={{ textTransform: "capitalize" }}>
              {inv.status ?? "—"}
            </span>
            <span className="strong" style={{ fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}>
              {formatCurrency((inv.amountPaid || inv.amountDue) / 100)}
            </span>
            <div className="tv-invoice-actions">
              {inv.hostedInvoiceUrl && (
                <a className="tv-link" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                  View <ExternalLink />
                </a>
              )}
              {inv.pdf && (
                <a className="tv-link" href={inv.pdf} target="_blank" rel="noreferrer">
                  PDF <Download />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
