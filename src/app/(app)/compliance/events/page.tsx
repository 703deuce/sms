import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { titleCaseStatus } from "@/lib/mappers";
import type { StatusChip as StatusChipType } from "@/lib/types";
import { loadRegistrationEvents, requireWorkspaceContext } from "@/lib/workspace-data";
import { ClipboardList } from "lucide-react";
import { ComplianceRefreshButton } from "@/components/compliance/compliance-refresh-button";

type RegistrationEventRow = Awaited<ReturnType<typeof loadRegistrationEvents>>[number];

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

function eventStatus(eventType: string): StatusChipType {
  const t = eventType.toLowerCase();
  if (t.includes("approved") || t.includes("ready") || t.endsWith("_saved")) return "Completed";
  if (t.includes("rejected") || t.includes("failed")) return "Failed";
  if (t.includes("draft")) return "Draft";
  if (t.includes("requires_resubmit") || t.includes("pending") || t.includes("submitted")) return "Pending";
  return titleCaseStatus("Pending");
}

export default async function ComplianceEventsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const events = await loadRegistrationEvents(workspaceId);

  return (
    <div>
      <PageHeader
        title="Compliance events"
        description="Timeline of registration changes, verifications, and compliance-related account activity."
        actions={<ComplianceRefreshButton />}
      />

      <Tabs items={complianceTabs} />

      <Card>
        <CardTitle>Event timeline</CardTitle>
        {events.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No compliance events"
            description="Registration and verification activity will appear here as your A2P profile progresses."
            actionLabel="Compliance overview"
            actionHref="/compliance"
          />
        ) : (
          <ul className="mt-4 space-y-0">
            {events.map((event: RegistrationEventRow, index: number) => (
              <li key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
                {index < events.length - 1 ? (
                  <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
                ) : null}
                <span className="relative z-10 mt-1.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 border-primary bg-card" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.eventType}</p>
                    <StatusChip status={eventStatus(event.eventType)} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.message || "—"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    System ·{" "}
                    {new Date(event.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
