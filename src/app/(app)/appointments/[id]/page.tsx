import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppointmentDetailClient } from "@/components/appointments/detail-client";
import { PosCartAdminClient } from "@/components/appointments/pos-cart-admin-client";
import { RoomsEquipmentListConnected } from "@/components/appointments/rooms-equipment/rooms-equipment-list-connected";
import { FormsDocumentsConnected } from "@/components/appointments/forms-documents/forms-documents-connected";

const RESERVED_SLUGS: Record<string, string> = {
  coupons: "/appointments/coupons",
  payments: "/appointments/payments",
  contracts: "/appointments/contracts",
  policies: "/appointments/policies",
  restrictions: "/appointments/restrictions",
  scheduled: "/appointments/scheduled",
  "service-booking": "/appointments/service-booking",
  resources: "/appointments/rooms-equipment",
};

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  if (RESERVED_SLUGS[id]) redirect(RESERVED_SLUGS[id]);
  if (id === "rooms-equipment") {
    return <RoomsEquipmentListConnected />;
  }
  if (id === "forms-documents") {
    return (
      <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
        <FormsDocumentsConnected />
      </Suspense>
    );
  }
  if (id === "pos") {
    return <PosCartAdminClient />;
  }
  return (
    <div className="px-6 py-6 lg:px-8">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  );
}
