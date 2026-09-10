"use client";

import Link from "next/link";
import { WorkspaceBookingPoliciesEditor } from "@/components/appointments/workspace-booking-policies-editor";

export function AppointmentsPoliciesClient() {
  return (
    <div className="space-y-4">
      <WorkspaceBookingPoliciesEditor
        variant="page"
        title="Booking policies"
        description="Cancellation policy, no-show policy, and late-cancel rules shown on public booking."
      />
      <p className="text-sm text-muted-foreground">
        These settings are also available under{" "}
        <Link href="/settings/business" className="text-primary underline">
          Settings → Business → Default booking policies
        </Link>
        .
      </p>
    </div>
  );
}
