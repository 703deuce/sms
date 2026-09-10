import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function BookingContractsPage({ searchParams }: Props) {
  return legacyAppointmentsRedirectPage({
    pathname: "/appointments/booking/contracts",
    searchParams,
  });
}
