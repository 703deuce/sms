import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  SectionHeader,
} from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import {
  Bell,
  Cake,
  CalendarDays,
  Check,
  CheckCircle2,
  Filter,
  Layers,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  LineChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const recurringCampaigns: Array<{
  id: string;
  name: string;
  type: string;
  audience: string;
  frequency: string;
  nextRun: string;
  lastRun: string;
  status: "Active" | "Paused";
  sentTotal: number;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    id: "rec_1",
    name: "Weekly appointment reminders",
    type: "Reminder",
    audience: "Customers with upcoming visits",
    frequency: "Every Monday at 9:00 AM",
    nextRun: "2026-07-28T09:00:00Z",
    lastRun: "2026-07-21T09:00:00Z",
    status: "Active",
    sentTotal: 2840,
    icon: CalendarDays,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "rec_2",
    name: "Monthly service newsletter",
    type: "Promotion",
    audience: "All subscribed",
    frequency: "1st of each month at 10:00 AM",
    nextRun: "2026-08-01T10:00:00Z",
    lastRun: "2026-07-01T10:00:00Z",
    status: "Active",
    sentTotal: 6120,
    icon: Mail,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    id: "rec_3",
    name: "Birthday greetings",
    type: "Announcement",
    audience: "Birthday segment",
    frequency: "Daily at 8:00 AM",
    nextRun: "2026-07-28T08:00:00Z",
    lastRun: "2026-07-27T08:00:00Z",
    status: "Active",
    sentTotal: 412,
    icon: Cake,
    tone: "bg-pink-50 text-pink-600",
  },
  {
    id: "rec_4",
    name: "Quarterly NPS survey",
    type: "Survey",
    audience: "VIP",
    frequency: "Every 90 days",
    nextRun: "2026-10-01T11:00:00Z",
    lastRun: "2026-07-03T11:00:00Z",
    status: "Paused",
    sentTotal: 176,
    icon: LineChart,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    id: "rec_5",
    name: "End-of-day dispatch updates",
    type: "Alert",
    audience: "Employees",
    frequency: "Weekdays at 4:30 PM",
    nextRun: "2026-07-28T16:30:00Z",
    lastRun: "2026-07-25T16:30:00Z",
    status: "Active",
    sentTotal: 960,
    icon: Bell,
    tone: "bg-amber-50 text-amber-600",
  },
];

function formatDateTime(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CampaignRecurringPage() {
  const activeCount = recurringCampaigns.filter((c) => c.status === "Active").length;
  const lifetime = recurringCampaigns.reduce((sum, c) => sum + c.sentTotal, 0);

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={RefreshCw}
        title="Recurring campaigns"
        description="Automated sends that repeat on a schedule. Each run uses current audience membership and compliance settings."
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline" className="rounded-[10px]">
                All campaigns
              </Button>
            </Link>
            <Link href="/send">
              <Button className="rounded-[10px]">
                <Plus className="h-4 w-4" />
                Create recurring
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Recurring Flows"
          value={formatNumber(recurringCampaigns.length)}
          icon={Layers}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Active"
          value={formatNumber(activeCount)}
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Messages Sent (Lifetime)"
          value={formatNumber(lifetime)}
          icon={MessageSquare}
          tone="bg-emerald-50 text-emerald-600"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-bold text-foreground">Recurring schedule</h2>
          <Button variant="outline" size="sm" className="rounded-[10px]">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px] text-[13px]">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Audience</TH>
                <TH>Frequency</TH>
                <TH>Next run</TH>
                <TH>Last run</TH>
                <TH>Status</TH>
                <TH>Total sent</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {recurringCampaigns.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <span className="inline-flex items-center gap-2.5 font-semibold">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-[8px] ${c.tone}`}
                      >
                        <c.icon className="h-4 w-4" />
                      </span>
                      {c.name}
                    </span>
                  </TD>
                  <TD className="text-muted-foreground">{c.type}</TD>
                  <TD className="max-w-[180px] text-muted-foreground">{c.audience}</TD>
                  <TD className="whitespace-nowrap">{c.frequency}</TD>
                  <TD className="whitespace-nowrap font-medium">{formatDateTime(c.nextRun)}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(c.lastRun)}
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          c.status === "Active" ? "bg-emerald-500" : "bg-orange-400"
                        }`}
                      />
                      {c.status}
                    </span>
                  </TD>
                  <TD className="tabular-nums font-medium">{formatNumber(c.sentTotal)}</TD>
                  <TD>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label={`Actions for ${c.name}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      <div className="mt-5 flex gap-4 rounded-[12px] border border-emerald-200 bg-emerald-50/80 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <RefreshCw className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-emerald-950">How recurring campaigns work</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-emerald-900/80">
            {[
              "Audience is re-evaluated before each run — new subscribers are included automatically.",
              "Quiet hours and A2P limits apply to every scheduled occurrence.",
              "Paused flows retain their schedule but skip runs until reactivated.",
              "Each run creates a child campaign record visible under Completed or Failed.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
