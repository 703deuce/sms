import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric";
import type {
  RealtorAmyActivityItem,
  RealtorAttentionKind,
  RealtorDashboardAppointment,
  RealtorLeadRow,
  RealtorNeedsAttentionItem,
} from "@/lib/realtor/types";
import { formatPhone } from "@/lib/utils";
import { CheckCircle2, Phone } from "lucide-react";
import Link from "next/link";

function attentionLabel(kind: RealtorAttentionKind): string {
  switch (kind) {
    case "hot_buyer":
      return "HOT BUYER";
    case "transfer_missed":
      return "TRANSFER MISSED";
    case "ai_needs_help":
      return "AI NEEDS HELP";
    default:
      return "NEEDS YOU";
  }
}

function AttentionCard({ item }: { item: RealtorNeedsAttentionItem }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
        {attentionLabel(item.kind)}
      </p>
      <p className="mt-2 text-lg font-semibold">{item.leadName}</p>
      <p className="text-sm text-foreground">{item.reason}</p>
      <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
      {item.subtitle ? (
        <p className="mt-2 text-sm capitalize text-muted-foreground">{item.subtitle}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.leadId ? (
          <Link
            href={`/phone?contact=${item.leadId}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </Link>
        ) : null}
        <Link
          href={item.href}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          View Lead
        </Link>
      </div>
    </Card>
  );
}

function ActivityRow({ item }: { item: RealtorAmyActivityItem }) {
  const body = (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {item.kind === "calling"
            ? "Calling"
            : item.kind === "following_up"
              ? "Following Up"
              : item.kind === "inbound"
                ? "Inbound Call"
                : item.kind === "waiting"
                  ? "Waiting"
                  : "Amy"}
        </p>
        <p className="font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.detail}</p>
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block rounded-lg transition hover:bg-muted/40">
        {body}
      </Link>
    );
  }
  return body;
}

export function RealtorDashboardView({
  greeting,
  amyWorkedSummary,
  amy,
  metrics,
  metricHrefs,
  needsAttention,
  amyActivity,
  appointments,
  recentLeads,
}: {
  greeting: string;
  amyWorkedSummary: string;
  amy: {
    frontDeskActive: boolean;
    speedToLeadActive: boolean;
  };
  metrics: {
    newLeads: number;
    worked: number;
    conversations: number;
    qualified: number;
    appointments: number;
  };
  metricHrefs: Record<string, string>;
  needsAttention: RealtorNeedsAttentionItem[];
  amyActivity: RealtorAmyActivityItem[];
  appointments: RealtorDashboardAppointment[];
  recentLeads: RealtorLeadRow[];
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{amyWorkedSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${amy.frontDeskActive ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
            Front Desk
            <span className="text-muted-foreground">
              {amy.frontDeskActive ? "Active" : "Off"}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${amy.speedToLeadActive ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
            Speed-to-Lead
            <span className="text-muted-foreground">
              {amy.speedToLeadActive ? "Active" : "Off"}
            </span>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Needs Your Attention</h2>
        {needsAttention.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {needsAttention.slice(0, 6).map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Card className="border-primary/20 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">You&apos;re caught up. Amy is handling everything.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New escalations, transfer requests, and follow-ups will appear here first.
                </p>
              </div>
            </div>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Amy Working Now</h2>
        <Card className="p-4">
          {amyActivity.length ? (
            <div>{amyActivity.map((item) => <ActivityRow key={item.id} item={item} />)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Amy is ready — waiting for the next inbound call or speed-to-lead trigger.
            </p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Results</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="New Leads" value={metrics.newLeads} href={metricHrefs.newLeads} />
          <MetricCard label="Worked" value={metrics.worked} href={metricHrefs.worked} />
          <MetricCard
            label="Conversations"
            value={metrics.conversations}
            href={metricHrefs.conversations}
          />
          <MetricCard label="Qualified" value={metrics.qualified} href={metricHrefs.qualified} />
          <MetricCard
            label="Appointments"
            value={metrics.appointments}
            href={metricHrefs.appointments}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming Appointments</h2>
        <Card className="divide-y">
          {appointments.length ? (
            appointments.map((appt) => (
              <div key={appt.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {new Date(appt.startsAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" — "}
                    {appt.serviceName}
                  </p>
                  <p className="text-sm text-muted-foreground">{appt.leadName}</p>
                </div>
                {appt.leadId ? (
                  <Link
                    href={`/realtor/leads/${appt.leadId}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    View Lead
                  </Link>
                ) : null}
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Leads</h2>
          <Link href="/realtor/leads" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        <Card className="divide-y">
          {recentLeads.length ? (
            recentLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/realtor/leads/${lead.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-muted/30"
              >
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {lead.intent || lead.status}
                    {lead.subtitle ? ` • ${lead.subtitle}` : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{formatPhone(lead.phone)}</p>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No leads yet"
              description="When Amy works a lead, it will show up here with full context."
              actionLabel="Add test lead"
              actionHref="/realtor/test"
            />
          )}
        </Card>
      </section>
    </div>
  );
}
