import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ServiceBookingReportsPage({ searchParams }: Props) {
  return legacyAppointmentsRedirectPage({
    pathname: "/appointments/reports/service-booking",
    searchParams,
  });
}
