import { redirect } from "next/navigation";
import { resolveRemovedMctbSchedulingRedirect } from "@/lib/mctb/removed-scheduling-routes";

export default function MctbAppointmentDetailRemovedPage() {
  redirect(resolveRemovedMctbSchedulingRedirect("/mctb/appointments")!);
}
