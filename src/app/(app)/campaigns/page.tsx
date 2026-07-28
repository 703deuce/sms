"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
  TableToolbar,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { campaigns } from "@/lib/mock/data";
import type { Campaign } from "@/lib/types";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  FilePen,
  LayoutGrid,
  LayoutList,
  Megaphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const campaignIconTones: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-600",
  Scheduled: "bg-sky-50 text-sky-600",
  Draft: "bg-slate-100 text-slate-500",
  Failed: "bg-rose-50 text-rose-600",
  Sending: "bg-amber-50 text-amber-600",
};

const typeIcons: Record<string, LucideIcon> = {
  Promotion: Tag,
  Reminder: Bell,
  Announcement: Megaphone,
  Alert: AlertTriangle,
};

function formatScheduled(at: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function deliveryRate(campaign: Campaign) {
  if (campaign.sent === 0) return null;
  return (campaign.delivered / campaign.sent) * 100;
}

export default function CampaignsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const scheduledCount = campaigns.filter((c) => c.status === "Scheduled").length;
  const draftCount = campaigns.filter((c) => c.status === "Draft").length;

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={Megaphone}
        title="Campaigns"
        description="Create, schedule, and track outbound SMS campaigns across audiences and segments."
        actions={
          <>
            <Link href="/campaigns/recurring">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4" />
                Recurring
              </Button>
            </Link>
            <Link href="/send">
              <Button>
                <Plus className="h-4 w-4" />
                New campaign
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Campaigns"
          value={formatNumber(campaigns.length)}
          hint="All time"
          icon={Megaphone}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[2, 3, 3, 4, 4, 5, 5, campaigns.length]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Scheduled"
          value={formatNumber(scheduledCount)}
          hint="Next 7 days"
          icon={CalendarClock}
          tone="bg-sky-50 text-sky-600"
          sparkline={[0, 1, 1, 2, 1, 2, 1, scheduledCount]}
          sparkColor="#0ea5e9"
        />
        <MetricCard
          label="Drafts"
          value={formatNumber(draftCount)}
          hint="In progress"
          icon={FilePen}
          tone="bg-violet-50 text-violet-600"
          sparkline={[1, 2, 1, 2, 2, 1, 2, draftCount]}
          sparkColor="#8b5cf6"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <TableToolbar title="All campaigns" searchPlaceholder="Search campaigns...">
          <Button variant="outline" size="sm" className="text-[13px]">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <div className="flex items-center rounded-[10px] border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </TableToolbar>

        {viewMode === "list" ? (
          <Table className="text-[13px]">
            <THead>
              <TR>
                <TH className="w-12" />
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Audience</TH>
                <TH>Scheduled</TH>
                <TH>Status</TH>
                <TH>Sent</TH>
                <TH>Delivered</TH>
                <TH>Replies</TH>
                <TH>Clicks</TH>
                <TH>Opt-outs</TH>
                <TH>Created By</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {campaigns.map((campaign) => {
                const rate = deliveryRate(campaign);
                const TypeIcon = typeIcons[campaign.type] ?? Megaphone;
                return (
                  <TR key={campaign.id}>
                    <TD>
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full",
                          campaignIconTones[campaign.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        <TypeIcon className="h-4 w-4" />
                      </span>
                    </TD>
                    <TD>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {campaign.name}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{campaign.type}</TD>
                    <TD className="max-w-[160px] text-muted-foreground">{campaign.audience}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatScheduled(campaign.scheduledAt)}
                    </TD>
                    <TD>
                      <StatusChip status={campaign.status} />
                    </TD>
                    <TD>{formatNumber(campaign.sent)}</TD>
                    <TD>
                      <div className="leading-tight">
                        <div className="font-medium tabular-nums">
                          {formatNumber(campaign.delivered)}
                        </div>
                        {rate != null ? (
                          <div
                            className={cn(
                              "text-[11px] tabular-nums",
                              rate < 50 ? "text-rose-600" : "text-emerald-600",
                            )}
                          >
                            {formatPercent(rate)}
                          </div>
                        ) : null}
                      </div>
                    </TD>
                    <TD>{formatNumber(campaign.replies)}</TD>
                    <TD>{formatNumber(campaign.clicks)}</TD>
                    <TD>{formatNumber(campaign.optOuts)}</TD>
                    <TD className="text-muted-foreground">{campaign.createdBy}</TD>
                    <TD>
                      <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More actions</span>
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const TypeIcon = typeIcons[campaign.type] ?? Megaphone;
              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="rounded-[12px] border border-border p-4 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        campaignIconTones[campaign.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      <TypeIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{campaign.name}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {campaign.type} · {campaign.audience}
                      </p>
                      <div className="mt-3">
                        <StatusChip status={campaign.status} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <PaginationBar
          rangeLabel={`1–${campaigns.length} of ${campaigns.length}`}
        />
      </Card>
    </div>
  );
}
