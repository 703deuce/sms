"use client";

import { WorkspaceBookingPoliciesEditor } from "@/components/appointments/workspace-booking-policies-editor";

export default function DefaultBookingPoliciesCard() {
  return (
    <WorkspaceBookingPoliciesEditor
      id="booking-policies"
      variant="card"
      title="Default booking policies"
      description="Workspace-wide cancellation and no-show policy text shown on public booking when a booking type does not override it."
      showTypeOverrideNote
    />
  );
}
