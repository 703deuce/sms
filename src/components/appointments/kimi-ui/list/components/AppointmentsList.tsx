import { useMemo, useState } from "react";
import {
  TABS,
  formatDay,
  formatPhone,
  formatTime,
  groupKey,
  lastCommunicationLabel,
  reminderLabel,
  type AppointmentRow,
} from "../list-types";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { RowActionsMenu } from "./RowActionsMenu";
import { EmptyState } from "./EmptyState";
import { RescheduleModal } from "./RescheduleModal";
import { CancelAppointmentModal } from "./CancelAppointmentModal";
import { AppointmentPreview } from "./AppointmentPreview";

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CalendarPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}

function ReminderDot({ status }: { status: AppointmentRow["reminderStatus"] }) {
  const cls =
    status === "delivered" || status === "sent" ? "tv-rdot tv-rdot--green" :
    status === "scheduled" ? "tv-rdot tv-rdot--sky" :
    status === "failed" ? "tv-rdot tv-rdot--rose" :
    status === "suppressed" ? "tv-rdot tv-rdot--slate" :
    "tv-rdot tv-rdot--muted";
  return <span className={cls} aria-hidden />;
}

export function AppointmentsList({
  tab,
  onTabChange,
  q,
  onSearch,
  state,
  rows,
  counts,
  onRetry,
  onCanceled,
  onRescheduled,
  bookingTypes,
  staffNames,
  onCreateAppointment,
  onNavigateToDetail,
  onNavigateToMessage,
  onNavigateToBooking,
  onNavigateCalendar,
  onToggleFilters,
}: {
  tab: string;
  onTabChange: (t: string) => void;
  q: string;
  onSearch: (v: string) => void;
  state: "loading" | "ready" | "error" | "empty";
  rows: AppointmentRow[];
  counts: Record<string, number>;
  onRetry: () => void;
  onCanceled: (id: string) => void | Promise<void>;
  onRescheduled: (id: string, iso: string) => void | Promise<void>;
  bookingTypes: Array<{ id: string; name: string; durationMinutes: number; location?: string | null }>;
  staffNames: string[];
  onCreateAppointment: () => void | Promise<void>;
  onNavigateToDetail: (id: string) => void;
  onNavigateToMessage: (row: AppointmentRow) => void;
  onNavigateToBooking: () => void;
  onNavigateCalendar?: () => void;
  onToggleFilters?: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<AppointmentRow | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentRow | null>(null);
  const [canceling, setCanceling] = useState<AppointmentRow | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const row of rows) {
      const key = groupKey(row.startsAt, row.timezone);
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  const openRow = (row: AppointmentRow) => setPreview(row);

  const onRowAction = (row: AppointmentRow, action: string) => {
    if (action === "open") openRow(row);
    if (action === "message") onNavigateToMessage(row);
    if (action === "reschedule") { setPreview(null); setRescheduling(row); }
    if (action === "cancel") { setPreview(null); setCanceling(row); }
    if (action === "full") onNavigateToDetail(row.id);
  };

  const tabCount = (id: string) => {
    if (id === "all") return null;
    if (id === "today" || id === "upcoming" || id === "past") return null;
    return counts[id] ?? 0;
  };

  return (
    <div className="tv-stack">
      {/* Page header */}
      <div className="tv-pageheader">
        <div>
          <h1 className="tv-title">Appointments</h1>
          <p className="tv-subtitle">Manage upcoming, completed, cancelled, and past bookings.</p>
        </div>
        <div className="tv-pageheader__actions">
          {onNavigateCalendar && (
            <button type="button" className="tv-btn tv-btn--outline" onClick={onNavigateCalendar}>
              Calendar
            </button>
          )}
          {onToggleFilters && (
            <button type="button" className="tv-btn tv-btn--ghost" onClick={onToggleFilters}>
              Filters
            </button>
          )}
          <button
            type="button"
            className="tv-btn tv-btn--primary"
            onClick={() => {
              void onCreateAppointment();
            }}
          >
            <CalendarPlusIcon />
            New appointment
          </button>
        </div>
      </div>

      {/* Control bar: tabs + search */}
      <div className="tv-controlbar">
        <div className="tv-tabs" role="tablist" aria-label="Appointment filters">
          {TABS.map((t) => {
            const c = tabCount(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "tv-tab tv-tab--active" : "tv-tab"}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
                {c !== null && c > 0 && <span className="tv-tab__count">{c}</span>}
              </button>
            );
          })}
        </div>
        <div className="tv-search">
          <span className="tv-search__icon"><SearchIcon /></span>
          <input
            type="search"
            className="tv-input tv-search__input"
            placeholder="Name, phone, email, or service"
            aria-label="Search appointments"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content region */}
      {state === "loading" && (
        <div className="tv-surface" aria-busy="true" aria-label="Loading appointments">
          <div className="tv-tablehead tv-rowgrid" aria-hidden>
            <span>Customer</span><span>Date &amp; time</span><span>Booking type</span><span>Status</span><span>Reminder</span><span />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="tv-rowgrid tv-skelrow">
              <div className="tv-skelcell">
                <span className="tv-skel tv-skel--avatar" />
                <div className="tv-skelstack">
                  <span className="tv-skel tv-skel--w120" />
                  <span className="tv-skel tv-skel--w80" />
                </div>
              </div>
              <span className="tv-skel tv-skel--w90" />
              <span className="tv-skel tv-skel--w110" />
              <span className="tv-skel tv-skel--w80" />
              <span className="tv-skel tv-skel--w100" />
              <span />
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="tv-surface">
          <EmptyState
            icon={<AlertIcon />}
            title="Appointments couldn't be loaded"
            description="We couldn't reach the appointments service. Your filters are preserved — try again."
            actionLabel="Retry"
            onAction={onRetry}
          />
        </div>
      )}

      {state === "empty" && (
        <div className="tv-surface">
          <EmptyState
            icon={<CalendarIcon />}
            title="No appointments yet"
            description="Appointments appear here when customers book through your booking page or you add one manually."
            actionLabel="New appointment"
            onAction={() => void onCreateAppointment()}
            secondaryLabel="Set up booking page"
            onSecondary={onNavigateToBooking}
          />
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        <div className="tv-surface">
          <EmptyState
            icon={<SearchIcon />}
            title={q ? `No appointments match “${q}”` : "No appointments in this view"}
            description={q ? "Try a different name, phone number, email, or service." : "Try a different filter or create an appointment."}
            actionLabel={q ? "Clear search" : "New Appointment"}
            onAction={() => (q ? onSearch("") : void onCreateAppointment())}
            secondaryLabel={q ? undefined : "Clear filters"}
            onSecondary={q ? undefined : () => { onTabChange("all"); onSearch(""); }}
          />
        </div>
      )}

      {state === "ready" && rows.length > 0 && (
        <div className="tv-surface">
          <div className="tv-tablehead tv-rowgrid" role="row">
            <span role="columnheader">Date / time</span>
            <span role="columnheader">Client</span>
            <span role="columnheader">Booking</span>
            <span role="columnheader">Staff</span>
            <span role="columnheader">Location</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Payment</span>
            <span role="columnheader">Attention</span>
            <span role="columnheader" className="tv-sronly">Actions</span>
          </div>
          {grouped.map(([day, dayRows]) => (
            <section key={day} aria-label={day}>
              <div className="tv-dayhead">
                <span>{day}</span>
                <span className="tv-dayhead__count">{dayRows.length}</span>
              </div>
              {dayRows.map((row) => {
                const name = row.inviteeName ?? "Unknown customer";
                const lc = lastCommunicationLabel(row.metadata);
                return (
                  <div
                    key={row.id}
                    className="tv-rowgrid tv-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openRow(row)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(row); } }}
                    aria-label={`Open preview: ${name}, ${row.serviceName ?? "appointment"}, ${formatDay(row.startsAt, row.timezone)} at ${formatTime(row.startsAt, row.timezone)}`}
                  >
                    <div className="tv-cellstack">
                      <span className="tv-strong">{formatDay(row.startsAt, row.timezone)}</span>
                      <span className="tv-muted">
                        {formatTime(row.startsAt, row.timezone)}
                        {row.metadata.durationMinutes ? ` · ${row.metadata.durationMinutes} min` : ""}
                      </span>
                    </div>
                    <div className="tv-cellcustomer">
                      <span className="tv-avatar" aria-hidden>{initials(row.inviteeName)}</span>
                      <div className="tv-cellstack">
                        <span className="tv-strong">{name}</span>
                        <span className="tv-muted">{formatPhone(row.inviteePhone) || row.inviteeEmail || "—"}</span>
                      </div>
                    </div>
                    <div className="tv-cellstack">
                      <span className="tv-strong">{row.serviceName ?? "—"}</span>
                      <span className="tv-muted">{row.domainLabel ?? "Service"}</span>
                    </div>
                    <div className="tv-cellstack">
                      <span className="tv-strong">{row.staffLabel || row.metadata.staffName || "—"}</span>
                    </div>
                    <div className="tv-muted">{row.locationLabel || row.metadata.location || "—"}</div>
                    <div><AppointmentStatusBadge status={row.status} /></div>
                    <div className="tv-muted">{row.paymentLabel || "—"}</div>
                    <div className="tv-muted">{row.attentionSummary || "—"}</div>
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <RowActionsMenu name={name} status={row.status} onAction={(a) => onRowAction(row, a)} />
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      <RescheduleModal
        row={rescheduling}
        onClose={() => setRescheduling(null)}
        onRescheduled={async (id, iso) => {
          await onRescheduled(id, iso);
          fire(`Appointment rescheduled to ${formatDay(iso, null)} at ${formatTime(iso, null)}. Customer notified.`);
        }}
      />
      <CancelAppointmentModal
        row={canceling}
        onClose={() => setCanceling(null)}
        onCanceled={async (id) => {
          await onCanceled(id);
          fire("Appointment canceled. Future reminders stopped and customer notified.");
        }}
      />
      <AppointmentPreview row={preview} onClose={() => setPreview(null)} onAction={(a) => preview && onRowAction(preview, a)} />

      {toast && (
        <div className="tv-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
