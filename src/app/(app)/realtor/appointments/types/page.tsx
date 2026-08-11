import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import Link from "next/link";

export default async function RealtorAppointmentTypesPage() {
  const { config } = await requireRealtorOnboardingComplete();
  const mappings = config.calendlyEventMappings || {};

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Appointment Types"
        description="Map what Amy schedules to your Calendly event types."
      />
      <Card className="divide-y">
        {config.appointmentTypes.map((type) => (
          <div key={type} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{type}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Calendly mapping: {mappings[type]?.trim() || "Not mapped yet"}
              </p>
            </div>
            <Link
              href={`/integrations/native/calendly?appointmentType=${encodeURIComponent(type)}`}
              className="text-sm font-medium text-primary"
            >
              Connect in Calendly
            </Link>
          </div>
        ))}
      </Card>
      <p className="text-sm text-muted-foreground">
        Amy books using your connected Calendly calendar. Update mappings in Settings → Integrations after
        connecting Calendly.
      </p>
    </div>
  );
}
