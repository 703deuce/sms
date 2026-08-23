"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Pause, Play, X } from "lucide-react";
import { rrOutlineBtn } from "@/components/reputation/review-requests-ui";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  channel: string;
  created_at: string;
  completed_at?: string | null;
  template_id?: string | null;
  email_template_id?: string | null;
  source_template_id?: string | null;
  source_template_version?: string | null;
  send_window_start?: string | null;
  send_window_end?: string | null;
  timezone?: string | null;
  daily_send_limit?: number | null;
  recipients_total: number;
  recipients_ready: number;
  queued: number;
  sent: number;
  delivered?: number;
  failed: number;
  clicked: number;
  opted_out: number;
  reviews_detected?: number | null;
  trigger_type?: string;
  trigger_config?: { eventType?: string } | null;
  enrollments_paused?: boolean;
  next_step_label?: string;
  conversion_rate?: number;
};

function triggerBadge(c: CampaignRow) {
  const t = c.trigger_type ?? "manual";
  if (t === "webhook") {
    const ev = c.trigger_config?.eventType || "service.completed";
    return (
      <span className="text-[11px] text-zinc-600" title={`Webhook — ${ev}`}>
        Webhook
        {c.enrollments_paused ? (
          <span className="ml-1 text-amber-700">(paused)</span>
        ) : null}
      </span>
    );
  }
  if (t === "api") return <span className="text-[11px] text-zinc-600">API</span>;
  return <span className="text-[11px] text-zinc-600">Manual</span>;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700",
    scheduled: "bg-blue-50 text-blue-700",
    active: "bg-emerald-50 text-emerald-700",
    paused: "bg-amber-50 text-amber-700",
    completed: "bg-zinc-100 text-zinc-600",
    cancelled: "bg-red-50 text-red-700",
    failed: "bg-red-50 text-red-700",
    archived: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        styles[status] ?? styles.draft
      )}
    >
      {status}
    </span>
  );
}

export function ReviewRequestsCampaignsTable({
  businessId,
  refreshKey = 0,
  campaigns: controlledCampaigns,
  loading: controlledLoading,
  onRefresh,
  emptyMessage = "No campaigns yet. Create one from Campaigns or import customers with a CSV.",
  title = "Campaigns",
  description = "Paced SMS/email requests — clicks tracked, not review attribution.",
  resultColumns = false,
}: {
  businessId: string;
  refreshKey?: number;
  campaigns?: CampaignRow[];
  loading?: boolean;
  onRefresh?: () => Promise<void> | void;
  emptyMessage?: string;
  title?: string;
  description?: string;
  resultColumns?: boolean;
}) {
  const [localCampaigns, setLocalCampaigns] = useState<CampaignRow[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isControlled = controlledCampaigns !== undefined;
  const campaigns = controlledCampaigns ?? localCampaigns;
  const loading = controlledLoading ?? (!isControlled && localLoading);

  const load = useCallback(async () => {
    if (isControlled) {
      await onRefresh?.();
      return;
    }
    setLocalLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/review-requests/campaigns?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load campaigns");
      setLocalCampaigns(json.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns");
      setLocalCampaigns([]);
    } finally {
      setLocalLoading(false);
    }
  }, [businessId, isControlled, onRefresh]);

  useEffect(() => {
    if (isControlled) return;
    void load();
  }, [isControlled, load, refreshKey]);

  async function action(campaignId: string, act: string) {
    setMenuId(null);
    setError(null);
    const res = await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : `Failed to ${act} campaign`);
      return;
    }
    await load();
  }

  async function duplicate(campaignId: string) {
    setMenuId(null);
    setError(null);
    const res = await fetch("/api/reputation/review-requests/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, duplicateFrom: campaignId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Failed to duplicate campaign");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div
        className={cn(
          dashboardCard,
          "border-dashed px-3.5 py-8 text-center text-[13px] text-zinc-500"
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn(dashboardCard, "overflow-hidden")}>
      {error && (
        <div className="border-b border-red-100 bg-red-50 px-3.5 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <h3 className={dashboardCardTitle}>{title}</h3>
        <p className={dashboardMicro}>{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3.5 py-2">Campaign</th>
              <th className="px-3.5 py-2">Trigger</th>
              <th className="px-3.5 py-2">Status</th>
              <th className="px-3.5 py-2">Channel</th>
              <th className="px-3.5 py-2 text-right">Recipients</th>
              {resultColumns ? (
                <>
                  <th className="px-3.5 py-2 text-right">Sent</th>
                  <th className="px-3.5 py-2 text-right">Delivered</th>
                  <th className="px-3.5 py-2 text-right">Clicked</th>
                  <th className="px-3.5 py-2 text-right">Reviews</th>
                  <th className="px-3.5 py-2 text-right">Opt-outs</th>
                </>
              ) : (
                <>
                  <th className="px-3.5 py-2 text-right">Queued</th>
                  <th className="px-3.5 py-2 text-right">Sent</th>
                  <th className="px-3.5 py-2 text-right">Failed</th>
                  <th className="px-3.5 py-2 text-right">Clicked</th>
                </>
              )}
              <th className="px-3.5 py-2">Created</th>
              <th className="px-3.5 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50/80">
                <td className="px-3.5 py-2 font-medium text-zinc-900">
                  <Link
                    href={`/businesses/${businessId}/reputation/campaigns/${c.id}`}
                    className="hover:text-emerald-700 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3.5 py-2">{triggerBadge(c)}</td>
                <td className="px-3.5 py-2">{statusBadge(c.status)}</td>
                <td className="px-3.5 py-2 capitalize text-zinc-600">{c.channel}</td>
                <td className="px-3.5 py-2 text-right tabular-nums">{c.recipients_ready}</td>
                {resultColumns ? (
                  <>
                    <td className="px-3.5 py-2 text-right tabular-nums text-emerald-700">{c.sent}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{c.delivered ?? "—"}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{c.clicked}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">
                      {c.reviews_detected ?? "—"}
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{c.opted_out}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3.5 py-2 text-right tabular-nums">{c.queued}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-emerald-700">{c.sent}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-red-600">{c.failed}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{c.clicked}</td>
                  </>
                )}
                <td className="px-3.5 py-2 text-[11px] text-zinc-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="relative px-3.5 py-2">
                  <button
                    type="button"
                    className={rrOutlineBtn}
                    onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuId === c.id && (
                    <div className="absolute right-3 z-10 mt-1 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                      <Link
                        href={`/businesses/${businessId}/reputation/campaigns/${c.id}`}
                        className="block px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                        onClick={() => setMenuId(null)}
                      >
                        Open
                      </Link>
                      {c.status === "active" && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                          onClick={() => void action(c.id, "pause")}
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                          onClick={() => void action(c.id, "resume")}
                        >
                          <Play className="h-3 w-3" /> Resume
                        </button>
                      )}
                      {c.status === "draft" && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                          onClick={() => void action(c.id, "start")}
                        >
                          <Play className="h-3 w-3" /> Start
                        </button>
                      )}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                        onClick={() => void duplicate(c.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-zinc-50"
                        onClick={() => void action(c.id, "archive")}
                      >
                        Archive
                      </button>
                      {!["completed", "cancelled", "archived"].includes(c.status) && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                          onClick={() => void action(c.id, "cancel")}
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
