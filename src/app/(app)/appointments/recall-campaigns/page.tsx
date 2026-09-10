import { RecallCampaignsClient } from "@/components/appointments/recall-campaigns-client";
import { AppointmentsMigrationBanner } from "@/components/appointments/migration-banner";

export default function RecallCampaignsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <AppointmentsMigrationBanner
        message="Recall automation now lives under Automations."
        canonicalHref="/appointments/automations/recall"
        canonicalLabel="Open recall automation"
      />
      <RecallCampaignsClient />
    </div>
  );
}
