import { redirect } from "next/navigation";
import { AppointmentDetailClient } from "@/components/appointments/detail-client";
import { PosCartAdminClient } from "@/components/appointments/pos-cart-admin-client";

import { resolveLegacyAppointmentsRedirect } from "@/lib/products/appointments-legacy-redirects";

const RESERVED_SLUGS: Record<string, string> = {
  coupons: resolveLegacyAppointmentsRedirect("/appointments/coupons"),
  payments: "/appointments/payments",
  contracts: resolveLegacyAppointmentsRedirect("/appointments/contracts"),
  policies: resolveLegacyAppointmentsRedirect("/appointments/policies"),
  restrictions: resolveLegacyAppointmentsRedirect("/appointments/restrictions"),
  scheduled: resolveLegacyAppointmentsRedirect("/appointments/scheduled"),
  "service-booking": resolveLegacyAppointmentsRedirect("/appointments/service-booking"),
  commerce: resolveLegacyAppointmentsRedirect("/appointments/commerce"),
  routing: resolveLegacyAppointmentsRedirect("/appointments/routing"),
  categories: resolveLegacyAppointmentsRedirect("/appointments/categories"),
  classes: resolveLegacyAppointmentsRedirect("/appointments/classes"),
  resources: resolveLegacyAppointmentsRedirect("/appointments/resources"),
  segments: resolveLegacyAppointmentsRedirect("/appointments/segments"),
};

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  if (RESERVED_SLUGS[id]) redirect(RESERVED_SLUGS[id]);
  if (id === "pos") {
    return <PosCartAdminClient />;
  }
  return (
    <div className="px-6 py-6 lg:px-8">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  );
}
