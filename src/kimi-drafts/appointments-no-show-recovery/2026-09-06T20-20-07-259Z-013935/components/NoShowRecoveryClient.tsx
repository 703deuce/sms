"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  ScanSearch,
  Workflow,
} from "lucide-react";
import type { NoShowRow } from "../mock-data";

type Config = {
  enabled: boolean;
  graceMinutes: number;
  autoInstallWorkflow: boolean;
  notifyTeam: boolean;
  followUpChannel: "sms" | "sms_email";
};

type Stats = {
  noShowsLast30Days: number;
  recoveredBookings: number;
  workflowInstalled: boolean;
  lastScanAt: string;
};

type LoadState = "loading" | "ready" | "error";

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="nsr-switch" aria-label={label} aria-disabled={disabled || undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="nsr-switch-track" />
    </label>
  );
}

function StatusBadge({ status }: { status: NoShowRow["status"] }) {
  if (status === "Rebooked")
    return <span className="nsr-badge nsr-badge-success"><span className="nsr-badge-dot" />Rebooked</span>;
  if (status === "Replied")
    return <span className="nsr-badge nsr-badge-info"><span className="nsr-badge-dot" />Replied</span>;
  if (status === "Recovery sent")
    return <span className="nsr-badge nsr-badge-warn"><span className="nsr-badge-dot" />Recovery sent</span>;
  return <span className="nsr-badge nsr-badge-neutral"><span className="nsr-badge-dot" />No response</span>;
}

