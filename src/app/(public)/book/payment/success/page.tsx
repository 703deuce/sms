import Link from "next/link";
import { Check } from "lucide-react";

export default async function AppointmentPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; appointment?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Payment received</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your appointment payment was successful. You&apos;ll receive a confirmation shortly.
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
