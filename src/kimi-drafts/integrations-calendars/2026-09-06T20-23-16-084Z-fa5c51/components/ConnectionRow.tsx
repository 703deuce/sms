"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "./ui/cn";
import { ConnectionSettings } from "./ConnectionSettings";
import type { CalendarConnection } from "../mock-data";

const providerBadge: Record<string, { badge: string; bg: string; color: string }> = {
  google: { badge: "G", bg: "#eef4ff", color: "#3538cd" },
  microsoft: { badge: "M", bg: "#f0f9ff", color: "#026aa2" },
};

function formatSync(iso?: string | null) {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `Last synced ${days} day${days === 1 ? "" : "s"} ago`;
}

function formatSubscription(iso?: string) {
  if (!iso) return null;
  const expiry = new Date(iso).getTime();
  if (expiry < Date.now()) return "Change notifications paused — subscription expired";
  const days = Math.ceil((expiry - Date.now()) / 86400000);
  if (days <= 2) return `Change notifications renew in ${days} day${days === 1 ? "" : "s"}`;
  return null;
}

export function ConnectionRow({
  connection,
  busy,
  expanded,
  readOnly = false,
  onToggle,
  onReconnect,
  onSync,
  onVerify,
  onDisconnect,
  onSaveSettings,
}: {
  connection: CalendarConnection;
  busy: string | null;
  expanded: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onReconnect: () => void;
  onSync: () => Promise<void>;
  onVerify: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSaveSettings: (config: NonNullable<CalendarConnection["config"]>) => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const meta = providerBadge[connection.provider];
  const connected = connection.status === "connected";
  const needsReauth = connection.status === "needs_reauth";
  const cfg = connection.config;
  const subscriptionNote = connected ? formatSubscription(cfg?.microsoftSubscription?.expiresAt) : null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--card)] transition-colors",
        needsReauth ? "border-[#fedf89]" : "border-[var(--border)]",
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-[15px] font-bold"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.badge}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13.5px] font-semibold text-[var(--foreground)]">
                {connection.name}
              </p>
              {connected ? <span className="sb-chip sb-chip-success">Connected</span> : null}
              {needsReauth ? (
                <span className="sb-chip sb-chip-warning">
                  <AlertTriangle className="h-3 w-3" /> Needs attention
                </span>
              ) : null}
              {!connected && !needsReauth ? (
                <span className="sb-chip sb-chip-neutral">Pending</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
              {cfg?.email ? `${cfg.email} · ` : ""}
              {formatSync(connection.lastSyncAt)}
            </p>

            {needsReauth ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-[var(--warning-bg)] px-3 py-2">
                <p className="text-[12px] font-medium text-[var(--warning)]">
                  {cfg?.lastVerificationError ??
                    "Authorization expired. New events and changes won't sync until you reconnect."}
                </p>
                {!readOnly ? (
                  <Button size="sm" variant="outline" onClick={onReconnect} disabled={busy != null}>
                    {busy ? <Loader2 className="sb-spin h-3.5 w-3.5" /> : null}
                    Reconnect
                  </Button>
                ) : null}
              </div>
            ) : null}

            {connected && subscriptionNote ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--warning)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {subscriptionNote}
              </p>
            ) : null}

            {connected && cfg?.lastVerificationOk === false && cfg?.lastVerificationError ? (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--warning)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                Last verification: {cfg.lastVerificationError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-none items-center gap-1">
            {connected && !readOnly ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sync now"
                  disabled={syncing}
                  onClick={() => {
                    setSyncing(true);
                    void onSync().finally(() => setSyncing(false));
                  }}
                >
                  <RefreshCw className={cn("h-4 w-4", syncing && "sb-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Verify connection"
                  disabled={verifying}
                  onClick={() => {
                    setVerifying(true);
                    void onVerify().finally(() => setVerifying(false));
                  }}
                >
                  {verifying ? (
                    <Loader2 className="sb-spin h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={expanded ? "Hide connection settings" : "Connection settings"}
              aria-expanded={expanded}
              onClick={onToggle}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </Button>
          </div>
        </div>

        {expanded ? (
          <ConnectionSettings
            connection={connection}
            saving={busy === "save"}
            readOnly={readOnly}
            onSave={onSaveSettings}
          />
        ) : null}
      </div>

      {/* Danger zone — separated from primary actions */}
      {expanded && !readOnly ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Disconnecting stops sync. Existing appointments remain.
          </p>
          {confirmDisconnect ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[var(--danger)]">
                Disconnect {connection.name}?
              </span>
              <Button variant="danger" size="sm" onClick={() => void onDisconnect()}>
                Disconnect
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
              <Unplug className="h-3.5 w-3.5 text-[var(--danger)]" />
              <span className="text-[var(--danger)]">Disconnect</span>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ConnectionRowSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-3.5">
        <div className="sb-skeleton h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="sb-skeleton h-3.5 w-40" />
          <div className="sb-skeleton h-3 w-56" />
        </div>
        <div className="sb-skeleton h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function EmptyConnections({
  googleConfigured,
  microsoftConfigured,
  busy,
  readOnly = false,
  onConnect,
}: {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  busy: string | null;
  readOnly?: boolean;
  onConnect: (p: "google" | "microsoft") => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--info-bg)]">
        <Settings2 className="h-5 w-5 text-[var(--info-text)]" />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-[var(--foreground)]">
        No calendars connected yet
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted-foreground)]">
        Connect a calendar to write new appointments, block busy times, and import existing events.
      </p>
      {!readOnly ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {googleConfigured ? (
            <Button size="sm" onClick={() => onConnect("google")} disabled={busy != null}>
              Connect Google Calendar
            </Button>
          ) : null}
          {microsoftConfigured ? (
            <Button
              size="sm"
              variant={googleConfigured ? "outline" : "primary"}
              onClick={() => onConnect("microsoft")}
              disabled={busy != null}
            >
              Connect Microsoft Outlook
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
