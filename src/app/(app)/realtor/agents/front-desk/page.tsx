import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function FrontDeskAgentPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Front Desk" description="Configuration — not daily operations." />
      <Card className="p-4 space-y-2 text-sm">
        <p>
          Deployed agent: {config.deployedAgentId || "Not deployed yet"}
        </p>
        <p>
          Built from template: {config.frontDeskTemplateAgentId || "Front Desk Booking agent"}
        </p>
        <p className="text-muted-foreground">
          Inbound Amy clones your existing Front Desk Booking (Realtime) agent — wizard fields
          customize business profile, intents, and outcomes later.
        </p>
      </Card>
      <Card className="p-4">
        <CardTitle className="mb-3">Caller types</CardTitle>
        <ul className="space-y-2 text-sm">
          {Object.entries(config.frontDesk).map(([key, val]) => (
            <li key={key} className="flex justify-between border-b py-2 last:border-0">
              <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
              <span>{val.enabled ? `On · ${val.qualifiedOutcome}` : "Off"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
