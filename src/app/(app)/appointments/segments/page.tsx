import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AppointmentSegmentsPage({ searchParams }: Props) {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/segments", searchParams });
}
