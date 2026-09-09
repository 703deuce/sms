import { redirect } from "next/navigation";

export default function BookingShareRedirectPage() {
  redirect("/appointments/booking?section=share");
}
