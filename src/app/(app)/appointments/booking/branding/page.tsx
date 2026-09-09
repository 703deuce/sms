import { redirect } from "next/navigation";

export default function BookingBrandingRedirectPage() {
  redirect("/appointments/booking?section=branding");
}
