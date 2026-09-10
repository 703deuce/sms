import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Search,
  Users,
} from "lucide-react";
import type { WaitlistEntry } from "../mock-data";
import { WaitlistEntryRow } from "./WaitlistEntryRow";
import { ConfirmRemoveModal } from "./ConfirmRemoveModal";
import { PriorityRulesDrawer } from "./PriorityRulesDrawer";
import { WaitlistSettingsPanel } from "./WaitlistSettingsPanel";

type StatusFilter =
  | "all"
  | "active"
  | "notified"
  | "accepted"
  | "expired"
  | "removed";
type LoadState = "loading" | "ready" | "error";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "notified", label: "Notified" },
  { key: "accepted", label: "Accepted" },
  { key: "expired", label: "Expired" },
  { key: "removed", label: "Removed" },
];

const LOCAL_NAV = [
  { label: "Calendar", href: "/appointments/calendar", active: false },
  { label: "List", href: "/appointments", active: false },
  { label: "Waitlist", href: "/appointments/waitlist", active: true },
  { label: "Recalls", href: "/appointments/recalls", active: false },
];

export function WaitlistAdminClient() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [acting, setActing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingRemove, setPendingRemove] = useState<WaitlistEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notifyOnOpening, setNotifyOnOpening] = useState(true);
  const [autoFill, setAutoFill] = useState(true);
  const [offerExpirationMinutes, setOfferExpirationMinutes] = useState(30);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(() => {
    setLoadState("loading");
    Promise.all([
      fetch("/api/appointments/waitlist").then((r) => r.json()),
      fetch("/api/appointments/settings").then((r) => (r.ok ? r.json() : { data: {} })),
    ])
      .then(([waitlistJson, settingsJson]) => {
        const mapped = (waitlistJson.data || []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          serviceName: (row.serviceName as string) || null,
          phone: (row.phone as string) || null,
          email: (row.email as string) || null,
          preferredDate: (row.preferredDate as string) || null,
          preferredStaffName: (row.preferredStaffName as string) || null,
          locationName: (row.locationName as string) || null,
          partySize: (row.partySize as number) || null,
          status: String(row.status || "active") as WaitlistEntry["status"],
          createdAt: String(row.createdAt),
          notifiedAt: (row.notifiedAt as string) || null,
          priorityRank: (row.priorityRank as number) ?? null,
          priorityScore: (row.priorityScore as number) ?? null,
        })) as WaitlistEntry[];
        setEntries(mapped);
        const settings = settingsJson.data || {};
        setNotifyOnOpening(settings.waitlistNotifyOnOpening !== false);
        setAutoFill(settings.waitlistAutoFill !== false);
        setOfferExpirationMinutes(settings.waitlistOfferExpirationMinutes ?? 30);
        setLoadState("ready");
      })
      .catch(() => {
        setLoadState("error");
      });
  }, []);

  async function saveWaitlistSettings() {
    setSettingsSaving(true);
    try {
      await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waitlistNotifyOnOpening: notifyOnOpening,
          waitlistAutoFill: autoFill,
          waitlistOfferExpirationMinutes: offerExpirationMinutes,
        }),
      });
      showToast("Waitlist settings saved.");
    } finally {
      setSettingsSaving(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 450);
    return () => clearTimeout(t);
  }, [load]);

  async function patchEntry(
    entryId: string,
    action: "notify" | "remove" | "reactivate",
  ) {
    setActing(entryId);
    try {
      await fetch("/api/appointments/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, action }),
      });
      load();
    } finally {
      setActing(null);
      if (action === "notify") showToast("Customer notified about the opening.");
      if (action === "reactivate") showToast("Entry reactivated.");
      if (action === "remove") showToast("Entry removed from the waitlist.");
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return [e.serviceName, e.phone, e.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [entries, query, statusFilter]);

  const activeCount = counts["active"] || 0;
  const filtering = query.trim() !== "" || statusFilter !== "all";

  return (
    <div className="tv-page">
      {/* Page header */}
      <div className="tv-page-header">
        <div>
          <h1 className="tv-page-title">Waitlist</h1>
          <p className="tv-page-desc">
            Customers waiting for an opening. Notify them when a slot becomes
            available.
          </p>
          <button type="button" className="tv-btn" onClick={() => setRulesOpen(true)}>
            Priority rules
          </button>
        </div>
      </div>

      {/* Local navigation — Appointments domain */}
      <nav className="tv-tabs" aria-label="Appointments">
        {LOCAL_NAV.map((item) =>
          item.active ? (
            <a
              key={item.label}
              className="tv-tab tv-tab--active"
              aria-current="page"
              href={item.href}
            >
              {item.label}
              {activeCount > 0 && (
                <span className="tv-tab-count">{activeCount}</span>
              )}
            </a>
          ) : (
            <a key={item.label} className="tv-tab" href={item.href}>
              {item.label}
            </a>
          ),
        )}
      </nav>

      {/* Control bar */}
      <div className="tv-controlbar">
        <div className="tv-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search service, phone, or email"
            aria-label="Search waitlist"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div
          className="tv-filter-chips"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`tv-chip ${statusFilter === f.key ? "tv-chip--active" : ""}`}
              onClick={() => setStatusFilter(f.key)}
              aria-pressed={statusFilter === f.key}
            >
              {f.label}
              <span className="tv-chip-count">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data region */}
      <div className="tv-card">
        {loadState === "loading" ? (
          <div aria-busy="true" aria-label="Loading waitlist">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="tv-skeleton-row" key={i}>
                <div style={{ flex: 2 }}>
                  <div
                    className="tv-skel"
                    style={{ height: 13, width: "55%" }}
                  />
                  <div
                    className="tv-skel"
                    style={{ height: 11, width: "35%", marginTop: 6 }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div
                    className="tv-skel"
                    style={{ height: 11, width: "60%" }}
                  />
                  <div
                    className="tv-skel"
                    style={{ height: 11, width: "45%", marginTop: 6 }}
                  />
                </div>
                <div
                  className="tv-skel tv-hide-sm"
                  style={{ height: 11, width: 90 }}
                />
                <div
                  className="tv-skel"
                  style={{ height: 20, width: 64, borderRadius: 999 }}
                />
                <div className="tv-skel" style={{ height: 30, width: 74 }} />
              </div>
            ))}
          </div>
        ) : loadState === "error" ? (
          <div className="tv-state" role="alert">
            <div className="tv-state-icon tv-state-icon--danger">
              <AlertCircle aria-hidden="true" />
            </div>
            <h2 className="tv-state-title">Waitlist couldn’t be loaded</h2>
            <p className="tv-state-desc">
              Something went wrong while loading waitlist entries. Your filters
              and place on this page are unchanged.
            </p>
            <div className="tv-state-actions">
              <button className="tv-btn tv-btn--primary" onClick={load}>
                Retry
              </button>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="tv-state">
            <div className="tv-state-icon">
              <Users aria-hidden="true" />
            </div>
            <h2 className="tv-state-title">No waitlist entries yet</h2>
            <p className="tv-state-desc">
              Entries appear here automatically when customers join the waitlist
              from your booking page when no slots are available. Share your
              booking page link so customers can join when you’re fully booked.
            </p>
            <div className="tv-state-actions">
              <a className="tv-btn tv-btn--primary" href="/appointments/booking">
                <ExternalLink aria-hidden="true" />
                Open booking pages
              </a>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="tv-state">
            <div className="tv-state-icon">
              <CalendarClock aria-hidden="true" />
            </div>
            <h2 className="tv-state-title">No entries match your filters</h2>
            <p className="tv-state-desc">
              Try a different search or clear the status filter to see all
              waitlist entries.
            </p>
            <div className="tv-state-actions">
              <button
                className="tv-btn tv-btn--outline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <table className="tv-table">
            <caption
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              Waitlist entries — {visible.length} shown
            </caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Contact</th>
                <th scope="col" className="tv-hide-sm">
                  Activity
                </th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: "right" }}>
                  <span
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                    }}
                  >
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <WaitlistEntryRow
                  key={e.id}
                  entry={e}
                  acting={acting === e.id}
                  onNotify={() => patchEntry(e.id, "notify")}
                  onReactivate={() => patchEntry(e.id, "reactivate")}
                  onRemove={() => setPendingRemove(e)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loadState === "ready" && visible.length > 0 ? (
        <p className="tv-results-meta" style={{ marginTop: 10 }}>
          Showing {visible.length} of {entries.length}{" "}
          {entries.length === 1 ? "entry" : "entries"}
          {filtering ? " (filtered)" : ""}
        </p>
      ) : null}

      {pendingRemove ? (
        <ConfirmRemoveModal
          entry={pendingRemove}
          busy={acting === pendingRemove.id}
          onCancel={() => setPendingRemove(null)}
          onConfirm={async () => {
            await patchEntry(pendingRemove.id, "remove");
            setPendingRemove(null);
          }}
        />
      ) : null}

      <WaitlistSettingsPanel
        notifyOnOpening={notifyOnOpening}
        autoFill={autoFill}
        offerExpirationMinutes={offerExpirationMinutes}
        saving={settingsSaving}
        onNotifyChange={setNotifyOnOpening}
        onAutoFillChange={setAutoFill}
        onExpirationChange={setOfferExpirationMinutes}
        onSave={saveWaitlistSettings}
      />

      <PriorityRulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {toast ? (
        <div className="tv-toast" role="status">
          <CheckCircle2 aria-hidden="true" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
