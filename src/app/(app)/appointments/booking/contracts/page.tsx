import { redirect } from "next/navigation";

export default function BookingContractsRedirectPage() {
  redirect("/appointments/forms-documents?tab=contracts");
}
