import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { Page, PageHeader, Panel, Pill, Rows, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { RecentCallsTable } from "@/newui-transplant/components/voice/recent-calls-table";
import {
  mapOverviewRecentCallToNewUi,
  overviewMetricsFromResult,
} from "@/lib/newui-transplant/adapters/voice-overview";
import type { VoiceOverviewSummaryResult } from "@/lib/voice/overview-summary";

export function NewUiVoiceOverviewPage({ initial }: { initial: VoiceOverviewSummaryResult }) {
  const { data } = initial;
  const metrics = overviewMetricsFromResult(initial);
  const recent = data.recentCalls.map(mapOverviewRecentCallToNewUi);
  const op = data.operational;

  return (
    <Page>
      <PageHeader
        title="Overview"
        description="How your receptionist is running, recent activity, and anything that needs your attention."
        actions={
          <ButtonLink href={op?.manageReceptionistHref || "/voice/receptionist"} variant="outline">
            Manage receptionist
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              AI Receptionist{" "}
              <Pill tone={data.mode === "active" ? "success" : "warning"}>
                {op?.publicationLabel || "Setup"}
              </Pill>
            </span>
          }
          description={op?.publicationLabel || "Configuration status"}
          action={<TextLink href="/voice/receptionist">Manage receptionist</TextLink>}
        >
          {op ? (
            <>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
                  {(op.receptionistName || "A").slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{op.receptionistName || "Receptionist"}</p>
                  <p className="text-xs text-muted-foreground">{op.voiceLabel || "Voice profile"}</p>
                </div>
              </div>
              <Rows
                items={[
                  op.phone
                    ? { label: "Phone", value: op.phone.label, href: "/voice/numbers" }
                    : null,
                  op.calendar
                    ? { label: "Calendar", value: op.calendar.label, href: op.calendar.href }
                    : null,
                  op.businessKnowledge
                    ? {
                        label: "Business knowledge",
                        value: (
                          <Pill tone={op.businessKnowledge.openGaps > 0 ? "warning" : "success"}>
                            {op.businessKnowledge.label}
                          </Pill>
                        ),
                        href: "/voice/knowledge",
                      }
                    : null,
                  op.businessHours
                    ? { label: "Business hours", value: op.businessHours.label, href: op.businessHours.href }
                    : null,
                ].filter(Boolean) as Array<{ label: string; value: ReactNode; href?: string }>}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Finish receptionist setup to go live.</p>
          )}
        </Panel>

        <Panel title="Needs attention" description={`${data.attention.length} items to review`}>
          {data.attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm transition hover:bg-warning/10"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="flex-1 text-pretty">{item.label}</span>
                    <span className="shrink-0 text-xs font-medium text-primary">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{metrics.periodLabel}</h2>
        <TextLink href="/voice/analytics">View analytics</TextLink>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Calls" value={String(metrics.totalCalls)} href="/voice/calls" />
        <Stat label="Appointments booked" value={String(metrics.appointmentsBooked)} href="/voice/calls" />
        <Stat label="Callbacks requested" value={String(metrics.callbacksRequested)} href="/voice/calls" />
      </div>

      <Panel
        className="mt-6"
        title="Recent calls"
        action={<TextLink href="/voice/calls">View all calls</TextLink>}
        bodyClassName="p-0"
      >
        <RecentCallsTable calls={recent} />
      </Panel>
    </Page>
  );
}
