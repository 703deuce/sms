import { redirect } from "next/navigation";

/** Product launcher hidden — SMS mass marketing is the sole app surface. */
export default function ProductLauncherPage() {
  redirect("/dashboard");
}
