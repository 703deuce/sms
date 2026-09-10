import { redirect } from "next/navigation";
import {
  resolveLegacyAppointmentsRedirect,
  type SearchParamsInput,
} from "@/lib/products/appointments-legacy-redirects";

type LegacyRedirectPageProps = {
  pathname: string;
  searchParams?: Promise<SearchParamsInput>;
};

/** Server page helper — permanently redirects a retired route to its canonical destination. */
export async function legacyAppointmentsRedirectPage({
  pathname,
  searchParams,
}: LegacyRedirectPageProps): Promise<never> {
  const params = searchParams ? await searchParams : undefined;
  redirect(resolveLegacyAppointmentsRedirect(pathname, params));
}
