import { redirect } from "next/navigation";

/** Legacy route — canonical home is Discounts. */
export default function AppointmentsCouponsPage() {
  redirect("/appointments/discounts");
}
