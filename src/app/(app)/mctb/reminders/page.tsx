import { redirect } from "next/navigation";
import { resolveRemovedMctbSchedulingRedirect } from "@/lib/mctb/removed-scheduling-routes";

export default function MctbRemindersRemovedPage() {
  redirect(resolveRemovedMctbSchedulingRedirect("/mctb/reminders")!);
}
