import { NoShowRecoveryClient } from "@/components/appointments/no-show-recovery-client";
import { AppointmentsMigrationBanner } from "@/components/appointments/migration-banner";

export default function NoShowRecoveryPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <AppointmentsMigrationBanner
        message="No-show follow-up now lives under Automations."
        canonicalHref="/appointments/automations/no-show"
        canonicalLabel="Open no-show follow-up"
      />
      <NoShowRecoveryClient />
    </div>
  );
}
