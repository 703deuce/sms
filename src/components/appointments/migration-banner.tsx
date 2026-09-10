import Link from "next/link";

export function AppointmentsMigrationBanner({
  message,
  canonicalHref,
  canonicalLabel,
}: {
  message: string;
  canonicalHref: string;
  canonicalLabel: string;
}) {
  return (
    <div
      className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
      role="status"
    >
      {message}{" "}
      <Link href={canonicalHref} className="font-semibold text-primary underline">
        {canonicalLabel}
      </Link>
    </div>
  );
}
