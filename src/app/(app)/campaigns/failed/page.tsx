import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { campaigns } from "@/lib/mock/data";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MoreVertical,
  PhoneOff,
  Shield,
  ShieldAlert,
  Signal,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const failureReasons: Array<{
  reason: string;
  count: number;
  description: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    reason: "Invalid number",
    count: 12,
    description: "Landline, disconnected, or malformed phone numbers.",
    icon: PhoneOff,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    reason: "Unsubscribed",
    count: 8,
    description: "Contacts opted out before or during the send window.",
    icon: UserX,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    reason: "Insufficient balance",
    count: 0,
    description: "Credits dropped below the minimum threshold.",
    icon: Wallet,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    reason: "Carrier rejection",
    count: 14,
    description: "Blocked by carrier spam filters or content policies.",
    icon: Signal,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    reason: "A2P registration",
    count: 4,
    description: "10DLC traffic rejected due to pending registration.",
    icon: ShieldAlert,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    reason: "Quiet hours",
    count: 2,
    description: "Blocked by account quiet-hour or timezone policy.",
    icon: Clock,
    tone: "bg-violet-50 text-violet-600",
  },
];

const recommended = [
  {
    title: "Validate audience numbers",
    detail: "Remove invalid and landline contacts before retrying Storm Alert.",
    icon: AlertTriangle,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    title: "Complete A2P registration",
    detail: "Pending brand registration may cause carrier rejections.",
    icon: ShieldAlert,
    tone: "bg-orange-50 text-orange-600",
    link: { href: "/compliance", label: "Open compliance" },
  },
  {
    title: "Review quiet-hour settings",
    detail: "Early-morning alerts may be blocked in recipient time zones.",
    icon: Clock,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    title: "Monitor credits and limits",
    detail: "Keep a buffer so mid-send pauses don’t strand undelivered messages.",
    icon: BarChart3,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Check content and templates",
    detail: "Carrier filters often flag promotional language without clear opt-out.",
    icon: FileText,
    tone: "bg-sky-50 text-sky-600",
  },
];

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

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  border,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  border: string;
}) {
  return (
    <div className={cn("surface rounded-[12px] border-b-2 bg-card p-4", border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-[22px] font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function CampaignFailedPage() {
  const failed = campaigns.filter((c) => c.status === "Failed");
  const totalFailedMessages = failureReasons.reduce((sum, r) => sum + r.count, 0);
  const totalSent = failed.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = failed.reduce((sum, c) => sum + c.delivered, 0);
  const failureRate = totalSent > 0 ? ((totalSent - totalDelivered) / totalSent) * 100 : 0;
  const totalCost = failed.reduce((sum, c) => sum + c.cost, 0);

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Failed campaigns"
        description="Campaigns that did not complete successfully. Review failure reasons and retry eligible contacts."
        actions={
          <Link href="/compliance">
            <Button variant="outline" className="rounded-[10px]">
              <Shield className="h-4 w-4" />
              Compliance center
            </Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Failed Campaigns"
          value={formatNumber(failed.length)}
          hint="Total campaigns"
          icon={XCircle}
          tone="bg-rose-50 text-rose-600"
          border="border-rose-400"
        />
        <StatTile
          label="Undelivered"
          value={formatNumber(totalFailedMessages)}
          hint="Messages not delivered"
          icon={CircleAlert}
          tone="bg-orange-50 text-orange-600"
          border="border-orange-400"
        />
        <StatTile
          label="Failure Rate"
          value={formatPercent(failureRate)}
          hint={`${formatNumber(totalDelivered)} of ${formatNumber(totalSent)} delivered`}
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-600"
          border="border-rose-400"
        />
        <StatTile
          label="Cost Incurred"
          value={formatCurrency(totalCost)}
          hint="Total cost for failed sends"
          icon={Wallet}
          tone="bg-violet-50 text-violet-600"
          border="border-violet-400"
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[12px] p-4">
          <h2 className="text-[14px] font-bold text-foreground">Failure reasons</h2>
          <ul className="mt-4 space-y-2.5">
            {failureReasons.map((item) => (
              <li
                key={item.reason}
                className="flex items-start justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                      item.tone,
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{item.reason}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[16px] font-bold tabular-nums">
                  {formatNumber(item.count)}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
          >
            View detailed failure report
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </Card>

        <Card className="rounded-[12px] p-4">
          <h2 className="text-[14px] font-bold text-foreground">Recommended actions</h2>
          <ul className="mt-4 space-y-2">
            {recommended.map((item) => (
              <li key={item.title}>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border px-3 py-2.5 hover:bg-muted/40">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                      item.tone,
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{item.detail}</p>
                    {item.link ? (
                      <Link
                        href={item.link.href}
                        className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                      >
                        {item.link.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-bold text-foreground">
            {failed.length} failed
          </h2>
          <Button variant="outline" size="sm" className="rounded-[10px]">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
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
              {failed.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-semibold text-rose-600 hover:underline"
                    >
                      {c.name}
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
                  <TD className="tabular-nums">{formatNumber(c.sent)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.delivered)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.replies)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.clicks)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.optOuts)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span>{c.createdBy}</span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                        aria-label="More"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <PaginationBar
          rangeLabel={`Showing ${failed.length} of ${failed.length} campaign${failed.length === 1 ? "" : "s"}`}
        />
      </Card>
    </div>
  );
}
