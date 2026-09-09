import { redirect } from "next/navigation";

export default function AppointmentsContractsRedirectPage() {
  redirect("/appointments/forms-documents?tab=contracts");
}
