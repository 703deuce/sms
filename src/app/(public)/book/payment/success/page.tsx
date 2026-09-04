import { PaymentSuccessClient } from "@/components/appointments/payment-success-client";

export default async function AppointmentPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; appointment?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <PaymentSuccessClient
        appointmentId={params.appointment}
        sessionId={params.session_id}
      />
    </div>
  );
}
