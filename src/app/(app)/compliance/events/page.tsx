import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";

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

const complianceEvents = [
  {
    id: "ce_1",
    type: "Brand submitted",
    status: "Pending",
    detail: "Harbor Home brand submitted to The Campaign Registry",
    actor: "Alex Rivera",
    at: "2026-07-15T14:30:00Z",
  },
  {
    id: "ce_2",
    type: "Business profile updated",
    status: "Complete",
    detail: "Legal entity and address verified",
    actor: "Alex Rivera",
    at: "2026-07-14T09:15:00Z",
  },
  {
    id: "ce_3",
    type: "Toll-free verified",
    status: "Approved",
    detail: "+1 (800) 555-0199 toll-free verification approved",
    actor: "System",
    at: "2026-07-12T16:00:00Z",
  },
  {
    id: "ce_4",
    type: "Campaign draft saved",
    status: "Draft",
    detail: "Harbor Home Customer Care campaign saved as draft",
    actor: "Alex Rivera",
    at: "2026-07-10T11:22:00Z",
  },
  {
    id: "ce_5",
    type: "STOP processed",
    status: "Complete",
    detail: "Drew Kim opted out via inbound STOP keyword",
    actor: "System",
    at: "2026-06-01T08:45:00Z",
  },
  {
    id: "ce_6",
    type: "Number purchased",
    status: "Active",
    detail: "+1 (415) 555-0142 local number activated",
    actor: "Alex Rivera",
    at: "2026-07-01T10:00:00Z",
  },
];

export default function ComplianceEventsPage() {
  return (
    <div>
      <PageHeader
        title="Compliance events"
        description="Timeline of registration changes, verifications, and compliance-related account activity."
      />

      <Tabs items={complianceTabs} />

      <Card>
        <CardTitle>Event timeline</CardTitle>
        <ul className="mt-4 space-y-0">
          {complianceEvents.map((event, index) => (
            <li key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
              {index < complianceEvents.length - 1 ? (
                <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
              ) : null}
              <span className="relative z-10 mt-1.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 border-primary bg-card" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{event.type}</p>
                  <StatusChip status={event.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {event.actor} ·{" "}
                  {new Date(event.at).toLocaleString("en-US", {
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
      </Card>
    </div>
  );
}
