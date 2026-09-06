"use client";

import { UsageRow, formatCurrency, formatDate, formatNumber } from "../mock-data";

export function UsageTable({ usage }: { usage: UsageRow[] }) {
  return (
    <div className="tv-card">
      <div className="tv-card-head">
        <div>
          <h3 className="tv-card-title">Message usage</h3>
          <p className="tv-card-desc">Outbound appointment reminder messages by billing period.</p>
        </div>
      </div>
      <div className="tv-card-body" style={{ paddingTop: 6 }}>
        <div className="tv-table-wrap">
          <table className="tv-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Outbound</th>
                <th className="num">SMS segments</th>
                <th className="num">MMS</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id}>
                  <td className="strong" style={{ whiteSpace: "nowrap" }}>
                    {formatDate(u.periodStart)} – {formatDate(u.periodEnd)}
                  </td>
                  <td className="num">{formatNumber(u.outbound)}</td>
                  <td className="num">{formatNumber(u.smsSegments)}</td>
                  <td className="num">{formatNumber(u.mmsMessages)}</td>
                  <td className="num strong">{formatCurrency(u.costCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
