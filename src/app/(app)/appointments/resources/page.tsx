import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ResourcesPage({ searchParams }: Props) {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/resources", searchParams });
}
