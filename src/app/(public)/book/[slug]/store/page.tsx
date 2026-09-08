import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function PublicStorePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Packages &amp; memberships</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Purchase packages, gift certificates, and memberships from this booking page.
      </p>
      <p className="mt-4 text-sm">
        Use the workspace commerce admin to configure products, then share direct purchase links from
        Appointments → Commerce.
      </p>
    </main>
  );
}
