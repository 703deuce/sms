import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { campaigns } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import {
  CalendarClock,
  CalendarPlus,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";

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

function creatorInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CampaignScheduledPage() {
  const scheduled = campaigns
    .filter((c) => c.status === "Scheduled")
    .sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return aTime - bTime;
    });

  const queuedAudience = 1115;
  const next = scheduled[0];

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Scheduled campaigns"
        description="Upcoming sends queued for delivery. Review audience estimates and quiet-hour settings before launch."
        actions={
          <>
            <Link href="/campaigns/calendar">
              <Button variant="outline" className="rounded-[10px]">
                <CalendarClock className="h-4 w-4" />
                Calendar view
              </Button>
            </Link>
            <Link href="/send">
              <Button className="rounded-[10px]">
                <CalendarPlus className="h-4 w-4" />
                Schedule campaign
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Scheduled campaigns"
          value={formatNumber(scheduled.length)}
          hint="Active campaigns"
          icon={CalendarClock}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Queued audience"
          value={formatNumber(queuedAudience)}
          hint="Estimated recipients"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Estimated messages"
          value={formatNumber(queuedAudience)}
          hint="To be delivered"
          icon={MessageSquare}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Next send"
          value={
            next?.scheduledAt
              ? new Date(next.scheduledAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"
          }
          hint={
            next?.scheduledAt
              ? new Date(next.scheduledAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : undefined
          }
          icon={Clock}
          tone="bg-emerald-50 text-emerald-600"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[14px] font-bold text-foreground">
            {scheduled.length} scheduled campaign{scheduled.length === 1 ? "" : "s"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground hover:bg-muted"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" className="rounded-[10px]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </Button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground hover:bg-muted"
              aria-label="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px] text-[13px]">
            <THead>
              <TR>
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
                <TH>Created by</TH>
              </TR>
            </THead>
            <TBody>
              {scheduled.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="inline-flex items-center gap-2.5 font-semibold text-primary hover:underline"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600">
                        <CalendarClock className="h-4 w-4" />
                      </span>
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{c.type}</TD>
                  <TD className="max-w-[160px] text-muted-foreground">{c.audience}</TD>
                  <TD className="whitespace-nowrap font-medium">
                    {formatScheduled(c.scheduledAt)}
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                      <Clock className="h-3 w-3" />
                      {c.status}
                    </span>
                  </TD>
                  <TD className="tabular-nums">{formatNumber(c.sent)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.delivered)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.replies)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.clicks)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.optOuts)}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {creatorInitials(c.createdBy)}
                      </span>
                      {c.createdBy}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <PaginationBar
          rangeLabel={`Showing ${scheduled.length} of ${scheduled.length} campaign${scheduled.length === 1 ? "" : "s"}`}
        />
      </Card>
    </div>
  );
}