export function NoShowRecoveryClient({
  stats,
  initialConfig,
  recentNoShows,
  readOnly,
  onOpenInstall,
  onOpenScan,
  onOpenAppointment,
}: {
  stats: Stats;
  initialConfig: Config;
  recentNoShows: NoShowRow[];
  readOnly: boolean;
  onOpenInstall: () => void;
  onOpenScan: () => void;
  onOpenAppointment: (row: NoShowRow) => void;
}) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");

  // Simulated initial load (mirrors GET /api/appointments/no-show-recovery)
  const load = useCallback(async () => {
    setLoadState("loading");
    await new Promise((r) => setTimeout(r, 500));
    setLoadState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // onClick={save} disabled={saving} — POST { config }
  async function save() {
    setSaving(true);
    setSavedAt(null);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setSavedAt("Saved just now");
    window.setTimeout(() => setSavedAt(null), 4000);
  }

  const filtered = recentNoShows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.customer.toLowerCase().includes(q) ||
      r.bookingType.toLowerCase().includes(q)
    );
  });

  if (loadState === "loading") {
    return (
      <div className="nsr-page" aria-busy="true">
        <div className="nsr-header">
          <div>
            <div className="nsr-eyebrow">Appointments / No-show recovery</div>
            <h1 className="nsr-title">No-show recovery</h1>
          </div>
        </div>
        <div className="nsr-stats">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nsr-stat" style={{ minHeight: 92 }}>
              <div style={{ height: 11, width: 90, background: "#eef0f3", borderRadius: 6 }} />
              <div style={{ height: 26, width: 48, background: "#eef0f3", borderRadius: 6, marginTop: 12 }} />
            </div>
          ))}
        </div>
        <div className="nsr-card nsr-section" style={{ minHeight: 260 }}>
          <div style={{ height: 14, width: 160, background: "#eef0f3", borderRadius: 6 }} />
          <div style={{ height: 12, width: "70%", background: "#eef0f3", borderRadius: 6, marginTop: 18 }} />
          <div style={{ height: 12, width: "55%", background: "#eef0f3", borderRadius: 6, marginTop: 14 }} />
          <div style={{ height: 12, width: "62%", background: "#eef0f3", borderRadius: 6, marginTop: 14 }} />
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="nsr-page">
        <div className="nsr-header">
          <div>
            <div className="nsr-eyebrow">Appointments / No-show recovery</div>
            <h1 className="nsr-title">No-show recovery</h1>
          </div>
        </div>
        <div className="nsr-card nsr-section">
          <div className="nsr-empty">
            <div className="nsr-empty-icon"><AlertCircle size={20} /></div>
            <div className="nsr-empty-title">No-show recovery settings couldn’t be loaded</div>
            <div className="nsr-empty-sub">
              Your scanner configuration and recent no-show activity aren’t available right now. Existing settings haven’t changed.
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="nsr-btn nsr-btn-primary" onClick={load}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nsr-page">
      {/* Page header */}
      <div className="nsr-header">
        <div>
          <div className="nsr-eyebrow">
            Appointments / <a href="#">Recalls</a> / No-show recovery
          </div>
          <h1 className="nsr-title">No-show recovery</h1>
          <p className="nsr-sub">
            Automatically detect missed appointments and follow up with customers through the no-show recovery workflow, so empty slots turn back into bookings.
          </p>
        </div>
        <div className="nsr-header-actions">
          <button className="nsr-btn nsr-btn-outline" onClick={onOpenScan} disabled={saving || !config.enabled || readOnly}>
            <Play size={14} /> Run scan now
          </button>
          <button className="nsr-btn nsr-btn-primary" onClick={save} disabled={saving || readOnly}>
            {saving ? <Loader2 size={14} style={{ animation: "nsrSpin .8s linear infinite" }} /> : <Check size={14} />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="nsr-stats">
        <div className="nsr-stat">
          <div className="nsr-stat-label">No-shows (30 days)</div>
          <div className="nsr-stat-value">{stats.noShowsLast30Days}</div>
          <div className="nsr-stat-hint">Last scan: {stats.lastScanAt}</div>
        </div>
        <div className="nsr-stat">
          <div className="nsr-stat-label">Recovered bookings</div>
          <div className="nsr-stat-value">{stats.recoveredBookings}</div>
          <div className="nsr-stat-hint">Customers who rebooked after follow-up</div>
        </div>
        <div className="nsr-stat">
          <div className="nsr-stat-label">Recovery workflow</div>
          <div className="nsr-stat-value-sm">
            {stats.workflowInstalled ? (
              <span className="nsr-badge nsr-badge-success"><span className="nsr-badge-dot" />Installed</span>
            ) : (
              <span className="nsr-badge nsr-badge-warn"><span className="nsr-badge-dot" />Not installed</span>
            )}
          </div>
          <div className="nsr-stat-hint">
            {stats.workflowInstalled ? (
              <button className="nsr-link" onClick={onOpenInstall}>
                View template <ExternalLink size={11} />
              </button>
            ) : (
              "Required to send automatic follow-ups"
            )}
          </div>
        </div>
      </div>

      {/* Read-only / permission state */}
      {readOnly && (
        <div className="nsr-banner nsr-banner-info">
          <span className="nsr-banner-icon" style={{ color: "var(--info)" }}>
            <Lock size={17} />
          </span>
          <div className="nsr-banner-body">
            <div className="nsr-banner-title">Read-only access</div>
            You can view no-show recovery settings and activity, but only workspace admins can change them. Contact an admin to adjust the scanner or workflow.
          </div>
        </div>
      )}

      {/* Workflow install banner (exception state gets prominence) */}
      {!stats.workflowInstalled && (
        <div className="nsr-banner nsr-banner-warn">
          <span className="nsr-banner-icon" style={{ color: "var(--warning)" }}>
            <Workflow size={17} />
          </span>
          <div className="nsr-banner-body">
            <div className="nsr-banner-title">No-show recovery workflow isn’t installed</div>
            The scanner can mark no-shows, but customers won’t receive any follow-up until the recovery workflow template is installed. Review the two-step template and install it in one click.
            <div className="nsr-banner-actions">
              <button className="nsr-btn nsr-btn-primary nsr-btn-sm" onClick={onOpenInstall} disabled={saving}>
                Review and install workflow <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {config.enabled === false && (
        <div className="nsr-banner nsr-banner-info">
          <span className="nsr-banner-icon" style={{ color: "var(--info)" }}>
            <ScanSearch size={17} />
          </span>
          <div className="nsr-banner-body">
            <div className="nsr-banner-title">Automatic detection is off</div>
            No-shows won’t be marked automatically while this is disabled. You can still mark no-shows manually from any appointment’s detail page.
          </div>
        </div>
      )}

      {/* Scanner settings */}
      <div className="nsr-card nsr-section">
        <div className="nsr-card-head">
          <div>
            <div className="nsr-card-title">Scanner settings</div>
            <div className="nsr-card-desc">
              Controls when appointments are marked as no-shows and how customers are followed up with. Applies workspace-wide to all booking types.
            </div>
          </div>
        </div>

        <div className="nsr-row">
          <div>
            <div className="nsr-row-label">Automatic no-show detection</div>
            <div className="nsr-row-desc">
              A background scan checks past appointments and marks them as no-shows when the customer didn’t arrive or check in.
            </div>
          </div>
          <Switch
            label="Enable automatic no-show detection"
            checked={config.enabled}
            disabled={readOnly}
            onChange={(v) => setConfig({ ...config, enabled: v })}
          />
        </div>

        <div className="nsr-field">
          <label className="nsr-label" htmlFor="grace">Grace period before marking a no-show</label>
          <div className="nsr-input-group">
            <input
              id="grace"
              className="nsr-input"
              type="number"
              min={5}
              max={120}
              value={config.graceMinutes}
              disabled={readOnly}
              onChange={(e) =>
                setConfig({ ...config, graceMinutes: Math.min(120, Math.max(5, Number(e.target.value) || 30)) })
              }
            />
            <span className="nsr-input-suffix">minutes after the scheduled start time</span>
          </div>
          <div className="nsr-help">Between 5 and 120 minutes. A buffer avoids flagging customers who arrive a few minutes late.</div>
        </div>

        <div className="nsr-field">
          <label className="nsr-label" htmlFor="channel">Follow-up channel</label>
          <select
            id="channel"
            className="nsr-select"
            value={config.followUpChannel}
            disabled={readOnly}
            onChange={(e) => setConfig({ ...config, followUpChannel: e.target.value as Config["followUpChannel"] })}
          >
            <option value="sms">SMS only</option>
            <option value="sms_email">SMS + email</option>
          </select>
          <div className="nsr-help">
            SMS follow-ups are only sent to contacts who have opted in to appointment texts. Opted-out contacts are skipped automatically.
          </div>
        </div>

        <div className="nsr-row">
          <div>
            <div className="nsr-row-label">Auto-install workflow template</div>
            <div className="nsr-row-desc">
              When enabled, the No-Show Recovery workflow template is installed automatically the first time a no-show is detected.
            </div>
          </div>
          <Switch
            label="Auto-install no-show recovery workflow template"
            checked={config.autoInstallWorkflow}
            disabled={readOnly}
            onChange={(v) => setConfig({ ...config, autoInstallWorkflow: v })}
          />
        </div>

        <div className="nsr-row">
          <div>
            <div className="nsr-row-label">Notify the team on recovery</div>
            <div className="nsr-row-desc">
              Send an internal note to the assigned staff member when a customer rebooks through the recovery workflow.
            </div>
          </div>
          <Switch
            label="Notify team when a no-show is recovered"
            checked={config.notifyTeam}
            disabled={readOnly}
            onChange={(v) => setConfig({ ...config, notifyTeam: v })}
          />
        </div>

        <div className="nsr-actions">
          <button className="nsr-btn nsr-btn-primary" onClick={save} disabled={saving || readOnly}>
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button className="nsr-btn nsr-btn-outline" onClick={onOpenScan} disabled={saving || !config.enabled || readOnly}>
            Run scan now
          </button>
          {!stats.workflowInstalled && (
            <button className="nsr-btn nsr-btn-outline" onClick={onOpenInstall} disabled={saving}>
              Install workflow
            </button>
          )}
          {savedAt && (
            <span className="nsr-save-note" role="status">
              <CheckCircle2 size={14} /> {savedAt}
            </span>
          )}
        </div>
      </div>

      {/* Recent no-shows */}
      <div className="nsr-card nsr-section">
        <div className="nsr-card-head">
          <div>
            <div className="nsr-card-title">Recent no-shows</div>
            <div className="nsr-card-desc">Appointments flagged as no-shows in the last 30 days and their recovery state.</div>
          </div>
          <input
            className="nsr-input"
            style={{ width: 200 }}
            placeholder="Search customer or type…"
            aria-label="Search no-shows"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {recentNoShows.length === 0 ? (
          <div className="nsr-empty">
            <div className="nsr-empty-icon"><CheckCircle2 size={20} /></div>
            <div className="nsr-empty-title">No no-shows yet</div>
            <div className="nsr-empty-sub">
              When appointments pass their grace period without the customer arriving, they’ll appear here with their recovery status.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="nsr-empty">
            <div className="nsr-empty-icon"><ScanSearch size={20} /></div>
            <div className="nsr-empty-title">No results for “{query}”</div>
            <div className="nsr-empty-sub">Try a different customer name or booking type.</div>
          </div>
        ) : (
          <div className="nsr-table-wrap">
            <table className="nsr-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Booking type</th>
                  <th scope="col">Scheduled for</th>
                  <th scope="col">Recovery status</th>
                  <th scope="col"><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="nsr-cell-primary">{row.customer}</td>
                    <td>{row.bookingType}</td>
                    <td>{row.scheduledFor} <span style={{ color: "var(--text-3)", fontSize: 12 }}>EDT</span></td>
                    <td><StatusBadge status={row.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="nsr-btn nsr-btn-ghost nsr-btn-sm"
                        onClick={() => onOpenAppointment(row)}
                        aria-label={`Open recovery details for ${row.customer}`}
                      >
                        Open appointment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
