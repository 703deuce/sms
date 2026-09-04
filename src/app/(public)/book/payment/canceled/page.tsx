import Link from "next/link";

export default async function AppointmentPaymentCanceledPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold">Payment canceled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment was not completed. Contact the business if you need help finishing your booking.
        </p>
        {params.appointment ? (
          <p className="mt-4 text-xs text-muted-foreground">Reference: {params.appointment}</p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
