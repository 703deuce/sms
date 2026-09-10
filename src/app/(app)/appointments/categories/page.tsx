import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function CategoriesPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/categories" });
}
