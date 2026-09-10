import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function BookingRoomsEquipmentPage() {
  return (
    <ServiceBookingAdminClient
      initialSection="resources"
      title="Rooms & equipment"
    />
  );
}
