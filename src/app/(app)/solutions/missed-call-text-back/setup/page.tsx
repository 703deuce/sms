import { redirect } from "next/navigation";

/** Legacy wizard path → unified setup page. */
export default function MissedCallTextBackSetupRedirectPage() {
  redirect("/voice/setup");
}
