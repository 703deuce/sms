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
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart3,
  CheckCircle2,
  DollarSign,
  LayoutGrid,
  Megaphone,
  MessageSquareReply,
  Search,
  Send,
  SlidersHorizontal,
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

export default function CampaignCompletedPage() {
  const completed = campaigns.filter((c) => c.status === "Completed");
  const totalSent = completed.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = completed.reduce((sum, c) => sum + c.delivered, 0);
  const totalReplies = completed.reduce((sum, c) => sum + c.replies, 0);
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const totalCost = completed.reduce((sum, c) => sum + c.cost, 0);

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Completed campaigns"
        description="Finished sends with full delivery and engagement metrics."
        actions={
          <Link href="/reports/campaigns">
            <Button variant="outline" className="rounded-[10px]">
              <BarChart3 className="h-4 w-4" />
              Campaign reports
            </Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Sent"
          value={formatNumber(totalSent)}
          icon={Send}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Delivered"
          value={formatNumber(totalDelivered)}
          hint={`${formatPercent(deliveryRate)}  ▲ 2.1% vs last 30 days`}
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Replies"
          value={formatNumber(totalReplies)}
          hint="▲ 5.6% vs last 30 days"
          icon={MessageSquareReply}
          tone="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Total Cost"
          value={formatCurrency(totalCost)}
          icon={DollarSign}
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">
              {completed.length} completed
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Delivery and engagement for finished campaigns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-[10px]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground hover:bg-muted"
              aria-label="Layout"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-48 rounded-[10px] border border-border bg-card pl-8 pr-3 text-[12px] outline-none focus:border-primary"
                placeholder="Search campaigns..."
              />
            </div>
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
              {completed.map((c) => {
                const delivPct = c.sent > 0 ? (c.delivered / c.sent) * 100 : 0;
                const replyPct = c.delivered > 0 ? (c.replies / c.delivered) * 100 : 0;
                const clickPct = c.delivered > 0 ? (c.clicks / c.delivered) * 100 : 0;
                const optPct = c.delivered > 0 ? (c.optOuts / c.delivered) * 100 : 0;

                return (
                  <TR key={c.id}>
                    <TD>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="inline-flex items-start gap-2.5 hover:opacity-90"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600">
                          <Megaphone className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-semibold text-foreground">{c.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {c.type} campaign
                          </span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{c.type}</TD>
                    <TD className="text-muted-foreground">{c.audience}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatScheduled(c.scheduledAt)}
                    </TD>
                    <TD>
                      <StatusChip status={c.status} />
                    </TD>
                    <TD className="tabular-nums font-medium">{formatNumber(c.sent)}</TD>
                    <TD>
                      <div className="tabular-nums font-medium">{formatNumber(c.delivered)}</div>
                      <div className="text-[11px] text-emerald-600">{formatPercent(delivPct)}</div>
                    </TD>
                    <TD>
                      <div className="tabular-nums font-medium">{formatNumber(c.replies)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatPercent(replyPct)}</div>
                    </TD>
                    <TD>
                      <div className="tabular-nums font-medium">{formatNumber(c.clicks)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatPercent(clickPct)}</div>
                    </TD>
                    <TD>
                      <div className="tabular-nums font-medium">{formatNumber(c.optOuts)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatPercent(optPct)}</div>
                    </TD>
                    <TD>
                      <div className="font-medium">{c.createdBy}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.scheduledAt
                          ? new Date(c.scheduledAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
        <PaginationBar
          rangeLabel={`Showing ${completed.length} of ${completed.length} campaign${completed.length === 1 ? "" : "s"}`}
        />
      </Card>
    </div>
  );
}
