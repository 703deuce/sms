import { Bell, ChevronRight, RefreshCcw } from "lucide-react";
import type { RecallActivity } from "../types";

const STATUS_CHIP: Record<RecallActivity["status"], string> = {
  Rebooked: "tv-chip tv-chip-success",
  Sent: "tv-chip tv-chip-info",
  "Awaiting reply": "tv-chip tv-chip-warning",
  Suppressed: "tv-chip tv-chip-muted",
};

export function RecallActivityList({
  items,
  onSelect,
}: {
  items: RecallActivity[];
  onSelect: (item: RecallActivity) => void;
}) {
  return (
    <>
      <div className="tv-table-wrap tv-activity-desktop">
        <table className="tv-table">
          <caption className="sr-only">Recent recall and no-show recovery activity</caption>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Activity</th>
              <th scope="col">Status</th>
              <th scope="col">Time</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const Icon = row.type === "recall" ? Bell : RefreshCcw;
              return (
                <tr
                  key={row.id}
                  className="tv-row-click"
                  onClick={() => onSelect(row)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(row);
                  }}
                  aria-label={`View activity for ${row.customer}`}
                >
                  <td>
                    <div className="tv-row-main">
                      <span className={`tv-icon-badge ${row.type === "recall" ? "tv-icon-recall" : "tv-icon-noshow"}`} aria-hidden="true">
                        <Icon size={15} strokeWidth={1.8} />
                      </span>
                      <span className="tv-row-name">{row.customer}</span>
                    </div>
                  </td>
                  <td>
                    <span className="tv-row-detail">{row.detail}</span>
                  </td>
                  <td>
                    <span className={STATUS_CHIP[row.status]}>{row.status}</span>
                  </td>
                  <td style={{ color: "var(--tv-text-muted)", whiteSpace: "nowrap" }}>{row.time}</td>
                  <td style={{ textAlign: "right", width: 40 }}>
                    <ChevronRight size={15} style={{ color: "var(--tv-text-muted)" }} aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="tv-activity-mobile">
        {items.map((row) => {
          const Icon = row.type === "recall" ? Bell : RefreshCcw;
          return (
            <button
              type="button"
              key={row.id}
              className="tv-activity-card"
              onClick={() => onSelect(row)}
              aria-label={`View activity for ${row.customer}`}
            >
              <span className="tv-row-main">
                <span className={`tv-icon-badge ${row.type === "recall" ? "tv-icon-recall" : "tv-icon-noshow"}`} aria-hidden="true">
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="tv-row-name">{row.customer}</span>
                  <span className="tv-row-detail" style={{ display: "block" }}>{row.detail}</span>
                </span>
              </span>
              <span className="tv-activity-card-meta">
                <span className={STATUS_CHIP[row.status]}>{row.status}</span>
                <span style={{ color: "var(--tv-text-muted)", fontSize: 12 }}>{row.time}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
