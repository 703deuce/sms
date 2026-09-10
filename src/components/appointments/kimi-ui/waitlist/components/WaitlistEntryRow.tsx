import { Bell, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";
import type { WaitlistEntry } from "../mock-data";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  notified: "Notified",
  accepted: "Accepted",
  expired: "Expired",
  removed: "Removed",
};

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return phone;
}

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WaitlistEntryRow({
  entry,
  acting,
  onNotify,
  onReactivate,
  onRemove,
}: {
  entry: WaitlistEntry;
  acting: boolean;
  onNotify: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}) {
  const isActive = entry.status === "active";
  const isRemoved = entry.status === "removed";
  const contactLabel = entry.phone || entry.email || "unknown contact";

  return (
    <tr
      aria-label={`Waitlist entry for ${contactLabel}`}
      className={isRemoved ? "tv-row--muted" : undefined}
    >
      <td>
        <div className="tv-cell-primary">
          {entry.serviceName || "Any service"}
        </div>
        <div className="tv-cell-secondary">
          {entry.preferredDate
            ? `Prefers ${entry.preferredDate}`
            : "No preferred date"}
        </div>
      </td>
      <td>
        <div className="tv-contact">
          {entry.phone ? (
            <span className="tv-contact-line">
              <Phone aria-hidden="true" />
              {formatPhone(entry.phone)}
            </span>
          ) : null}
          {entry.email ? (
            <span className="tv-contact-line">
              <Mail aria-hidden="true" />
              {entry.email}
            </span>
          ) : null}
          {!entry.phone && !entry.email ? (
            <span className="tv-cell-secondary">No contact info</span>
          ) : null}
        </div>
      </td>
      <td>
        <div className="tv-cell-primary">
          {entry.priorityRank === 1 ? "Next" : entry.priorityRank ? `#${entry.priorityRank}` : "—"}
        </div>
      </td>
      <td className="tv-hide-sm">
        <div className="tv-cell-meta">Joined {formatJoined(entry.createdAt)}</div>
        {entry.notifiedAt ? (
          <div className="tv-cell-secondary">
            Notified {formatJoined(entry.notifiedAt)}
          </div>
        ) : null}
      </td>
      <td>
        <span className={`tv-badge tv-badge--${entry.status}`}>
          {STATUS_LABEL[entry.status] ?? entry.status}
        </span>
      </td>
      <td>
        <div className="tv-row-actions">
          {isActive ? (
            <button
              className="tv-btn tv-btn--outline"
              disabled={acting}
              onClick={onNotify}
              aria-label={`Notify ${contactLabel} about an opening`}
            >
              <Bell aria-hidden="true" />
              {acting ? "Sending…" : "Notify"}
            </button>
          ) : null}
          {!isActive ? (
            <button
              className="tv-btn tv-btn--outline"
              disabled={acting}
              onClick={onReactivate}
              aria-label={`Reactivate waitlist entry for ${contactLabel}`}
            >
              <RotateCcw aria-hidden="true" />
              Reactivate
            </button>
          ) : null}
          {!isRemoved ? (
            <button
              className="tv-btn tv-btn--ghost"
              disabled={acting}
              onClick={onRemove}
              aria-label={`Remove ${contactLabel} from waitlist`}
              style={{ color: "var(--tv-danger)" }}
            >
              <Trash2 aria-hidden="true" />
              <span className="tv-hide-sm">Remove</span>
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
