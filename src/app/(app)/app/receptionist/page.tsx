import { redirect } from "next/navigation";

/** Legacy launcher path — opens voice product (MCTB dashboard). */
export default function LegacyReceptionistLauncherPage() {
  redirect("/dashboard");
}
