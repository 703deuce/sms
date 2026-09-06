"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { LedgerEntry, formatCurrency, formatDate } from "../mock-data";

export function LedgerCard({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <div className="tv-card">
      <div className="tv-card-head">
        <div>
          <h3 className="tv-card-title">Credit ledger</h3>
          <p className="tv-card-desc">Purchases, adjustments, and usage settlements.</p>
        </div>
      </div>
      <div className="tv-card-body" style={{ paddingTop: 6 }}>
        <div className="tv-table-wrap">
          <table className="tv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Source</th>
                <th className="num">Amount</th>
                <th className="num">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => {
                const positive = e.amountCents >= 0;
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(e.createdAt)}</td>
                    <td className="strong">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {positive ? (
                          <ArrowUpRight size={13} color="#067647" />
                        ) : (
                          <ArrowDownLeft size={13} color="#b42318" />
                        )}
                        {e.description}
                      </span>
                    </td>
                    <td>
                      <span className="tv-chip tv-chip-neutral" style={{ textTransform: "capitalize" }}>
                        {e.source.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="num strong" style={{ color: positive ? "#067647" : "#b42318" }}>
                      {positive ? "+" : "−"}{formatCurrency(Math.abs(e.amountCents) / 100)}
                    </td>
                    <td className="num">
                      {e.balanceAfterCents != null ? formatCurrency(e.balanceAfterCents / 100) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
