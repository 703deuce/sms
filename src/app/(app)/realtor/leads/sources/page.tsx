import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import Link from "next/link";

export default async function LeadSourcesPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);
  const sources = ["Facebook", "Zillow", "Realtor.com", "Website", "Follow Up Boss", "HubSpot", "Webhook", "CSV"];

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Lead Sources" description="Where new leads enter the loop." />
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((s) => (
          <Card key={s} className="p-4">
            <CardTitle className="text-base">{s}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {config.leadSources.includes(s) ? "Selected in onboarding" : "Not selected"}
            </p>
            <Link href="/integrations" className="text-sm text-primary">
              Connect →
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
